-- Magistra – Fase 3: amministrazione, listini di gruppo, promozioni, limitazioni dei pagamenti,
-- spedizioni al deposito (richiesta di evasione, DDT, differenze, solleciti, fatturazione).

-- ---------------------------------------------------------------------------
-- Modalità di pagamento: limitazioni per farmacia o gruppo.
-- Una modalità senza limitazioni vale per tutti; con limitazioni solo per chi è elencato.
-- ---------------------------------------------------------------------------
create table public.modalita_pagamento_limiti (
  id uuid primary key default gen_random_uuid(),
  modalita_id uuid not null references public.modalita_pagamento (id) on delete cascade,
  gruppo_id uuid references public.gruppi (id) on delete cascade,
  farmacia_id uuid references public.farmacie (id) on delete cascade,
  creato_il timestamptz not null default now(),
  constraint limiti_un_destinatario check (num_nonnulls(gruppo_id, farmacia_id) = 1)
);
create unique index limiti_gruppo on public.modalita_pagamento_limiti (modalita_id, gruppo_id) where gruppo_id is not null;
create unique index limiti_farmacia on public.modalita_pagamento_limiti (modalita_id, farmacia_id) where farmacia_id is not null;

-- ---------------------------------------------------------------------------
-- Listini dedicati ai gruppi: prezzo al pubblico diverso e/o sconto dedicato
-- (lo sconto dedicato compete con quello del lotto: vale il migliore).
-- ---------------------------------------------------------------------------
create table public.listini_gruppo (
  gruppo_id uuid not null references public.gruppi (id) on delete cascade,
  prodotto_codice text not null references public.prodotti (codice) on delete cascade,
  prezzo_pubblico_cent int check (prezzo_pubblico_cent is null or prezzo_pubblico_cent > 0),
  sconto_percentuale numeric(5, 2) check (sconto_percentuale is null or sconto_percentuale between 0 and 100),
  aggiornato_il timestamptz not null default now(),
  primary key (gruppo_id, prodotto_codice),
  constraint listino_qualcosa check (num_nonnulls(prezzo_pubblico_cent, sconto_percentuale) >= 1)
);

-- ---------------------------------------------------------------------------
-- Promozioni con calendario (attive in automatico tra inizio e fine)
-- ---------------------------------------------------------------------------
create type public.tipo_promozione as enum ('sconto_percentuale', 'sconto_merce', 'omaggio');
create type public.ambito_promozione as enum ('catalogo', 'linea', 'prodotto', 'lotto');

create table public.promozioni (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descrizione text,
  tipo public.tipo_promozione not null,
  sconto_percentuale numeric(5, 2) check (sconto_percentuale is null or sconto_percentuale between 0 and 100),
  -- sconto merce "compra N, N+M": ogni `compra` pezzi, `omaggio_quantita` pezzi gratis dello stesso lotto
  -- omaggio: ogni `compra` pezzi, `omaggio_quantita` pezzi di `omaggio_prodotto_codice`
  compra int check (compra is null or compra > 0),
  omaggio_quantita int check (omaggio_quantita is null or omaggio_quantita > 0),
  omaggio_prodotto_codice text references public.prodotti (codice),
  ambito public.ambito_promozione not null,
  prodotto_codice text references public.prodotti (codice),
  lotto_id uuid references public.lotti (id) on delete cascade,
  linea_id uuid references public.linee (id),
  gruppo_id uuid references public.gruppi (id),        -- null = tutte le farmacie
  inizio date not null,
  fine date not null,
  sospesa boolean not null default false,
  duplicata_da uuid references public.promozioni (id) on delete set null,
  creato_da uuid references auth.users (id) on delete set null,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  constraint promo_periodo check (fine >= inizio),
  constraint promo_parametri check (
    (tipo = 'sconto_percentuale' and sconto_percentuale is not null)
    or (tipo = 'sconto_merce' and compra is not null and omaggio_quantita is not null)
    or (tipo = 'omaggio' and compra is not null and omaggio_quantita is not null and omaggio_prodotto_codice is not null)
  ),
  constraint promo_ambito check (
    (ambito = 'catalogo')
    or (ambito = 'linea' and linea_id is not null)
    or (ambito = 'prodotto' and prodotto_codice is not null)
    or (ambito = 'lotto' and lotto_id is not null)
  )
);

