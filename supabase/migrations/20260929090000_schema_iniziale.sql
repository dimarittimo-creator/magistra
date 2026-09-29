-- Magistra – schema iniziale (Fase 0)
-- Società emittenti, sedi e depositi, operatori logistici, impostazioni,
-- profili utente con ruoli, registro operazioni. RLS attiva su tutte le tabelle.
-- Le tabelle di catalogo, ordini, spedizioni ecc. arrivano con le fasi successive.

-- ---------------------------------------------------------------------------
-- Tipi
-- ---------------------------------------------------------------------------
create type public.ruolo_utente as enum ('farmacia', 'privato', 'admin', 'operatore', 'deposito');
create type public.tipo_sede as enum ('legale', 'operativa', 'deposito');
create type public.canale as enum ('farmacie', 'privati');

-- ---------------------------------------------------------------------------
-- Funzioni di controllo (stesse regole di lib/validazione.ts)
-- ---------------------------------------------------------------------------
create or replace function public.iban_valido(iban text)
returns boolean
language plpgsql
immutable
as $$
declare
  s text := upper(regexp_replace(coalesce(iban, ''), '\s', '', 'g'));
  riordinato text;
  c text;
  resto int := 0;
  n text;
  i int;
  j int;
begin
  if s !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' then
    return false;
  end if;
  if left(s, 2) = 'IT' and length(s) <> 27 then
    return false;
  end if;
  riordinato := substr(s, 5) || left(s, 4);
  for i in 1..length(riordinato) loop
    c := substr(riordinato, i, 1);
    if c between 'A' and 'Z' then
      n := (ascii(c) - 55)::text;
    else
      n := c;
    end if;
    for j in 1..length(n) loop
      resto := (resto * 10 + substr(n, j, 1)::int) % 97;
    end loop;
  end loop;
  return resto = 1;
end;
$$;

create or replace function public.partita_iva_valida(piva text)
returns boolean
language plpgsql
immutable
as $$
declare
  somma int := 0;
  d int;
  i int;
begin
  if piva is null or piva !~ '^[0-9]{11}$' then
    return false;
  end if;
  for i in 1..11 loop
    d := substr(piva, i, 1)::int;
    if i % 2 = 0 then
      d := d * 2;
      if d > 9 then d := d - 9; end if;
    end if;
    somma := somma + d;
  end loop;
  return somma % 10 = 0;
end;
$$;

create or replace function public.imposta_aggiornato_il()
returns trigger
language plpgsql
as $$
begin
  new.aggiornato_il := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profili utente e ruoli
-- ---------------------------------------------------------------------------
create table public.profili_utente (
  id uuid primary key references auth.users (id) on delete cascade,
  ruolo public.ruolo_utente not null,
  nome text,
  -- collegamenti valorizzati nelle fasi successive (farmacie, privati)
  farmacia_id uuid,
  privato_id uuid,
  -- solo ruolo deposito (predisposto, non attivo)
  sede_id uuid,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

create trigger profili_utente_aggiornato before update on public.profili_utente
  for each row execute function public.imposta_aggiornato_il();

-- Ruolo dell'utente collegato. security definer per poterla usare nelle policy
-- senza ricorsione sulla RLS di profili_utente.
create or replace function public.ruolo_corrente()
returns public.ruolo_utente
language sql
stable
security definer
set search_path = ''
as $$
  select ruolo from public.profili_utente where id = auth.uid();
$$;

create or replace function public.e_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.ruolo_corrente() = 'admin', false);
$$;

create or replace function public.e_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.ruolo_corrente() in ('admin', 'operatore'), false);
$$;

