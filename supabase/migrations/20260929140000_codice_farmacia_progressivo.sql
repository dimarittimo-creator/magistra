-- Codice farmacia assegnato dal portale: numero progressivo da 0100 in avanti
-- (decisione di Salvatore Di Marino del 29/09/2026). Non lo inserisce la farmacia
-- e non si modifica.

create sequence public.farmacie_codice_seq start with 100 minvalue 100;

-- Le farmacie già presenti ricevono i primi numeri, in ordine di iscrizione.
update public.farmacie f
set codice_farmacia = lpad(nextval('public.farmacie_codice_seq')::text, 4, '0')
from (select id from public.farmacie order by creato_il, id) o
where o.id = f.id;

alter table public.farmacie
  alter column codice_farmacia set default lpad(nextval('public.farmacie_codice_seq')::text, 4, '0'),
  add constraint farmacie_codice_numerico check (codice_farmacia ~ '^[0-9]{4,}$');

alter sequence public.farmacie_codice_seq owned by public.farmacie.codice_farmacia;

-- Il codice non si cambia, nemmeno dall'amministrazione.
create or replace function public.farmacie_codice_fisso()
returns trigger
language plpgsql
as $$
begin
  if new.codice_farmacia is distinct from old.codice_farmacia then
    raise exception 'Il codice farmacia è assegnato dal portale e non si modifica';
  end if;
  return new;
end;
$$;

create trigger farmacie_codice_fisso before update of codice_farmacia on public.farmacie
  for each row execute function public.farmacie_codice_fisso();

-- Registrazione: il codice arriva dalla numerazione, non dal modulo.
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

  insert into public.farmacie (ragione_sociale, titolare, partita_iva, codice_fiscale, sdi, pec, email, telefono)
  values (
    p_farmacia->>'ragione_sociale', p_farmacia->>'titolare', p_farmacia->>'partita_iva',
    p_farmacia->>'codice_fiscale',
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
