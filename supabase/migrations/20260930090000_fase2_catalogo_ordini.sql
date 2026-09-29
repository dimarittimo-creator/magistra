-- Magistra – Fase 2: catalogo, disponibilità e prenotazioni delle farmacie.
-- Prezzi e sconti si calcolano in lib/pricing (unica fonte); qui stanno i dati,
-- la disponibilità (giacenza − impegnato) e l'invio transazionale dell'ordine.

-- ---------------------------------------------------------------------------
-- Tipi
-- ---------------------------------------------------------------------------
create type public.stato_ordine as enum (
  'inviato', 'in_verifica', 'confermato', 'modificato', 'rifiutato', 'scaduto',
  'inviato_deposito', 'in_preparazione', 'spedito', 'consegnato'
);
create type public.canale_pagamento as enum ('farmacie', 'privati', 'entrambi');
create type public.tipo_import as enum ('deposito_crystal', 'listino', 'modello');
create type public.stato_import as enum ('anteprima', 'applicato', 'annullato');

-- Stati in cui la merce resta impegnata (docs/REGOLE_COMMERCIALI.md §5)
create or replace function public.stato_ordine_aperto(s public.stato_ordine)
returns boolean
language sql
immutable
as $$
  select s in ('inviato', 'in_verifica', 'confermato', 'modificato', 'inviato_deposito', 'in_preparazione');
$$;

-- ---------------------------------------------------------------------------
-- Catalogo
-- ---------------------------------------------------------------------------
create table public.linee (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  attiva boolean not null default true,
  creato_il timestamptz not null default now()
);

create table public.aree_terapeutiche (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  attiva boolean not null default true,
  creato_il timestamptz not null default now()
);

