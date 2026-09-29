-- Modalità di pagamento consentite a una farmacia: attive, del canale farmacie, e senza limitazioni
-- oppure limitate a quella farmacia o al suo gruppo (docs/REGOLE_COMMERCIALI.md §6).
-- security definer: la farmacia non vede le limitazioni che riguardano le altre.
create or replace function public.modalita_consentite_farmacia(p_farmacia uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.modalita_pagamento m
  where m.attiva
    and m.canale in ('farmacie', 'entrambi')
    and (auth.uid() is null or public.e_staff() or p_farmacia = public.mia_farmacia_id())
    and (
      not exists (select 1 from public.modalita_pagamento_limiti l where l.modalita_id = m.id)
      or exists (
        select 1
        from public.modalita_pagamento_limiti l
        join public.farmacie f on f.id = p_farmacia
        where l.modalita_id = m.id and (l.farmacia_id = f.id or (f.gruppo_id is not null and l.gruppo_id = f.gruppo_id))
      )
    );
$$;

revoke execute on function public.modalita_consentite_farmacia(uuid) from public, anon;
grant execute on function public.modalita_consentite_farmacia(uuid) to authenticated, service_role;