-- ---------------------------------------------------------------------------
-- Operatori logistici (es. NEW CIENNE DISTRIBUZIONE)
-- ---------------------------------------------------------------------------
create table public.operatori_logistici (
  id uuid primary key default gen_random_uuid(),
  ragione_sociale text not null,
  nome_breve text not null,
  partita_iva text check (partita_iva is null or public.partita_iva_valida(partita_iva)),
  codice_fiscale text,
  sede_legale text,
  sede_operativa text,
  email text,
  pec text,
  telefono text,
  cellulare text,
  referente text,
  percentuale_compenso numeric(5, 2) not null default 2,
  attivo boolean not null default true,
  note text,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

create trigger operatori_logistici_aggiornato before update on public.operatori_logistici
  for each row execute function public.imposta_aggiornato_il();

-- ---------------------------------------------------------------------------
-- Società emittenti (Sagè Pharma, Bioeleva)
-- ---------------------------------------------------------------------------
create table public.societa (
  id uuid primary key default gen_random_uuid(),
  codice text not null unique,                  -- identificativo stabile: 'sage', 'bioeleva'
  ragione_sociale text not null,
  nome_breve text not null,
  sede_legale_indirizzo text not null,
  sede_legale_cap text not null,
  sede_legale_citta text not null,
  sede_legale_provincia text not null,
  partita_iva text not null check (public.partita_iva_valida(partita_iva)),
  codice_fiscale text not null,
  sdi text,
  pec text,
  rea text,
  capitale_sociale_testo text,
  sito text,
  email text,
  telefono text,
  iban text check (iban is null or public.iban_valido(iban)),
  logo_path text,
  piede_documenti text,
  attiva_farmacie boolean not null default true,
  attiva_privati boolean not null default true,
  predefinita boolean not null default false,
  attiva boolean not null default true,
  note text,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

-- Una sola società predefinita
create unique index societa_una_predefinita on public.societa (predefinita) where predefinita;

create trigger societa_aggiornato before update on public.societa
  for each row execute function public.imposta_aggiornato_il();

-- Storico delle modifiche ai dati delle società
create table public.societa_storico (
  id bigint generated always as identity primary key,
  societa_id uuid not null references public.societa (id),
  prima jsonb,
  dopo jsonb,
  utente uuid,
  il timestamptz not null default now()
);

create or replace function public.registra_storico_societa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.societa_storico (societa_id, prima, dopo, utente)
  values (new.id, to_jsonb(old), to_jsonb(new), auth.uid());
  return new;
end;
$$;

create trigger societa_storico_trg after update on public.societa
  for each row when (old is distinct from new)
  execute function public.registra_storico_societa();

-- ---------------------------------------------------------------------------
-- Sedi: legali, operative, depositi
-- ---------------------------------------------------------------------------
create table public.sedi (
  id uuid primary key default gen_random_uuid(),
  societa_id uuid not null references public.societa (id),
  tipo public.tipo_sede not null,
  nome text not null,
  indirizzo text not null,
  cap text,
  citta text,
  provincia text,
  telefono text,
  email text,
  email_cc text[] not null default '{}',
  referente text,
  orari text,
  predefinito boolean not null default false,   -- solo per i depositi
  operatore_id uuid references public.operatori_logistici (id),
  attiva boolean not null default true,
  note text,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  constraint sedi_predefinito_solo_deposito check (not predefinito or tipo = 'deposito'),
  constraint sedi_operatore_solo_deposito check (operatore_id is null or tipo = 'deposito')
);

-- Un solo deposito predefinito
create unique index sedi_un_deposito_predefinito on public.sedi (predefinito) where predefinito;

create trigger sedi_aggiornato before update on public.sedi
  for each row execute function public.imposta_aggiornato_il();

-- Una sede non si cancella (serve allo storico degli ordini): si disattiva.
create or replace function public.blocca_cancellazione()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Operazione non consentita su %: disattiva il record invece di cancellarlo', tg_table_name;
end;
$$;

create trigger sedi_no_delete before delete on public.sedi
  for each row execute function public.blocca_cancellazione();
create trigger societa_no_delete before delete on public.societa
  for each row execute function public.blocca_cancellazione();

alter table public.profili_utente
  add constraint profili_utente_sede_fk foreign key (sede_id) references public.sedi (id);

-- ---------------------------------------------------------------------------
-- Impostazioni generali (una sola riga)
-- ---------------------------------------------------------------------------
create table public.impostazioni (
  id boolean primary key default true check (id),
  iva_predefinita numeric(5, 2) not null default 10,
  giorni_validita_prenotazione int not null default 3,       -- giorni lavorativi
  giorni_consegna_indicativi int not null default 5,
  soglia_minima_ordine_cent int,
  soglia_trasporto_gratuito_cent int,
  costo_trasporto_cent int,
  soglia_esaurimento_default int not null default 50,
  modalita_invio_deposito text not null default 'singola' check (modalita_invio_deposito in ('singola', 'cumulativa')),
  orario_invio_cumulativo time not null default '12:00',
  ore_sollecito_ddt int not null default 48,
  prezzi_in_richiesta_evasione boolean not null default false,
  mesi_minimi_lotto_privati int not null default 6,
  area_privati_attiva boolean not null default false,
  mesi_conservazione_chat int not null default 24,
  aggiornato_il timestamptz not null default now()
);

create trigger impostazioni_aggiornato before update on public.impostazioni
  for each row execute function public.imposta_aggiornato_il();

-- ---------------------------------------------------------------------------
-- Registro operazioni (non modificabile)
-- ---------------------------------------------------------------------------
create table public.registro_operazioni (
  id bigint generated always as identity primary key,
  utente uuid,
  azione text not null,
  entita text not null,
  entita_id text,
  prima jsonb,
  dopo jsonb,
  il timestamptz not null default now()
);

create or replace function public.blocca_modifica_registro()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Il registro operazioni non è modificabile';
end;
$$;

create trigger registro_non_modificabile before update or delete on public.registro_operazioni
  for each row execute function public.blocca_modifica_registro();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profili_utente enable row level security;
alter table public.operatori_logistici enable row level security;
alter table public.societa enable row level security;
alter table public.societa_storico enable row level security;
alter table public.sedi enable row level security;
alter table public.impostazioni enable row level security;
alter table public.registro_operazioni enable row level security;

-- Profili: ognuno vede il proprio; lo staff vede tutti; solo l'admin modifica.
create policy profili_lettura on public.profili_utente for select to authenticated
  using (id = auth.uid() or public.e_staff());
create policy profili_admin on public.profili_utente for all to authenticated
  using (public.e_admin()) with check (public.e_admin());

-- Società: leggibili dagli utenti collegati (servono nel carrello), modificabili dall'admin.
create policy societa_lettura on public.societa for select to authenticated using (true);
create policy societa_admin on public.societa for all to authenticated
  using (public.e_admin()) with check (public.e_admin());

create policy societa_storico_admin on public.societa_storico for select to authenticated
  using (public.e_admin());

-- Sedi e operatori logistici: staff in lettura, admin in scrittura.
create policy sedi_lettura on public.sedi for select to authenticated using (public.e_staff());
create policy sedi_admin on public.sedi for all to authenticated
  using (public.e_admin()) with check (public.e_admin());

create policy operatori_lettura on public.operatori_logistici for select to authenticated using (public.e_staff());
create policy operatori_admin on public.operatori_logistici for all to authenticated
  using (public.e_admin()) with check (public.e_admin());

-- Impostazioni: leggibili dagli utenti collegati, modificabili dall'admin.
create policy impostazioni_lettura on public.impostazioni for select to authenticated using (true);
create policy impostazioni_admin on public.impostazioni for update to authenticated
  using (public.e_admin()) with check (public.e_admin());

-- Registro: l'admin legge; lo staff scrive solo a proprio nome.
create policy registro_lettura on public.registro_operazioni for select to authenticated using (public.e_admin());
create policy registro_scrittura on public.registro_operazioni for insert to authenticated
  with check (public.e_staff() and utente = auth.uid());
