-- Magistra – Fase 8: area Medici (docs/AREA_MEDICI.md).
-- Medici con approvazione dell'amministrazione, materiale scientifico in PDF, richieste di campioni gratuiti.
-- I medici non vedono prezzi: schede prodotto e testi si leggono dal server con campi scelti, mai la tabella prodotti.

-- ---------------------------------------------------------------------------
-- Medici
-- ---------------------------------------------------------------------------
create type public.stato_medico as enum ('in_attesa', 'attivo', 'bloccato');

create table public.medici (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 80),
  cognome text not null check (length(trim(cognome)) between 1 and 80),
  specializzazione text not null check (length(trim(specializzazione)) between 2 and 120),
  numero_iscrizione text not null check (numero_iscrizione ~ '^[0-9A-Za-z/.\-]{1,20}$'),
  ordine_provincia text not null check (ordine_provincia ~ '^[A-Z]{2}$'),
  email text not null,
  telefono text not null,
  -- Studio o struttura: serve anche come indirizzo di spedizione dei campioni
  struttura text,
  presso text,
  indirizzo text not null,
  cap text not null check (cap ~ '^[0-9]{5}$'),
  citta text not null,
  provincia text not null check (provincia ~ '^[A-Z]{2}$'),
  stato public.stato_medico not null default 'in_attesa',
  approvato_da uuid references auth.users (id) on delete set null,
  approvato_il timestamptz,
  bloccato_il timestamptz,
  motivo_blocco text,
  note_admin text,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  constraint medici_iscrizione_unica unique (ordine_provincia, numero_iscrizione)
);
create trigger medici_aggiornato before update on public.medici
  for each row execute function public.imposta_aggiornato_il();
create trigger medici_storico after update on public.medici
  for each row execute function public.registra_storico();

alter table public.profili_utente add column medico_id uuid references public.medici (id);

create or replace function public.mio_medico_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select medico_id from public.profili_utente where id = auth.uid();
$$;

create or replace function public.medico_attivo()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select m.stato = 'attivo' from public.profili_utente p join public.medici m on m.id = p.medico_id where p.id = auth.uid()
  ), false);
$$;
revoke execute on function public.mio_medico_id() from public, anon;
revoke execute on function public.medico_attivo() from public, anon;
grant execute on function public.mio_medico_id() to authenticated, service_role;
grant execute on function public.medico_attivo() to authenticated, service_role;

-- Il medico aggiorna recapiti e indirizzo; dati identificativi e stato solo dall'amministrazione.
create or replace function public.medici_protegge_campi()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null or public.e_admin() then return new; end if;
  if new.nome is distinct from old.nome or new.cognome is distinct from old.cognome
     or new.numero_iscrizione is distinct from old.numero_iscrizione or new.ordine_provincia is distinct from old.ordine_provincia
     or new.stato is distinct from old.stato or new.approvato_da is distinct from old.approvato_da
     or new.approvato_il is distinct from old.approvato_il or new.bloccato_il is distinct from old.bloccato_il
     or new.motivo_blocco is distinct from old.motivo_blocco or new.note_admin is distinct from old.note_admin then
    raise exception 'Questi dati possono essere modificati solo dall''amministrazione Magistra';
  end if;
  return new;
end;
$$;
create trigger medici_protegge before update on public.medici
  for each row execute function public.medici_protegge_campi();

