-- Magistra – Fase 6: chatbot (docs/FASI.md, docs/CONFORMITA.md "Chatbot", docs/SPECIFICA.md §6).
-- Base di conoscenza approvata (separata dal canale: serve anche alla futura versione vocale),
-- conversazioni e messaggi, proposte di carrello da confermare, passaggio a operatore,
-- domande senza risposta, conservazione limitata nel tempo.
-- Scritture di chat e proposte: solo dal server (service role) dopo i controlli; gli utenti leggono i propri dati.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Base di conoscenza
-- ---------------------------------------------------------------------------
create type public.stato_kb as enum ('bozza', 'approvato', 'archiviato');
create type public.tipo_kb as enum ('scheda_prodotto', 'faq', 'documento');
-- A chi è destinato il contenuto (non il canale): 'medici' è predisposto per l'assistente dei medici.
create type public.pubblico_kb as enum ('tutti', 'farmacie', 'privati', 'medici');

create table public.kb_documenti (
  id uuid primary key default gen_random_uuid(),
  titolo text not null check (length(trim(titolo)) between 2 and 200),
  tipo public.tipo_kb not null default 'documento',
  pubblico public.pubblico_kb not null default 'tutti',
  prodotto_codice text references public.prodotti (codice) on delete set null,
  testo text not null check (length(testo) <= 200000),
  file_nome text,
  stato public.stato_kb not null default 'bozza',
  versione int not null default 1,
  creato_da uuid references auth.users (id) on delete set null,
  approvato_da uuid references auth.users (id) on delete set null,
  approvato_il timestamptz,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

create trigger kb_documenti_aggiornato before update on public.kb_documenti
  for each row execute function public.imposta_aggiornato_il();
create trigger kb_documenti_storico after update on public.kb_documenti
  for each row execute function public.registra_storico();

-- Un testo approvato che cambia torna in bozza: va riapprovato prima che l'assistente lo usi.
create or replace function public.kb_documenti_riapprova()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.testo is distinct from old.testo or new.titolo is distinct from old.titolo
      or new.prodotto_codice is distinct from old.prodotto_codice or new.pubblico is distinct from old.pubblico)
     and old.stato = 'approvato' and new.stato = 'approvato' then
    new.stato := 'bozza';
  end if;
  if new.testo is distinct from old.testo then
    new.versione := old.versione + 1;
  end if;
  if new.stato <> 'approvato' then
    new.approvato_da := null;
    new.approvato_il := null;
  end if;
  return new;
end;
$$;
create trigger kb_documenti_riapprova before update on public.kb_documenti
  for each row execute function public.kb_documenti_riapprova();

create table public.kb_frammenti (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.kb_documenti (id) on delete cascade,
  posizione int not null,
  testo text not null,
  ricerca tsvector generated always as (to_tsvector('italian', testo)) stored,
  -- Vettore semantico (facoltativo): valorizzato solo se è configurato un servizio di embedding.
  embedding extensions.vector(1024),
  unique (documento_id, posizione)
);
create index kb_frammenti_ricerca on public.kb_frammenti using gin (ricerca);
create index kb_frammenti_embedding on public.kb_frammenti using hnsw (embedding extensions.vector_cosine_ops);

