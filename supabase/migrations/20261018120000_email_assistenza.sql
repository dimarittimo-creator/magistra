-- Email a cui clienti, farmacie e medici possono scrivere in caso di problemi.
-- Modificabile dall'admin in Impostazioni; vuota = non mostrata.
alter table public.impostazioni
  add column email_assistenza text
    check (email_assistenza is null or email_assistenza ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- Leggibile anche da chi non ha ancora un account (piè di pagina, moduli di iscrizione):
-- espone solo questo dato, non le altre impostazioni.
create or replace function public.email_assistenza()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select email_assistenza from public.impostazioni where id;
$$;

grant execute on function public.email_assistenza() to anon, authenticated;