-- Registrazione in un'unica transazione: medico, profilo, consensi (privacy obbligatoria, marketing facoltativo)
create or replace function public.registra_medico(p_utente uuid, p_email text, p_medico jsonb, p_marketing boolean, p_ip text, p_user_agent text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_medico uuid;
  v_privacy public.documenti_legali;
begin
  v_privacy := public.documento_legale_corrente('privacy');
  if v_privacy.id is null then raise exception 'Informativa privacy non configurata'; end if;

  insert into public.medici (nome, cognome, specializzazione, numero_iscrizione, ordine_provincia, email, telefono, struttura, presso, indirizzo, cap, citta, provincia)
  values (p_medico->>'nome', p_medico->>'cognome', p_medico->>'specializzazione', p_medico->>'numero_iscrizione', p_medico->>'ordine_provincia',
          p_email, p_medico->>'telefono', nullif(p_medico->>'struttura', ''), nullif(p_medico->>'presso', ''),
          p_medico->>'indirizzo', p_medico->>'cap', p_medico->>'citta', p_medico->>'provincia')
  returning id into v_medico;

  insert into public.profili_utente (id, ruolo, nome, email, medico_id)
  values (p_utente, 'medico', (p_medico->>'nome') || ' ' || (p_medico->>'cognome'), p_email, v_medico);

  insert into public.consensi (utente_id, tipo, accettato, documento_id, versione_documento, ip, user_agent)
  values
    (p_utente, 'privacy', true, v_privacy.id, v_privacy.versione, p_ip, p_user_agent),
    (p_utente, 'marketing', p_marketing, v_privacy.id, v_privacy.versione, p_ip, p_user_agent);
  return v_medico;
end;
$$;
revoke execute on function public.registra_medico(uuid, text, jsonb, boolean, text, text) from public, anon, authenticated;
grant execute on function public.registra_medico(uuid, text, jsonb, boolean, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Materiale scientifico (PDF in un archivio privato: si scarica solo dal server dopo i controlli)
-- ---------------------------------------------------------------------------
create type public.tipo_materiale as enum ('studio', 'brochure', 'scheda_tecnica', 'altro');

create table public.materiali_medici (
  id uuid primary key default gen_random_uuid(),
  titolo text not null check (length(trim(titolo)) between 2 and 200),
  descrizione text,
  tipo public.tipo_materiale not null default 'altro',
  prodotto_codice text references public.prodotti (codice) on delete set null,
  file_path text not null,
  file_nome text not null,
  dimensione_byte int,
  pubblicato boolean not null default false,
  creato_da uuid references auth.users (id) on delete set null,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);
create trigger materiali_medici_aggiornato before update on public.materiali_medici
  for each row execute function public.imposta_aggiornato_il();
create trigger materiali_medici_storico after update on public.materiali_medici
  for each row execute function public.registra_storico();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materiali', 'materiali', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Richieste di campioni gratuiti
-- ---------------------------------------------------------------------------
create type public.stato_campione as enum ('nuova', 'in_lavorazione', 'spedita', 'non_accolta');

alter table public.impostazioni
  add column campioni_max_confezioni int not null default 5 check (campioni_max_confezioni between 1 and 50);

create table public.richieste_campioni (
  id uuid primary key default gen_random_uuid(),
  medico_id uuid not null references public.medici (id) on delete cascade,
  prodotto_codice text not null references public.prodotti (codice),
  prodotto_nome text not null,
  quantita int not null check (quantita between 1 and 50),
  note text check (note is null or length(note) <= 1000),
  -- Fotografia dell'indirizzo di spedizione al momento della richiesta
  spedizione jsonb not null,
  stato public.stato_campione not null default 'nuova',
  messaggio_admin text,
  gestita_da uuid references auth.users (id) on delete set null,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);
create index richieste_campioni_medico on public.richieste_campioni (medico_id, creato_il desc);
create index richieste_campioni_stato on public.richieste_campioni (stato, creato_il);
create trigger richieste_campioni_aggiornato before update on public.richieste_campioni
  for each row execute function public.imposta_aggiornato_il();
create trigger richieste_campioni_storico after update on public.richieste_campioni
  for each row execute function public.registra_storico();

-- Assistente: conversazioni anche dei medici
alter table public.conversazioni add column medico_id uuid references public.medici (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.medici enable row level security;
alter table public.materiali_medici enable row level security;
alter table public.richieste_campioni enable row level security;

create policy medici_lettura on public.medici for select to authenticated using (id = public.mio_medico_id() or public.e_staff());
create policy medici_aggiorna_proprio on public.medici for update to authenticated
  using (id = public.mio_medico_id()) with check (id = public.mio_medico_id());
create policy medici_admin on public.medici for all to authenticated using (public.e_admin()) with check (public.e_admin());

create policy materiali_lettura on public.materiali_medici for select to authenticated
  using ((pubblicato and public.medico_attivo()) or public.e_staff());
create policy materiali_admin on public.materiali_medici for all to authenticated using (public.e_admin()) with check (public.e_admin());

create policy campioni_lettura on public.richieste_campioni for select to authenticated
  using (medico_id = public.mio_medico_id() or public.e_staff());
create policy campioni_richiesta on public.richieste_campioni for insert to authenticated
  with check (medico_id = public.mio_medico_id() and public.medico_attivo() and stato = 'nuova' and gestita_da is null and messaggio_admin is null);
create policy campioni_staff on public.richieste_campioni for update to authenticated using (public.e_staff()) with check (public.e_staff());
