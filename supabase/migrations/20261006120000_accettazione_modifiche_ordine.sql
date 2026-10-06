-- Magistra – condizioni di vendita farmacie del 06/10/2026, art. 4.3:
-- le modifiche a un ordine richiedono una nuova accettazione del cliente; la spedizione non la sostituisce.
-- Dopo una modifica dell'amministrazione l'ordine resta "Modificato" in attesa della risposta del cliente:
-- non va al deposito finché il cliente non accetta; se rifiuta l'ordine si chiude e la merce torna disponibile;
-- se non risponde entro la validità della prenotazione, scade come le altre prenotazioni.

alter table public.ordini
  add column modifiche_da_accettare boolean not null default false,
  add column modifiche_accettate_il timestamptz;

-- Risposta del cliente alle modifiche (chiamata dal server dopo il controllo che l'ordine sia del cliente)
create or replace function public.rispondi_modifiche_ordine(p_ordine uuid, p_utente uuid, p_accetta boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stato public.stato_ordine;
  v_attesa boolean;
begin
  select stato, modifiche_da_accettare into v_stato, v_attesa from public.ordini where id = p_ordine for update;
  if v_stato is null or v_stato <> 'modificato' or not v_attesa then
    return jsonb_build_object('esito', 'non_in_attesa');
  end if;
  if p_accetta then
    update public.ordini set modifiche_da_accettare = false, modifiche_accettate_il = now(), scade_il = null where id = p_ordine;
    insert into public.storico_stati (ordine_id, da, a, utente, messaggio)
    values (p_ordine, 'modificato', 'modificato', p_utente, 'Modifiche accettate dal cliente');
  else
    update public.ordini set stato = 'rifiutato', modifiche_da_accettare = false, scade_il = null where id = p_ordine;
    insert into public.storico_stati (ordine_id, da, a, utente, messaggio)
    values (p_ordine, 'modificato', 'rifiutato', p_utente, 'Modifiche non accettate dal cliente: ordine annullato, la merce torna disponibile');
  end if;
  return jsonb_build_object('esito', 'ok');
end;
$$;
revoke execute on function public.rispondi_modifiche_ordine(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.rispondi_modifiche_ordine(uuid, uuid, boolean) to service_role;

-- Scadenza: anche gli ordini modificati in attesa di accettazione oltre il termine
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
    where (o.stato in ('inviato', 'in_verifica') or (o.stato = 'modificato' and o.modifiche_da_accettare))
      and o.scade_il is not null and o.scade_il <= now()
    for update
  ), aggiornati as (
    update public.ordini o set stato = 'scaduto', modifiche_da_accettare = false
    from da_scadere d where o.id = d.id
    returning o.id
  ), storico as (
    insert into public.storico_stati (ordine_id, da, a, messaggio)
    select d.id, d.stato, 'scaduto',
      case when d.stato = 'modificato'
        then 'Modifiche non accettate entro i termini: la merce torna disponibile'
        else 'Prenotazione non confermata entro i termini: la merce torna disponibile' end
    from da_scadere d
  )
  select d.id, d.numero from da_scadere d join aggiornati a on a.id = d.id;
end;
$$;
revoke execute on function public.scadi_prenotazioni() from public, anon, authenticated;
grant execute on function public.scadi_prenotazioni() to service_role;