create table public.prodotti (
  codice text primary key check (codice ~ '^[0-9]{9}$'),        -- minsan
  nome text not null,
  descrizione_deposito text,                                       -- come nel file del deposito
  formato text,
  descrizione text,
  linea_id uuid references public.linee (id),
  area_id uuid references public.aree_terapeutiche (id),
  immagine_path text,
  prezzo_pubblico_cent int check (prezzo_pubblico_cent is null or prezzo_pubblico_cent > 0),  -- null = non visibile
  iva_override numeric(5, 2) check (iva_override is null or iva_override between 0 and 100),
  minimo_ordine int not null default 1 check (minimo_ordine >= 1),
  multiplo int not null default 1 check (multiplo >= 1),
  soglia_esaurimento int check (soglia_esaurimento is null or soglia_esaurimento >= 0),  -- null = impostazione generale
  codice_interno_deposito text,                                    -- "Azienda produttrice": non si mostra
  visibile_privati boolean not null default false,
  attivo boolean not null default true,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

create trigger prodotti_aggiornato before update on public.prodotti
  for each row execute function public.imposta_aggiornato_il();

-- Import dei file di magazzino (giacenza del deposito, listino, modello pulito)
create table public.import_magazzino (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_import not null,
  file_nome text not null,
  deposito_id uuid references public.sedi (id),
  data_giacenza date,
  stato public.stato_import not null default 'anteprima',
  riepilogo jsonb,
  avvisi jsonb,
  utente uuid references auth.users (id) on delete set null,
  creato_il timestamptz not null default now(),
  applicato_il timestamptz
);

-- Giacenza totale dichiarata dal deposito per prodotto (serve per la regola di difformità)
create table public.giacenze_prodotto (
  prodotto_codice text not null references public.prodotti (codice),
  deposito_id uuid not null references public.sedi (id),
  totale_dichiarato int not null check (totale_dichiarato >= 0),
  data_giacenza date not null,
  import_id uuid references public.import_magazzino (id),
  aggiornato_il timestamptz not null default now(),
  primary key (prodotto_codice, deposito_id)
);

create table public.lotti (
  id uuid primary key default gen_random_uuid(),
  prodotto_codice text not null references public.prodotti (codice),
  deposito_id uuid not null references public.sedi (id),
  codice_lotto text not null,                 -- conservato esattamente come nel file
  scadenza date,                              -- null = mancante
  giacenza int not null check (giacenza >= 0),
  data_giacenza date not null,
  sconto_manuale numeric(5, 2) check (sconto_manuale is null or sconto_manuale between 0 and 100),  -- null = fascia
  import_id uuid references public.import_magazzino (id),
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  unique (prodotto_codice, deposito_id, codice_lotto)
);

create index lotti_prodotto on public.lotti (prodotto_codice);

create trigger lotti_aggiornato before update on public.lotti
  for each row execute function public.imposta_aggiornato_il();

-- Fasce di sconto per scadenza (modificabili dall'admin; serve sempre la fascia da 0 mesi)
create table public.fasce_sconto (
  id uuid primary key default gen_random_uuid(),
  mesi_minimi int not null unique check (mesi_minimi >= 0),
  sconto_percentuale numeric(5, 2) not null check (sconto_percentuale between 0 and 100),
  attiva boolean not null default true,
  aggiornato_il timestamptz not null default now()
);

create trigger fasce_sconto_aggiornato before update on public.fasce_sconto
  for each row execute function public.imposta_aggiornato_il();
create trigger fasce_sconto_storico after update on public.fasce_sconto
  for each row execute function public.registra_storico();

-- Fascia "non vendibile" predisposta ma non attiva (null = disattivata)
alter table public.impostazioni add column mesi_non_vendibile int check (mesi_non_vendibile is null or mesi_non_vendibile >= 0);

-- ---------------------------------------------------------------------------
-- Modalità di pagamento
-- ---------------------------------------------------------------------------
create table public.modalita_pagamento (
  id uuid primary key default gen_random_uuid(),
  codice text not null unique,
  descrizione text not null,
  canale public.canale_pagamento not null,
  richiede_iban boolean not null default false,    -- bonifico: serve l'IBAN della società che fattura
  contrassegno boolean not null default false,     -- importo da incassare in evidenza al deposito
  costo_aggiuntivo_cent int not null default 0 check (costo_aggiuntivo_cent >= 0),
  attiva boolean not null default true,
  ordine int not null default 0,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

create trigger modalita_pagamento_aggiornato before update on public.modalita_pagamento
  for each row execute function public.imposta_aggiornato_il();

-- ---------------------------------------------------------------------------
-- Carrello (sul server: si ritrova da tablet, computer o smartphone)
-- ---------------------------------------------------------------------------
create table public.carrello_righe (
  farmacia_id uuid not null references public.farmacie (id) on delete cascade,
  lotto_id uuid not null references public.lotti (id) on delete cascade,
  quantita int not null check (quantita > 0),
  aggiunto_il timestamptz not null default now(),
  primary key (farmacia_id, lotto_id)
);

-- ---------------------------------------------------------------------------
-- Ordini
-- ---------------------------------------------------------------------------
-- Numerazione annuale P-2026-00001 senza buchi (riga bloccata durante l'invio)
create table public.numerazione_ordini (
  anno int primary key,
  ultimo int not null default 0
);

create table public.ordini (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  canale public.canale not null,
  farmacia_id uuid references public.farmacie (id),
  privato_id uuid,
  societa_id uuid not null references public.societa (id),
  deposito_id uuid not null references public.sedi (id),
  stato public.stato_ordine not null default 'inviato',
  modalita_pagamento_id uuid not null references public.modalita_pagamento (id),
  pagamento_ricevuto_il timestamptz,
  note text,
  data_consegna_desiderata date,
  consegna_indicativa_giorni int not null,
  scade_il timestamptz,
  snapshot_cliente jsonb not null,
  snapshot_societa jsonb not null,
  snapshot_pagamento jsonb not null,
  condizioni_documento_id uuid not null references public.documenti_legali (id),
  condizioni_versione int not null,
  imponibile_cent int not null,
  sconti_cent int not null default 0,
  iva_cent int not null,
  iva_dettaglio jsonb not null default '[]',
  spese_spedizione_cent int not null default 0,
  totale_cent int not null,
  creato_da uuid references auth.users (id) on delete set null,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  constraint ordini_un_cliente check (num_nonnulls(farmacia_id, privato_id) = 1)
);

create index ordini_farmacia on public.ordini (farmacia_id, creato_il desc);
create index ordini_stato on public.ordini (stato, creato_il desc);

create trigger ordini_aggiornato before update on public.ordini
  for each row execute function public.imposta_aggiornato_il();

create table public.righe_ordine (
  id uuid primary key default gen_random_uuid(),
  ordine_id uuid not null references public.ordini (id) on delete cascade,
  lotto_id uuid not null references public.lotti (id),
  prodotto_codice text not null references public.prodotti (codice),
  prodotto_nome text not null,
  codice_lotto text not null,
  scadenza date not null,
  quantita int not null check (quantita > 0),
  quantita_omaggio int not null default 0 check (quantita_omaggio >= 0),
  prezzo_pubblico_cent int not null,
  iva numeric(5, 2) not null,
  sconto_applicato numeric(5, 2) not null,
  origine_sconto text not null check (origine_sconto in ('fascia', 'lotto', 'promozione', 'listino_gruppo', 'sconto_privati')),
  promozione_id uuid,
  prezzo_pubblico_netto_cent int not null,
  prezzo_farmacia_ivato_cent int not null,
  prezzo_farmacia_netto_cent int not null,
  imponibile_cent int not null,
  posizione int not null default 0
);

create index righe_ordine_lotto on public.righe_ordine (lotto_id);
create index righe_ordine_ordine on public.righe_ordine (ordine_id, posizione);

create table public.storico_stati (
  id bigint generated always as identity primary key,
  ordine_id uuid not null references public.ordini (id) on delete cascade,
  da public.stato_ordine,
  a public.stato_ordine not null,
  utente uuid references auth.users (id) on delete set null,
  messaggio text,
  il timestamptz not null default now()
);

create index storico_stati_ordine on public.storico_stati (ordine_id, il);

-- ---------------------------------------------------------------------------
-- Disponibilità: giacenza importata − impegnato negli ordini aperti
-- (− spedito dopo la data della giacenza: arriva con le spedizioni in Fase 3)
-- ---------------------------------------------------------------------------
create or replace function public.disponibilita_lotti(p_prodotto text default null)
returns table (lotto_id uuid, impegnato int, disponibile int)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id,
         coalesce(i.impegnato, 0)::int,
         (l.giacenza - coalesce(i.impegnato, 0))::int
  from public.lotti l
  left join (
    select r.lotto_id, sum(r.quantita + r.quantita_omaggio) as impegnato
    from public.righe_ordine r
    join public.ordini o on o.id = r.ordine_id
    where public.stato_ordine_aperto(o.stato)
    group by r.lotto_id
  ) i on i.lotto_id = l.id
  where (p_prodotto is null or l.prodotto_codice = p_prodotto)
    -- solo farmacie attive, staff e server (chiave di servizio)
    and (auth.uid() is null or public.farmacia_attiva() or public.e_staff());
$$;

revoke execute on function public.disponibilita_lotti(text) from public, anon;
grant execute on function public.disponibilita_lotti(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Invio della prenotazione: controllo e impegno in un'unica transazione.
-- I lotti si bloccano (FOR UPDATE, in ordine di id per evitare stalli):
-- se la merce non basta l'ordine non parte e si restituiscono le righe da correggere.
-- Prezzi e totali arrivano già calcolati da lib/pricing.
-- ---------------------------------------------------------------------------
create or replace function public.invia_ordine_farmacia(p_utente uuid, p_ordine jsonb, p_righe jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_farmacia uuid;
  v_stato public.stato_farmacia;
  v_mancanti jsonb := '[]';
  v_riga record;
  v_disponibile int;
  v_anno int := extract(year from now() at time zone 'Europe/Rome')::int;
  v_progressivo int;
  v_numero text;
  v_ordine uuid;
begin
  select p.farmacia_id, f.stato into v_farmacia, v_stato
  from public.profili_utente p join public.farmacie f on f.id = p.farmacia_id
  where p.id = p_utente;
  if v_farmacia is null or v_stato <> 'attiva' then
    return jsonb_build_object('esito', 'farmacia_non_attiva');
  end if;

  -- Blocco dei lotti coinvolti
  perform 1 from public.lotti
  where id in (select (x->>'lotto_id')::uuid from jsonb_array_elements(p_righe) x)
  order by id
  for update;

  for v_riga in
    select (x->>'lotto_id')::uuid as lotto_id, sum((x->>'quantita')::int + coalesce((x->>'quantita_omaggio')::int, 0)) as richiesta
    from jsonb_array_elements(p_righe) x
    group by 1
  loop
    select d.disponibile into v_disponibile from public.disponibilita_lotti() d where d.lotto_id = v_riga.lotto_id;
    if coalesce(v_disponibile, 0) < v_riga.richiesta then
      v_mancanti := v_mancanti || jsonb_build_object('lotto_id', v_riga.lotto_id, 'richiesta', v_riga.richiesta, 'disponibile', greatest(coalesce(v_disponibile, 0), 0));
    end if;
  end loop;

  if jsonb_array_length(v_mancanti) > 0 then
    return jsonb_build_object('esito', 'merce_insufficiente', 'righe', v_mancanti);
  end if;

  insert into public.numerazione_ordini (anno, ultimo) values (v_anno, 1)
  on conflict (anno) do update set ultimo = public.numerazione_ordini.ultimo + 1
  returning ultimo into v_progressivo;
  v_numero := 'P-' || v_anno || '-' || lpad(v_progressivo::text, 5, '0');

  insert into public.ordini (
    numero, canale, farmacia_id, societa_id, deposito_id, stato, modalita_pagamento_id, note,
    data_consegna_desiderata, consegna_indicativa_giorni, scade_il, snapshot_cliente, snapshot_societa,
    snapshot_pagamento, condizioni_documento_id, condizioni_versione, imponibile_cent, sconti_cent,
    iva_cent, iva_dettaglio, spese_spedizione_cent, totale_cent, creato_da
  ) values (
    v_numero, 'farmacie', v_farmacia, (p_ordine->>'societa_id')::uuid, (p_ordine->>'deposito_id')::uuid, 'inviato',
    (p_ordine->>'modalita_pagamento_id')::uuid, nullif(p_ordine->>'note', ''),
    nullif(p_ordine->>'data_consegna_desiderata', '')::date, (p_ordine->>'consegna_indicativa_giorni')::int,
    (p_ordine->>'scade_il')::timestamptz, p_ordine->'snapshot_cliente', p_ordine->'snapshot_societa',
    p_ordine->'snapshot_pagamento', (p_ordine->>'condizioni_documento_id')::uuid, (p_ordine->>'condizioni_versione')::int,
    (p_ordine->>'imponibile_cent')::int, (p_ordine->>'sconti_cent')::int, (p_ordine->>'iva_cent')::int,
    coalesce(p_ordine->'iva_dettaglio', '[]'), 0, (p_ordine->>'totale_cent')::int, p_utente
  )
  returning id into v_ordine;

  insert into public.righe_ordine (
    ordine_id, lotto_id, prodotto_codice, prodotto_nome, codice_lotto, scadenza, quantita, quantita_omaggio,
    prezzo_pubblico_cent, iva, sconto_applicato, origine_sconto, promozione_id, prezzo_pubblico_netto_cent,
    prezzo_farmacia_ivato_cent, prezzo_farmacia_netto_cent, imponibile_cent, posizione
  )
  select v_ordine, (x->>'lotto_id')::uuid, x->>'prodotto_codice', x->>'prodotto_nome', x->>'codice_lotto',
         (x->>'scadenza')::date, (x->>'quantita')::int, coalesce((x->>'quantita_omaggio')::int, 0),
         (x->>'prezzo_pubblico_cent')::int, (x->>'iva')::numeric, (x->>'sconto_applicato')::numeric,
         x->>'origine_sconto', nullif(x->>'promozione_id', '')::uuid, (x->>'prezzo_pubblico_netto_cent')::int,
         (x->>'prezzo_farmacia_ivato_cent')::int, (x->>'prezzo_farmacia_netto_cent')::int,
         (x->>'imponibile_cent')::int, n::int
  from jsonb_array_elements(p_righe) with ordinality as t(x, n);

  insert into public.storico_stati (ordine_id, da, a, utente, messaggio)
  values (v_ordine, null, 'inviato', p_utente, 'Prenotazione inviata dalla farmacia');

  delete from public.carrello_righe where farmacia_id = v_farmacia;

  return jsonb_build_object('esito', 'ok', 'ordine_id', v_ordine, 'numero', v_numero);
end;
$$;

revoke execute on function public.invia_ordine_farmacia(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.invia_ordine_farmacia(uuid, jsonb, jsonb) to service_role;

-- Prenotazioni non confermate entro la scadenza: passano a "Scaduto" e liberano la merce.
create or replace function public.scadi_prenotazioni()
returns table (ordine_id uuid, numero text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with da_scadere as (
    select o.id, o.numero, o.stato
    from public.ordini o
    where o.stato in ('inviato', 'in_verifica') and o.scade_il is not null and o.scade_il <= now()
    for update
  ), aggiornati as (
    update public.ordini o set stato = 'scaduto'
    from da_scadere d where o.id = d.id
    returning o.id
  ), storico as (
    insert into public.storico_stati (ordine_id, da, a, messaggio)
    select d.id, d.stato, 'scaduto', 'Prenotazione non confermata entro i termini: la merce torna disponibile'
    from da_scadere d
  )
  select d.id, d.numero from da_scadere d join aggiornati a on a.id = d.id;
end;
$$;

revoke execute on function public.scadi_prenotazioni() from public, anon, authenticated;
grant execute on function public.scadi_prenotazioni() to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.linee enable row level security;
alter table public.aree_terapeutiche enable row level security;
alter table public.prodotti enable row level security;
alter table public.import_magazzino enable row level security;
alter table public.giacenze_prodotto enable row level security;
alter table public.lotti enable row level security;
alter table public.fasce_sconto enable row level security;
alter table public.modalita_pagamento enable row level security;
alter table public.carrello_righe enable row level security;
alter table public.numerazione_ordini enable row level security;
alter table public.ordini enable row level security;
alter table public.righe_ordine enable row level security;
alter table public.storico_stati enable row level security;

-- Catalogo: farmacie attive e staff in lettura, admin in scrittura.
create policy linee_lettura on public.linee for select to authenticated using (public.farmacia_attiva() or public.e_staff());
create policy linee_admin on public.linee for all to authenticated using (public.e_admin()) with check (public.e_admin());
create policy aree_lettura on public.aree_terapeutiche for select to authenticated using (public.farmacia_attiva() or public.e_staff());
create policy aree_admin on public.aree_terapeutiche for all to authenticated using (public.e_admin()) with check (public.e_admin());
create policy prodotti_lettura on public.prodotti for select to authenticated using (public.farmacia_attiva() or public.e_staff());
create policy prodotti_admin on public.prodotti for all to authenticated using (public.e_admin()) with check (public.e_admin());
create policy giacenze_lettura on public.giacenze_prodotto for select to authenticated using (public.farmacia_attiva() or public.e_staff());
create policy giacenze_admin on public.giacenze_prodotto for all to authenticated using (public.e_admin()) with check (public.e_admin());
create policy lotti_lettura on public.lotti for select to authenticated using (public.farmacia_attiva() or public.e_staff());
create policy lotti_admin on public.lotti for all to authenticated using (public.e_admin()) with check (public.e_admin());
create policy fasce_lettura on public.fasce_sconto for select to authenticated using (public.farmacia_attiva() or public.e_staff());
create policy fasce_admin on public.fasce_sconto for all to authenticated using (public.e_admin()) with check (public.e_admin());
create policy import_staff on public.import_magazzino for select to authenticated using (public.e_staff());
create policy import_admin on public.import_magazzino for all to authenticated using (public.e_admin()) with check (public.e_admin());

create policy pagamento_lettura on public.modalita_pagamento for select to authenticated using (true);
create policy pagamento_admin on public.modalita_pagamento for all to authenticated using (public.e_admin()) with check (public.e_admin());

-- Carrello: solo la propria farmacia, se attiva.
create policy carrello_proprio on public.carrello_righe for all to authenticated
  using (farmacia_id = public.mia_farmacia_id() and public.farmacia_attiva())
  with check (farmacia_id = public.mia_farmacia_id() and public.farmacia_attiva());

-- Ordini: la farmacia vede i propri, lo staff tutti; si creano solo con invia_ordine_farmacia.
create policy ordini_lettura on public.ordini for select to authenticated
  using (farmacia_id = public.mia_farmacia_id() or public.e_staff());
create policy ordini_staff on public.ordini for update to authenticated using (public.e_staff()) with check (public.e_staff());
create policy righe_lettura on public.righe_ordine for select to authenticated
  using (exists (select 1 from public.ordini o where o.id = ordine_id and (o.farmacia_id = public.mia_farmacia_id() or public.e_staff())));
create policy storico_stati_lettura on public.storico_stati for select to authenticated
  using (exists (select 1 from public.ordini o where o.id = ordine_id and (o.farmacia_id = public.mia_farmacia_id() or public.e_staff())));
create policy storico_stati_staff on public.storico_stati for insert to authenticated with check (public.e_staff() and utente = auth.uid());