create trigger promozioni_aggiornato before update on public.promozioni
  for each row execute function public.imposta_aggiornato_il();
create trigger promozioni_storico after update on public.promozioni
  for each row execute function public.registra_storico();

-- Righe d'ordine solo omaggio (quantità pagata 0)
alter table public.righe_ordine drop constraint righe_ordine_quantita_check;
alter table public.righe_ordine add constraint righe_ordine_quantita check (quantita >= 0 and quantita + quantita_omaggio > 0);

-- ---------------------------------------------------------------------------
-- Storico anche per prodotti e lotti (prezzi, IVA, sconti manuali)
-- ---------------------------------------------------------------------------
alter table public.prodotti add column id uuid not null default gen_random_uuid() unique;
create trigger prodotti_storico after update on public.prodotti
  for each row execute function public.registra_storico();
create trigger lotti_storico after update of sconto_manuale on public.lotti
  for each row execute function public.registra_storico();

-- ---------------------------------------------------------------------------
-- Invio al deposito e spedizioni
-- ---------------------------------------------------------------------------
create table public.invii_deposito (
  id uuid primary key default gen_random_uuid(),
  deposito_id uuid not null references public.sedi (id),
  modalita text not null check (modalita in ('singola', 'cumulativa')),
  destinatari text[] not null,
  ordini uuid[] not null,
  esito text not null check (esito in ('inviato', 'errore')),
  errore text,
  utente uuid references auth.users (id) on delete set null,
  inviato_il timestamptz not null default now()
);

alter table public.ordini
  add column invio_deposito_id uuid references public.invii_deposito (id),
  add column inviato_deposito_il timestamptz,
  add column sollecito_ddt_il timestamptz;

