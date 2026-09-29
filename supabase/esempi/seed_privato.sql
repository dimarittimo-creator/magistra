-- Modello per supabase/seed_privato.sql (escluso dal repository).
-- Copialo in supabase/seed_privato.sql e inserisci gli IBAN reali.
-- Un IBAN non valido viene rifiutato dal database.

update public.societa set iban = 'ITxxXxxxxxxxxxxxxxxxxxxxxxx' where codice = 'sage';
update public.societa set iban = 'ITxxXxxxxxxxxxxxxxxxxxxxxxx' where codice = 'bioeleva';
