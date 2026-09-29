-- Magistra – Fase 1: registrazione e accesso farmacie.
-- Farmacie e indirizzi, gruppi, testi legali con versioni, consensi, storico modifiche
-- unico per le anagrafiche (società, sedi, farmacie, gruppi).

-- ---------------------------------------------------------------------------
-- Tipi
-- ---------------------------------------------------------------------------
create type public.stato_farmacia as enum ('in_attesa', 'attiva', 'bloccata');
create type public.tipo_indirizzo as enum ('consegna', 'fatturazione');
create type public.tipo_documento_legale as enum ('privacy', 'condizioni_farmacie', 'condizioni_privati');
create type public.tipo_consenso as enum ('privacy', 'condizioni_vendita_farmacie', 'condizioni_vendita_privati', 'marketing');

-- ---------------------------------------------------------------------------
-- Codice fiscale: 11 cifre (= partita IVA) oppure 16 caratteri con carattere di controllo
-- (stesse regole di lib/validazione.ts, omocodie comprese)
-- ---------------------------------------------------------------------------
create or replace function public.codice_fiscale_valido(cf text)
returns boolean
language plpgsql
immutable
as $$
declare
  s text := upper(regexp_replace(coalesce(cf, ''), '\s', '', 'g'));
  dispari int[] := array[1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23];
  somma int := 0;
  c text;
  v int;
  i int;
begin
  if s ~ '^[0-9]{11}$' then
    return public.partita_iva_valida(s);
  end if;
  if s !~ '^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$' then
    return false;
  end if;
  for i in 1..15 loop
    c := substr(s, i, 1);
    v := case when c between '0' and '9' then ascii(c) - 48 else ascii(c) - 65 end;
    if i % 2 = 1 then
      somma := somma + dispari[v + 1];
    else
      somma := somma + v;
    end if;
  end loop;
  return chr(65 + somma % 26) = substr(s, 16, 1);
end;
$$;

-- ---------------------------------------------------------------------------
-- Storico modifiche unico (sostituisce societa_storico della Fase 0)
-- ---------------------------------------------------------------------------
create table public.storico_modifiche (
  id bigint generated always as identity primary key,
  tabella text not null,
  record_id uuid not null,
  prima jsonb,
  dopo jsonb,
  utente uuid,
  il timestamptz not null default now()
);

create index storico_modifiche_record on public.storico_modifiche (tabella, record_id, il desc);

insert into public.storico_modifiche (tabella, record_id, prima, dopo, utente, il)
select 'societa', societa_id, prima, dopo, utente, il from public.societa_storico;

drop trigger societa_storico_trg on public.societa;
drop function public.registra_storico_societa();
drop table public.societa_storico;

-- Registra la riga prima e dopo ogni modifica, ignorando i cambi del solo aggiornato_il.
create or replace function public.registra_storico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (to_jsonb(old) - 'aggiornato_il') is distinct from (to_jsonb(new) - 'aggiornato_il') then
    insert into public.storico_modifiche (tabella, record_id, prima, dopo, utente)
    values (tg_table_name, new.id, to_jsonb(old), to_jsonb(new), auth.uid());
  end if;
  return new;
end;
$$;

create trigger societa_storico after update on public.societa
  for each row execute function public.registra_storico();
create trigger sedi_storico after update on public.sedi
  for each row execute function public.registra_storico();

create trigger storico_non_modificabile before update or delete on public.storico_modifiche
  for each row execute function public.blocca_modifica_registro();

