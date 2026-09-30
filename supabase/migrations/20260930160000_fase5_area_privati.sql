-- Magistra – Fase 5: area Privati (B2C), docs/AREA_PRIVATI.md.
-- Clienti privati, sconti del mese, spese di spedizione, carrello per prodotto (il lotto lo assegna il sistema),
-- ordini privati nello stesso flusso ordini/deposito, blocco dell'attivazione online.

create type public.stato_privato as enum ('attivo', 'bloccato');
create type public.ambito_sconto_privati as enum ('catalogo', 'linea', 'prodotto');

-- ---------------------------------------------------------------------------
-- Clienti privati
-- ---------------------------------------------------------------------------
create table public.privati (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cognome text not null,
  codice_fiscale text not null check (codice_fiscale ~ '^[A-Z0-9]{16}$' and public.codice_fiscale_valido(codice_fiscale)),
  email text not null,
  telefono text not null,
  stato public.stato_privato not null default 'attivo',
  bloccato_il timestamptz,
  motivo_blocco text,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

create trigger privati_aggiornato before update on public.privati
  for each row execute function public.imposta_aggiornato_il();
create trigger privati_storico after update on public.privati
  for each row execute function public.registra_storico();

alter table public.indirizzi
  add constraint indirizzi_privato_fk foreign key (privato_id) references public.privati (id) on delete cascade;
create unique index indirizzi_privato_tipo on public.indirizzi (privato_id, tipo) where privato_id is not null;

alter table public.profili_utente
  add constraint profili_utente_privato_fk foreign key (privato_id) references public.privati (id);

create or replace function public.mio_privato_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select privato_id from public.profili_utente where id = auth.uid();
$$;

create or replace function public.privato_attivo()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select pr.stato = 'attivo' from public.profili_utente p join public.privati pr on pr.id = p.privato_id where p.id = auth.uid()
  ), false);
$$;

-- Il privato aggiorna recapiti e indirizzi, non nome, codice fiscale né stato.
create or replace function public.privati_protegge_campi()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null or public.e_admin() then return new; end if;
  if new.nome is distinct from old.nome or new.cognome is distinct from old.cognome
     or new.codice_fiscale is distinct from old.codice_fiscale or new.stato is distinct from old.stato
     or new.bloccato_il is distinct from old.bloccato_il or new.motivo_blocco is distinct from old.motivo_blocco then
    raise exception 'Questi dati possono essere modificati solo dall''assistenza Magistra';
  end if;
  return new;
end;
$$;
create trigger privati_protegge before update on public.privati
  for each row execute function public.privati_protegge_campi();

-- ---------------------------------------------------------------------------
-- Sconti privati del mese (vale il migliore, mai la somma) e spese di spedizione
-- ---------------------------------------------------------------------------
create table public.sconti_privati (
  id uuid primary key default gen_random_uuid(),
  ambito public.ambito_sconto_privati not null,
  linea_id uuid references public.linee (id),
  prodotto_codice text references public.prodotti (codice) on delete cascade,
  sconto_percentuale numeric(5, 2) not null check (sconto_percentuale > 0 and sconto_percentuale <= 100),
  inizio date not null,
  fine date not null,
  copiato_da uuid references public.sconti_privati (id) on delete set null,
  creato_da uuid references auth.users (id) on delete set null,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  constraint sconti_privati_periodo check (fine >= inizio),
  constraint sconti_privati_ambito check (
    (ambito = 'catalogo' and linea_id is null and prodotto_codice is null)
    or (ambito = 'linea' and linea_id is not null)
    or (ambito = 'prodotto' and prodotto_codice is not null)
  )
);
create index sconti_privati_periodo_idx on public.sconti_privati (inizio, fine);
create trigger sconti_privati_aggiornato before update on public.sconti_privati
  for each row execute function public.imposta_aggiornato_il();
create trigger sconti_privati_storico after update on public.sconti_privati
  for each row execute function public.registra_storico();

