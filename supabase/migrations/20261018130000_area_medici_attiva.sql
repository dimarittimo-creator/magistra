-- Interruttore dell'area Medici per il pubblico (come area_privati_attiva).
-- Spenta: iscrizione e accesso dei medici mostrano «disponibile a breve»; l'admin vede comunque tutto.
alter table public.impostazioni add column area_medici_attiva boolean not null default false;