create table public.spedizioni (
  id uuid primary key default gen_random_uuid(),
  ordine_id uuid not null unique references public.ordini (id) on delete cascade,
  ddt_numero text not null,
  ddt_data date not null,
  corriere text,
  tracking text,
  colli int check (colli is null or colli > 0),
  ddt_pdf_path text,
  note text,
  fatturato boolean not null default false,
  fatturato_il timestamptz,
  fatturato_da uuid references auth.users (id) on delete set null,
  registrata_da uuid references auth.users (id) on delete set null,
  registrata_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

create trigger spedizioni_aggiornato before update on public.spedizioni
  for each row execute function public.imposta_aggiornato_il();
create trigger spedizioni_storico after update on public.spedizioni
  for each row execute function public.registra_storico();

create table public.righe_spedizione (
  id uuid primary key default gen_random_uuid(),
  spedizione_id uuid not null references public.spedizioni (id) on delete cascade,
  riga_ordine_id uuid references public.righe_ordine (id) on delete set null,
  lotto_id uuid references public.lotti (id),
  prodotto_codice text not null references public.prodotti (codice),
  codice_lotto text not null,
  quantita_spedita int not null check (quantita_spedita >= 0),
  nota_differenza text
);

create index righe_spedizione_lotto on public.righe_spedizione (lotto_id);

alter table public.impostazioni add column ultimo_invio_cumulativo date;

-- ---------------------------------------------------------------------------
-- Disponibilità: giacenza − impegnato negli ordini aperti − spedito dopo la data della giacenza.
-- (La merce spedita resta sottratta finché un import successivo non la comprende.)
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
         (l.giacenza - coalesce(i.impegnato, 0) - coalesce(s.spedito, 0))::int
  from public.lotti l
  left join (
    select r.lotto_id, sum(r.quantita + r.quantita_omaggio) as impegnato
    from public.righe_ordine r
    join public.ordini o on o.id = r.ordine_id
    where public.stato_ordine_aperto(o.stato)
    group by r.lotto_id
  ) i on i.lotto_id = l.id
  left join lateral (
    select sum(rs.quantita_spedita) as spedito
    from public.righe_spedizione rs
    join public.spedizioni sp on sp.id = rs.spedizione_id
    where rs.lotto_id = l.id and sp.ddt_data > l.data_giacenza
  ) s on true
  where (p_prodotto is null or l.prodotto_codice = p_prodotto)
    and (auth.uid() is null or public.farmacia_attiva() or public.e_staff());
$$;

-- ---------------------------------------------------------------------------
-- Modifica di un ordine dall'amministrazione (quantità, righe tolte, società, pagamento):
-- stessi blocchi e controlli dell'invio. Prezzi e totali arrivano da lib/pricing.
-- La disponibilità di ogni lotto comprende quanto l'ordine stesso aveva già impegnato.
-- ---------------------------------------------------------------------------
create or replace function public.modifica_ordine_admin(p_utente uuid, p_ordine uuid, p_testata jsonb, p_righe jsonb, p_messaggio text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stato public.stato_ordine;
  v_mancanti jsonb := '[]';
  v_riga record;
  v_disp int;
  v_gia int;
begin
  select stato into v_stato from public.ordini where id = p_ordine for update;
  if v_stato is null then return jsonb_build_object('esito', 'non_trovato'); end if;
  if v_stato not in ('inviato', 'in_verifica', 'confermato', 'modificato') then
    return jsonb_build_object('esito', 'stato_non_modificabile');
  end if;

  perform 1 from public.lotti
  where id in (select (x->>'lotto_id')::uuid from jsonb_array_elements(p_righe) x)
  order by id for update;

  for v_riga in
    select (x->>'lotto_id')::uuid as lotto_id, sum((x->>'quantita')::int + coalesce((x->>'quantita_omaggio')::int, 0)) as richiesta
    from jsonb_array_elements(p_righe) x group by 1
  loop
    select d.disponibile into v_disp from public.disponibilita_lotti() d where d.lotto_id = v_riga.lotto_id;
    select coalesce(sum(quantita + quantita_omaggio), 0) into v_gia from public.righe_ordine where ordine_id = p_ordine and lotto_id = v_riga.lotto_id;
    if coalesce(v_disp, 0) + v_gia < v_riga.richiesta then
      v_mancanti := v_mancanti || jsonb_build_object('lotto_id', v_riga.lotto_id, 'richiesta', v_riga.richiesta, 'disponibile', greatest(coalesce(v_disp, 0) + v_gia, 0));
    end if;
  end loop;
  if jsonb_array_length(v_mancanti) > 0 then
    return jsonb_build_object('esito', 'merce_insufficiente', 'righe', v_mancanti);
  end if;

  delete from public.righe_ordine where ordine_id = p_ordine;
  insert into public.righe_ordine (
    ordine_id, lotto_id, prodotto_codice, prodotto_nome, codice_lotto, scadenza, quantita, quantita_omaggio,
    prezzo_pubblico_cent, iva, sconto_applicato, origine_sconto, promozione_id, prezzo_pubblico_netto_cent,
    prezzo_farmacia_ivato_cent, prezzo_farmacia_netto_cent, imponibile_cent, posizione
  )
  select p_ordine, (x->>'lotto_id')::uuid, x->>'prodotto_codice', x->>'prodotto_nome', x->>'codice_lotto',
         (x->>'scadenza')::date, (x->>'quantita')::int, coalesce((x->>'quantita_omaggio')::int, 0),
         (x->>'prezzo_pubblico_cent')::int, (x->>'iva')::numeric, (x->>'sconto_applicato')::numeric,
         x->>'origine_sconto', nullif(x->>'promozione_id', '')::uuid, (x->>'prezzo_pubblico_netto_cent')::int,
         (x->>'prezzo_farmacia_ivato_cent')::int, (x->>'prezzo_farmacia_netto_cent')::int,
         (x->>'imponibile_cent')::int, n::int
  from jsonb_array_elements(p_righe) with ordinality as t(x, n);

  update public.ordini set
    stato = 'modificato',
    societa_id = (p_testata->>'societa_id')::uuid,
    modalita_pagamento_id = (p_testata->>'modalita_pagamento_id')::uuid,
    snapshot_societa = p_testata->'snapshot_societa',
    snapshot_pagamento = p_testata->'snapshot_pagamento',
    imponibile_cent = (p_testata->>'imponibile_cent')::int,
    sconti_cent = (p_testata->>'sconti_cent')::int,
    iva_cent = (p_testata->>'iva_cent')::int,
    iva_dettaglio = p_testata->'iva_dettaglio',
    totale_cent = (p_testata->>'totale_cent')::int
  where id = p_ordine;

  insert into public.storico_stati (ordine_id, da, a, utente, messaggio)
  values (p_ordine, v_stato, 'modificato', p_utente, p_messaggio);

  return jsonb_build_object('esito', 'ok');
end;
$$;

revoke execute on function public.modifica_ordine_admin(uuid, uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.modifica_ordine_admin(uuid, uuid, jsonb, jsonb, text) to service_role;

-- ---------------------------------------------------------------------------
-- Archivio dei DDT reali (PDF): privato, si scarica solo tramite il server.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ddt', 'ddt', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.modalita_pagamento_limiti enable row level security;
alter table public.listini_gruppo enable row level security;
alter table public.promozioni enable row level security;
alter table public.invii_deposito enable row level security;
alter table public.spedizioni enable row level security;
alter table public.righe_spedizione enable row level security;

-- Limitazioni e listini: la farmacia vede quelli che la riguardano (servono a carrello e prezzi).
create policy limiti_lettura on public.modalita_pagamento_limiti for select to authenticated
  using (public.e_staff() or farmacia_id = public.mia_farmacia_id()
         or gruppo_id = (select gruppo_id from public.farmacie where id = public.mia_farmacia_id()));
create policy limiti_admin on public.modalita_pagamento_limiti for all to authenticated
  using (public.e_admin()) with check (public.e_admin());

create policy listini_lettura on public.listini_gruppo for select to authenticated
  using (public.e_staff() or (public.farmacia_attiva() and gruppo_id = (select gruppo_id from public.farmacie where id = public.mia_farmacia_id())));
create policy listini_admin on public.listini_gruppo for all to authenticated
  using (public.e_admin()) with check (public.e_admin());

create policy promozioni_lettura on public.promozioni for select to authenticated
  using (public.e_staff() or (public.farmacia_attiva() and not sospesa
         and (gruppo_id is null or gruppo_id = (select gruppo_id from public.farmacie where id = public.mia_farmacia_id()))));
create policy promozioni_admin on public.promozioni for all to authenticated
  using (public.e_admin()) with check (public.e_admin());

create policy invii_staff on public.invii_deposito for select to authenticated using (public.e_staff());

-- Spedizioni: la farmacia vede quelle dei propri ordini; staff registra e aggiorna.
create policy spedizioni_lettura on public.spedizioni for select to authenticated
  using (public.e_staff() or exists (select 1 from public.ordini o where o.id = ordine_id and o.farmacia_id = public.mia_farmacia_id()));
create policy spedizioni_staff on public.spedizioni for all to authenticated
  using (public.e_staff()) with check (public.e_staff());
create policy righe_spedizione_lettura on public.righe_spedizione for select to authenticated
  using (exists (select 1 from public.spedizioni s join public.ordini o on o.id = s.ordine_id
                 where s.id = spedizione_id and (public.e_staff() or o.farmacia_id = public.mia_farmacia_id())));
create policy righe_spedizione_staff on public.righe_spedizione for all to authenticated
  using (public.e_staff()) with check (public.e_staff());

-- Contenuto letto dal file, conservato tra anteprima e conferma dell'import
alter table public.import_magazzino add column contenuto jsonb;