-- ---------------------------------------------------------------------------
-- Gruppi di farmacie (clienti storici, catene, …): i listini dedicati arrivano in Fase 3
-- ---------------------------------------------------------------------------
create table public.gruppi (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descrizione text,
  attivo boolean not null default true,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

create trigger gruppi_aggiornato before update on public.gruppi
  for each row execute function public.imposta_aggiornato_il();
create trigger gruppi_storico after update on public.gruppi
  for each row execute function public.registra_storico();
create trigger gruppi_no_delete before delete on public.gruppi
  for each row execute function public.blocca_cancellazione();

-- ---------------------------------------------------------------------------
-- Farmacie
-- ---------------------------------------------------------------------------
create table public.farmacie (
  id uuid primary key default gen_random_uuid(),
  ragione_sociale text not null,
  titolare text not null,
  partita_iva text not null check (public.partita_iva_valida(partita_iva)),
  codice_fiscale text not null check (public.codice_fiscale_valido(codice_fiscale)),
  codice_farmacia text not null unique,
  sdi text check (sdi is null or sdi ~ '^[A-Z0-9]{7}$'),
  pec text,
  email text not null,
  telefono text not null,
  stato public.stato_farmacia not null default 'in_attesa',
  gruppo_id uuid references public.gruppi (id),
  societa_predefinita_id uuid references public.societa (id),   -- null = predefinita del portale
  approvata_da uuid references auth.users (id) on delete set null,
  approvata_il timestamptz,
  bloccata_il timestamptz,
  motivo_blocco text,
  note_admin text,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  constraint farmacie_sdi_o_pec check (sdi is not null or pec is not null)
);

create index farmacie_stato on public.farmacie (stato, creato_il desc);

create trigger farmacie_aggiornato before update on public.farmacie
  for each row execute function public.imposta_aggiornato_il();
create trigger farmacie_storico after update on public.farmacie
  for each row execute function public.registra_storico();

-- Indirizzi di consegna e fatturazione (i privati si aggiungono in Fase 5)
create table public.indirizzi (
  id uuid primary key default gen_random_uuid(),
  farmacia_id uuid references public.farmacie (id) on delete cascade,
  privato_id uuid,
  tipo public.tipo_indirizzo not null,
  presso text,
  indirizzo text not null,
  cap text not null check (cap ~ '^[0-9]{5}$'),
  citta text not null,
  provincia text not null check (provincia ~ '^[A-Z]{2}$'),
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  constraint indirizzi_un_titolare check (num_nonnulls(farmacia_id, privato_id) = 1)
);

create unique index indirizzi_farmacia_tipo on public.indirizzi (farmacia_id, tipo) where farmacia_id is not null;

create trigger indirizzi_aggiornato before update on public.indirizzi
  for each row execute function public.imposta_aggiornato_il();

alter table public.profili_utente add column email text;
alter table public.profili_utente
  add constraint profili_utente_farmacia_fk foreign key (farmacia_id) references public.farmacie (id);

-- Funzioni di supporto per le policy (security definer: niente ricorsione sulla RLS)
create or replace function public.mia_farmacia_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select farmacia_id from public.profili_utente where id = auth.uid();
$$;

create or replace function public.farmacia_attiva()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select f.stato = 'attiva'
    from public.profili_utente p join public.farmacie f on f.id = p.farmacia_id
    where p.id = auth.uid()
  ), false);
$$;

-- La farmacia aggiorna i propri recapiti ma non i dati identificativi né quelli gestiti dall'admin.
create or replace function public.farmacie_protegge_campi()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or public.e_admin() then
    return new;
  end if;
  if new.ragione_sociale is distinct from old.ragione_sociale
     or new.partita_iva is distinct from old.partita_iva
     or new.codice_fiscale is distinct from old.codice_fiscale
     or new.codice_farmacia is distinct from old.codice_farmacia
     or new.stato is distinct from old.stato
     or new.gruppo_id is distinct from old.gruppo_id
     or new.societa_predefinita_id is distinct from old.societa_predefinita_id
     or new.approvata_da is distinct from old.approvata_da
     or new.approvata_il is distinct from old.approvata_il
     or new.bloccata_il is distinct from old.bloccata_il
     or new.motivo_blocco is distinct from old.motivo_blocco
     or new.note_admin is distinct from old.note_admin then
    raise exception 'Questi dati possono essere modificati solo dall''amministrazione Magistra';
  end if;
  return new;
end;
$$;

create trigger farmacie_protegge before update on public.farmacie
  for each row execute function public.farmacie_protegge_campi();

-- ---------------------------------------------------------------------------
-- Testi legali con versioni (informativa privacy, condizioni di vendita)
-- Una versione pubblicata non si modifica: se ne crea una nuova.
-- ---------------------------------------------------------------------------
create table public.documenti_legali (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_documento_legale not null,
  versione int not null,
  titolo text not null,
  testo text not null,
  provvisorio boolean not null default false,   -- segnaposto in attesa del testo del legale
  in_vigore_dal timestamptz not null default now(),
  creato_da uuid references auth.users (id),
  creato_il timestamptz not null default now(),
  unique (tipo, versione)
);

create trigger documenti_legali_non_modificabili before update or delete on public.documenti_legali
  for each row execute function public.blocca_modifica_registro();

create or replace function public.documento_legale_corrente(p_tipo public.tipo_documento_legale)
returns public.documenti_legali
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.documenti_legali
  where tipo = p_tipo and in_vigore_dal <= now()
  order by versione desc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Consensi (versionati, con data e IP)
-- ---------------------------------------------------------------------------
create table public.consensi (
  id bigint generated always as identity primary key,
  utente_id uuid not null references auth.users (id) on delete cascade,
  tipo public.tipo_consenso not null,
  accettato boolean not null,
  documento_id uuid references public.documenti_legali (id),
  versione_documento int,
  ip text,
  user_agent text,
  il timestamptz not null default now()
);

create index consensi_utente on public.consensi (utente_id, tipo, il desc);

-- Non modificabili; si cancellano solo insieme all'account (diritto alla cancellazione, GDPR).
create trigger consensi_non_modificabili before update on public.consensi
  for each row execute function public.blocca_modifica_registro();