-- Ricerca nei soli documenti approvati: testo (parole in italiano, basta che ne compaia una)
-- e, se c'è il vettore della domanda, vicinanza semantica. I due elenchi si fondono per posizione.
create or replace function public.cerca_kb(
  p_domanda text,
  p_pubblico public.pubblico_kb,
  p_embedding extensions.vector(1024) default null,
  p_limite int default 6
)
returns table (frammento_id uuid, documento_id uuid, titolo text, tipo public.tipo_kb, prodotto_codice text, testo text, punteggio double precision)
language sql
stable
security definer
set search_path = ''
as $$
  with documenti as (
    select d.* from public.kb_documenti d
    where d.stato = 'approvato' and (d.pubblico = 'tutti' or d.pubblico = p_pubblico)
  ),
  q as (
    select nullif(replace(plainto_tsquery('italian', coalesce(p_domanda, ''))::text, '&', '|'), '')::tsquery as tsq
  ),
  per_testo as (
    select f.id, row_number() over (order by ts_rank_cd(f.ricerca, q.tsq) desc) as pos
    from public.kb_frammenti f join documenti d on d.id = f.documento_id, q
    where q.tsq is not null and f.ricerca @@ q.tsq
    order by ts_rank_cd(f.ricerca, q.tsq) desc
    limit 20
  ),
  per_senso as (
    select f.id, row_number() over (order by f.embedding operator(extensions.<=>) p_embedding) as pos
    from public.kb_frammenti f join documenti d on d.id = f.documento_id
    where p_embedding is not null and f.embedding is not null
    order by f.embedding operator(extensions.<=>) p_embedding
    limit 20
  ),
  fusi as (
    select id, sum(1.0 / (60 + pos)) as punteggio
    from (select id, pos from per_testo union all select id, pos from per_senso) x
    group by id
  )
  select f.id, d.id, d.titolo, d.tipo, d.prodotto_codice, f.testo, fusi.punteggio::double precision
  from fusi
  join public.kb_frammenti f on f.id = fusi.id
  join documenti d on d.id = f.documento_id
  order by fusi.punteggio desc
  limit greatest(1, least(p_limite, 12));
$$;
revoke execute on function public.cerca_kb(text, public.pubblico_kb, extensions.vector, int) from public, anon;
grant execute on function public.cerca_kb(text, public.pubblico_kb, extensions.vector, int) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Conversazioni
-- ---------------------------------------------------------------------------
create type public.canale_conversazione as enum ('chat', 'voce');
create type public.stato_conversazione as enum ('aperta', 'operatore', 'chiusa');
create type public.ruolo_messaggio as enum ('utente', 'assistente', 'operatore');

create table public.conversazioni (
  id uuid primary key default gen_random_uuid(),
  utente_id uuid not null references auth.users (id) on delete cascade,
  farmacia_id uuid references public.farmacie (id) on delete cascade,
  privato_id uuid references public.privati (id) on delete cascade,
  canale public.canale_conversazione not null default 'chat',
  stato public.stato_conversazione not null default 'aperta',
  -- 'ai' (Claude), 'prova' (risposte simulate in sviluppo), 'solo_operatore' (assistente non attivo)
  modalita text not null default 'ai' check (modalita in ('ai', 'prova', 'solo_operatore')),
  informativa_accettata_il timestamptz not null default now(),
  creata_il timestamptz not null default now(),
  ultimo_messaggio_il timestamptz not null default now(),
  chiusa_il timestamptz
);
create index conversazioni_utente on public.conversazioni (utente_id, ultimo_messaggio_il desc);
create index conversazioni_recenti on public.conversazioni (ultimo_messaggio_il desc);

create table public.messaggi (
  id bigint generated always as identity primary key,
  conversazione_id uuid not null references public.conversazioni (id) on delete cascade,
  ruolo public.ruolo_messaggio not null,
  testo text not null,
  -- Turno completo inviato/ricevuto dal modello (blocchi di ragionamento e strumenti compresi):
  -- si rimanda identico nei turni successivi. Non visibile all'utente.
  api jsonb,
  strumenti text[] not null default '{}',
  autore uuid references auth.users (id) on delete set null,
  token_ingresso int,
  token_uscita int,
  creato_il timestamptz not null default now()
);
create index messaggi_conversazione on public.messaggi (conversazione_id, id);
create index messaggi_utente_recenti on public.messaggi (creato_il) where ruolo = 'utente';

-- Proposte di aggiunta al carrello: l'assistente propone, solo la farmacia conferma.
create type public.stato_proposta as enum ('in_attesa', 'confermata', 'annullata', 'non_valida');
create table public.proposte_carrello (
  id uuid primary key default gen_random_uuid(),
  conversazione_id uuid not null references public.conversazioni (id) on delete cascade,
  messaggio_id bigint references public.messaggi (id) on delete cascade,
  farmacia_id uuid not null references public.farmacie (id) on delete cascade,
  lotto_id uuid not null references public.lotti (id) on delete cascade,
  prodotto_codice text not null,
  prodotto_nome text not null,
  codice_lotto text not null,
  scadenza date,
  quantita int not null check (quantita > 0 and quantita <= 100000),
  stato public.stato_proposta not null default 'in_attesa',
  esito text,
  creata_il timestamptz not null default now(),
  decisa_il timestamptz
);
create index proposte_conversazione on public.proposte_carrello (conversazione_id);