create table public.spese_spedizione (
  id uuid primary key default gen_random_uuid(),
  canale public.canale not null unique,
  importo_cent int check (importo_cent is null or importo_cent >= 0),        -- IVA inclusa; null = non ancora indicate
  soglia_gratuita_cent int check (soglia_gratuita_cent is null or soglia_gratuita_cent > 0),
  iva numeric(5, 2) not null default 22 check (iva between 0 and 100),
  attiva boolean not null default true,
  aggiornato_il timestamptz not null default now()
);
create trigger spese_spedizione_aggiornato before update on public.spese_spedizione
  for each row execute function public.imposta_aggiornato_il();
insert into public.spese_spedizione (canale) values ('privati');

alter table public.impostazioni add column ultimo_promemoria_sconti date;

-- Prodotti: visibili ai privati di norma sì (se hanno un prezzo)
alter table public.prodotti alter column visibile_privati set default true;
update public.prodotti set visibile_privati = true where prezzo_pubblico_cent is not null;

-- ---------------------------------------------------------------------------
-- Blocco dell'attivazione online: servono spese di spedizione e condizioni privati definitive
-- ---------------------------------------------------------------------------
create or replace function public.area_privati_attivabile()
returns text language sql stable security definer set search_path = '' as $$
  select case
    when not exists (select 1 from public.spese_spedizione where canale = 'privati' and attiva and importo_cent is not null)
      then 'Mancano le spese di spedizione per i privati'
    when coalesce((public.documento_legale_corrente('condizioni_privati')).provvisorio, true)
      then 'Mancano le condizioni di vendita per i privati validate da un legale (il testo attuale è provvisorio)'
    else null
  end;
$$;

create or replace function public.impostazioni_blocca_privati()
returns trigger language plpgsql set search_path = '' as $$
declare v_motivo text;
begin
  if new.area_privati_attiva and not old.area_privati_attiva then
    v_motivo := public.area_privati_attivabile();
    if v_motivo is not null then
      raise exception 'Area Privati non attivabile: %', v_motivo;
    end if;
  end if;
  return new;
end;
$$;
create trigger impostazioni_blocca_privati before update on public.impostazioni
  for each row execute function public.impostazioni_blocca_privati();