-- ---------------------------------------------------------------------------
-- Impostazioni: destinatari delle notifiche all'amministrazione
-- (vuoto = tutti gli utenti con ruolo admin)
-- ---------------------------------------------------------------------------
alter table public.impostazioni add column email_notifiche_admin text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- Registrazione farmacia: tutto in un'unica transazione.
-- La chiama solo il server (chiave di servizio) dopo aver creato l'utente in Supabase Auth.
-- ---------------------------------------------------------------------------
create or replace function public.registra_farmacia(
  p_utente uuid,
  p_email text,
  p_farmacia jsonb,
  p_consegna jsonb,
  p_fatturazione jsonb,
  p_marketing boolean,
  p_ip text,
  p_user_agent text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_farmacia uuid;
  v_privacy public.documenti_legali;
  v_condizioni public.documenti_legali;
begin
  v_privacy := public.documento_legale_corrente('privacy');
  v_condizioni := public.documento_legale_corrente('condizioni_farmacie');
  if v_privacy.id is null or v_condizioni.id is null then
    raise exception 'Informativa privacy o condizioni di vendita farmacie non configurate';
  end if;

  insert into public.farmacie (ragione_sociale, titolare, partita_iva, codice_fiscale, codice_farmacia, sdi, pec, email, telefono)
  values (
    p_farmacia->>'ragione_sociale', p_farmacia->>'titolare', p_farmacia->>'partita_iva',
    p_farmacia->>'codice_fiscale', p_farmacia->>'codice_farmacia',
    nullif(p_farmacia->>'sdi', ''), nullif(p_farmacia->>'pec', ''),
    p_email, p_farmacia->>'telefono'
  )
  returning id into v_farmacia;

  insert into public.indirizzi (farmacia_id, tipo, presso, indirizzo, cap, citta, provincia)
  select v_farmacia, t.tipo, nullif(t.dati->>'presso', ''), t.dati->>'indirizzo', t.dati->>'cap', t.dati->>'citta', t.dati->>'provincia'
  from (values ('consegna'::public.tipo_indirizzo, p_consegna), ('fatturazione'::public.tipo_indirizzo, p_fatturazione)) as t(tipo, dati);

  insert into public.profili_utente (id, ruolo, nome, email, farmacia_id)
  values (p_utente, 'farmacia', p_farmacia->>'titolare', p_email, v_farmacia);

  insert into public.consensi (utente_id, tipo, accettato, documento_id, versione_documento, ip, user_agent)
  values
    (p_utente, 'privacy', true, v_privacy.id, v_privacy.versione, p_ip, p_user_agent),
    (p_utente, 'condizioni_vendita_farmacie', true, v_condizioni.id, v_condizioni.versione, p_ip, p_user_agent),
    (p_utente, 'marketing', p_marketing, v_privacy.id, v_privacy.versione, p_ip, p_user_agent);

  return v_farmacia;
end;
$$;

revoke execute on function public.registra_farmacia(uuid, text, jsonb, jsonb, jsonb, boolean, text, text) from public, anon, authenticated;
grant execute on function public.registra_farmacia(uuid, text, jsonb, jsonb, jsonb, boolean, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.storico_modifiche enable row level security;
alter table public.gruppi enable row level security;
alter table public.farmacie enable row level security;
alter table public.indirizzi enable row level security;
alter table public.documenti_legali enable row level security;
alter table public.consensi enable row level security;

create policy storico_admin on public.storico_modifiche for select to authenticated using (public.e_admin());

create policy gruppi_lettura on public.gruppi for select to authenticated using (public.e_staff());
create policy gruppi_admin on public.gruppi for all to authenticated
  using (public.e_admin()) with check (public.e_admin());

-- Farmacie: ognuna vede e aggiorna solo sé stessa (campi protetti dal trigger); lo staff vede tutte.
create policy farmacie_lettura on public.farmacie for select to authenticated
  using (id = public.mia_farmacia_id() or public.e_staff());
create policy farmacie_aggiorna_propria on public.farmacie for update to authenticated
  using (id = public.mia_farmacia_id()) with check (id = public.mia_farmacia_id());
create policy farmacie_admin on public.farmacie for all to authenticated
  using (public.e_admin()) with check (public.e_admin());

create policy indirizzi_lettura on public.indirizzi for select to authenticated
  using (farmacia_id = public.mia_farmacia_id() or public.e_staff());
create policy indirizzi_propri on public.indirizzi for update to authenticated
  using (farmacia_id = public.mia_farmacia_id()) with check (farmacia_id = public.mia_farmacia_id());
create policy indirizzi_admin on public.indirizzi for all to authenticated
  using (public.e_admin()) with check (public.e_admin());

-- Testi legali: pubblici in lettura (servono prima della registrazione), l'admin aggiunge versioni.
create policy documenti_lettura on public.documenti_legali for select to anon, authenticated using (true);
create policy documenti_admin on public.documenti_legali for insert to authenticated with check (public.e_admin());

-- Consensi: ognuno vede i propri, l'admin tutti. Si scrivono solo dal server.
create policy consensi_lettura on public.consensi for select to authenticated
  using (utente_id = auth.uid() or public.e_admin());