-- Passaggio a operatore
create type public.stato_richiesta_operatore as enum ('aperta', 'chiusa');
create table public.richieste_operatore (
  id uuid primary key default gen_random_uuid(),
  conversazione_id uuid not null references public.conversazioni (id) on delete cascade,
  motivo text not null,
  stato public.stato_richiesta_operatore not null default 'aperta',
  presa_da uuid references auth.users (id) on delete set null,
  creata_il timestamptz not null default now(),
  chiusa_il timestamptz
);
create unique index richieste_operatore_una_aperta on public.richieste_operatore (conversazione_id) where stato = 'aperta';

-- Domande a cui l'assistente non ha saputo rispondere (servono ad arricchire la base di conoscenza)
create type public.stato_domanda as enum ('da_valutare', 'risolta', 'ignorata');
create table public.domande_senza_risposta (
  id uuid primary key default gen_random_uuid(),
  conversazione_id uuid references public.conversazioni (id) on delete set null,
  domanda text not null,
  stato public.stato_domanda not null default 'da_valutare',
  nota text,
  creata_il timestamptz not null default now(),
  gestita_da uuid references auth.users (id) on delete set null,
  gestita_il timestamptz
);

-- Cancellazione automatica dopo il periodo di conservazione (impostazioni.mesi_conservazione_chat)
create or replace function public.cancella_conversazioni_scadute()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limite timestamptz;
  v_n int;
begin
  select now() - make_interval(months => mesi_conservazione_chat) into v_limite from public.impostazioni;
  delete from public.conversazioni where ultimo_messaggio_il < v_limite;
  get diagnostics v_n = row_count;
  delete from public.domande_senza_risposta where creata_il < v_limite;
  return v_n;
end;
$$;
revoke execute on function public.cancella_conversazioni_scadute() from public, anon, authenticated;
grant execute on function public.cancella_conversazioni_scadute() to service_role;

alter table public.impostazioni
  add constraint impostazioni_conservazione_chat check (mesi_conservazione_chat between 1 and 120);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.kb_documenti enable row level security;
alter table public.kb_frammenti enable row level security;
alter table public.conversazioni enable row level security;
alter table public.messaggi enable row level security;
alter table public.proposte_carrello enable row level security;
alter table public.richieste_operatore enable row level security;
alter table public.domande_senza_risposta enable row level security;

-- Base di conoscenza: la gestisce lo staff (approvazione solo admin, controllata dalle azioni);
-- gli utenti la consultano solo attraverso cerca_kb (documenti approvati).
create policy kb_documenti_staff on public.kb_documenti for select to authenticated using (public.e_staff());
create policy kb_documenti_admin on public.kb_documenti for all to authenticated using (public.e_admin()) with check (public.e_admin());
create policy kb_frammenti_staff on public.kb_frammenti for select to authenticated using (public.e_staff());
create policy kb_frammenti_admin on public.kb_frammenti for all to authenticated using (public.e_admin()) with check (public.e_admin());

-- Conversazioni: ognuno legge le proprie, lo staff tutte. Le scritture passano dal server.
create policy conversazioni_lettura on public.conversazioni for select to authenticated
  using (utente_id = auth.uid() or public.e_staff());
create policy messaggi_lettura on public.messaggi for select to authenticated
  using (public.e_staff() or exists (select 1 from public.conversazioni c where c.id = conversazione_id and c.utente_id = auth.uid()));
create policy proposte_lettura on public.proposte_carrello for select to authenticated
  using (public.e_staff() or exists (select 1 from public.conversazioni c where c.id = conversazione_id and c.utente_id = auth.uid()));
create policy richieste_operatore_lettura on public.richieste_operatore for select to authenticated
  using (public.e_staff() or exists (select 1 from public.conversazioni c where c.id = conversazione_id and c.utente_id = auth.uid()));
create policy domande_staff on public.domande_senza_risposta for select to authenticated using (public.e_staff());