-- ---------------------------------------------------------------------------
-- Carrello privati: per prodotto (il lotto si assegna all'invio)
-- ---------------------------------------------------------------------------
create table public.carrello_privati (
  privato_id uuid not null references public.privati (id) on delete cascade,
  prodotto_codice text not null references public.prodotti (codice) on delete cascade,
  quantita int not null check (quantita > 0 and quantita <= 99),
  aggiunto_il timestamptz not null default now(),
  primary key (privato_id, prodotto_codice)
);

alter table public.ordini add constraint ordini_privato_fk foreign key (privato_id) references public.privati (id);
create index ordini_privato on public.ordini (privato_id, creato_il desc);

-- ---------------------------------------------------------------------------
-- Registrazione del privato: tutto in un'unica transazione (chiave di servizio)
-- ---------------------------------------------------------------------------
create or replace function public.registra_privato(
  p_utente uuid, p_email text, p_privato jsonb, p_spedizione jsonb, p_fatturazione jsonb,
  p_marketing boolean, p_ip text, p_user_agent text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_privato uuid;
  v_privacy public.documenti_legali;
  v_condizioni public.documenti_legali;
begin
  v_privacy := public.documento_legale_corrente('privacy');
  v_condizioni := public.documento_legale_corrente('condizioni_privati');
  if v_privacy.id is null or v_condizioni.id is null then
    raise exception 'Informativa privacy o condizioni di vendita privati non configurate';
  end if;

  insert into public.privati (nome, cognome, codice_fiscale, email, telefono)
  values (p_privato->>'nome', p_privato->>'cognome', p_privato->>'codice_fiscale', p_email, p_privato->>'telefono')
  returning id into v_privato;

  insert into public.indirizzi (privato_id, tipo, presso, indirizzo, cap, citta, provincia)
  select v_privato, t.tipo, nullif(t.dati->>'presso', ''), t.dati->>'indirizzo', t.dati->>'cap', t.dati->>'citta', t.dati->>'provincia'
  from (values ('consegna'::public.tipo_indirizzo, p_spedizione), ('fatturazione'::public.tipo_indirizzo, p_fatturazione)) as t(tipo, dati);

  insert into public.profili_utente (id, ruolo, nome, email, privato_id)
  values (p_utente, 'privato', (p_privato->>'nome') || ' ' || (p_privato->>'cognome'), p_email, v_privato);

  insert into public.consensi (utente_id, tipo, accettato, documento_id, versione_documento, ip, user_agent)
  values
    (p_utente, 'privacy', true, v_privacy.id, v_privacy.versione, p_ip, p_user_agent),
    (p_utente, 'condizioni_vendita_privati', true, v_condizioni.id, v_condizioni.versione, p_ip, p_user_agent),
    (p_utente, 'marketing', p_marketing, v_privacy.id, v_privacy.versione, p_ip, p_user_agent);
  return v_privato;
end;
$$;
revoke execute on function public.registra_privato(uuid, text, jsonb, jsonb, jsonb, boolean, text, text) from public, anon, authenticated;
grant execute on function public.registra_privato(uuid, text, jsonb, jsonb, jsonb, boolean, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Invio dell'ordine del privato: stessi blocchi e controlli delle farmacie.
-- Lotti assegnati e prezzi arrivano da lib/availability e lib/pricing.
-- ---------------------------------------------------------------------------
create or replace function public.invia_ordine_privato(p_utente uuid, p_ordine jsonb, p_righe jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_privato uuid;
  v_stato public.stato_privato;
  v_mancanti jsonb := '[]';
  v_riga record;
  v_disponibile int;
  v_anno int := extract(year from now() at time zone 'Europe/Rome')::int;
  v_progressivo int;
  v_numero text;
  v_ordine uuid;
begin
  select p.privato_id, pr.stato into v_privato, v_stato
  from public.profili_utente p join public.privati pr on pr.id = p.privato_id where p.id = p_utente;
  if v_privato is null or v_stato <> 'attivo' then
    return jsonb_build_object('esito', 'cliente_non_attivo');
  end if;

  perform 1 from public.lotti
  where id in (select (x->>'lotto_id')::uuid from jsonb_array_elements(p_righe) x)
  order by id for update;

  for v_riga in
    select (x->>'lotto_id')::uuid as lotto_id, sum((x->>'quantita')::int) as richiesta
    from jsonb_array_elements(p_righe) x group by 1
  loop
    select d.disponibile into v_disponibile from public.disponibilita_lotti() d where d.lotto_id = v_riga.lotto_id;
    if coalesce(v_disponibile, 0) < v_riga.richiesta then
      v_mancanti := v_mancanti || jsonb_build_object('lotto_id', v_riga.lotto_id);
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
    numero, canale, privato_id, societa_id, deposito_id, stato, modalita_pagamento_id, note,
    consegna_indicativa_giorni, snapshot_cliente, snapshot_societa, snapshot_pagamento,
    condizioni_documento_id, condizioni_versione, imponibile_cent, sconti_cent, iva_cent, iva_dettaglio,
    spese_spedizione_cent, totale_cent, creato_da
  ) values (
    v_numero, 'privati', v_privato, (p_ordine->>'societa_id')::uuid, (p_ordine->>'deposito_id')::uuid, 'inviato',
    (p_ordine->>'modalita_pagamento_id')::uuid, nullif(p_ordine->>'note', ''),
    (p_ordine->>'consegna_indicativa_giorni')::int, p_ordine->'snapshot_cliente', p_ordine->'snapshot_societa',
    p_ordine->'snapshot_pagamento', (p_ordine->>'condizioni_documento_id')::uuid, (p_ordine->>'condizioni_versione')::int,
    (p_ordine->>'imponibile_cent')::int, (p_ordine->>'sconti_cent')::int, (p_ordine->>'iva_cent')::int,
    coalesce(p_ordine->'iva_dettaglio', '[]'), (p_ordine->>'spese_spedizione_cent')::int, (p_ordine->>'totale_cent')::int, p_utente
  ) returning id into v_ordine;

  insert into public.righe_ordine (
    ordine_id, lotto_id, prodotto_codice, prodotto_nome, codice_lotto, scadenza, quantita, quantita_omaggio,
    prezzo_pubblico_cent, iva, sconto_applicato, origine_sconto, prezzo_pubblico_netto_cent,
    prezzo_farmacia_ivato_cent, prezzo_farmacia_netto_cent, imponibile_cent, posizione
  )
  select v_ordine, (x->>'lotto_id')::uuid, x->>'prodotto_codice', x->>'prodotto_nome', x->>'codice_lotto',
         (x->>'scadenza')::date, (x->>'quantita')::int, 0, (x->>'prezzo_pubblico_cent')::int, (x->>'iva')::numeric,
         (x->>'sconto_applicato')::numeric, 'sconto_privati', (x->>'prezzo_pubblico_netto_cent')::int,
         (x->>'prezzo_farmacia_ivato_cent')::int, (x->>'prezzo_farmacia_netto_cent')::int, (x->>'imponibile_cent')::int, n::int
  from jsonb_array_elements(p_righe) with ordinality as t(x, n);

  insert into public.storico_stati (ordine_id, da, a, utente, messaggio)
  values (v_ordine, null, 'inviato', p_utente, 'Ordine inviato dal cliente');
  delete from public.carrello_privati where privato_id = v_privato;
  return jsonb_build_object('esito', 'ok', 'ordine_id', v_ordine, 'numero', v_numero);
end;
$$;
revoke execute on function public.invia_ordine_privato(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.invia_ordine_privato(uuid, jsonb, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.privati enable row level security;
alter table public.sconti_privati enable row level security;
alter table public.spese_spedizione enable row level security;
alter table public.carrello_privati enable row level security;

create policy privati_lettura on public.privati for select to authenticated using (id = public.mio_privato_id() or public.e_staff());
create policy privati_aggiorna_proprio on public.privati for update to authenticated
  using (id = public.mio_privato_id()) with check (id = public.mio_privato_id());
create policy privati_admin on public.privati for all to authenticated using (public.e_admin()) with check (public.e_admin());

create policy indirizzi_privati_lettura on public.indirizzi for select to authenticated using (privato_id = public.mio_privato_id());
create policy indirizzi_privati_propri on public.indirizzi for update to authenticated
  using (privato_id = public.mio_privato_id()) with check (privato_id = public.mio_privato_id());

create policy sconti_privati_staff on public.sconti_privati for select to authenticated using (public.e_staff());
create policy sconti_privati_admin on public.sconti_privati for all to authenticated using (public.e_admin()) with check (public.e_admin());
create policy spese_lettura on public.spese_spedizione for select to authenticated using (true);
create policy spese_admin on public.spese_spedizione for all to authenticated using (public.e_admin()) with check (public.e_admin());

create policy carrello_privati_proprio on public.carrello_privati for all to authenticated
  using (privato_id = public.mio_privato_id() and public.privato_attivo())
  with check (privato_id = public.mio_privato_id() and public.privato_attivo());

-- Ordini, righe, storico e spedizioni: anche il privato vede i propri
drop policy ordini_lettura on public.ordini;
create policy ordini_lettura on public.ordini for select to authenticated
  using (farmacia_id = public.mia_farmacia_id() or privato_id = public.mio_privato_id() or public.e_staff());

create or replace function public.ordine_visibile(p_ordine uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.ordini o where o.id = p_ordine
      and (public.e_staff() or o.farmacia_id = public.mia_farmacia_id() or o.privato_id = public.mio_privato_id())
  );
$$;

drop policy righe_lettura on public.righe_ordine;
create policy righe_lettura on public.righe_ordine for select to authenticated using (public.ordine_visibile(ordine_id));
drop policy storico_stati_lettura on public.storico_stati;
create policy storico_stati_lettura on public.storico_stati for select to authenticated using (public.ordine_visibile(ordine_id));
drop policy spedizioni_lettura on public.spedizioni;
create policy spedizioni_lettura on public.spedizioni for select to authenticated using (public.ordine_visibile(ordine_id));
drop policy righe_spedizione_lettura on public.righe_spedizione;
create policy righe_spedizione_lettura on public.righe_spedizione for select to authenticated
  using (exists (select 1 from public.spedizioni s where s.id = spedizione_id and public.ordine_visibile(s.ordine_id)));
