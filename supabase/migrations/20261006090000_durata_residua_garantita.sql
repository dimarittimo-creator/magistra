-- Magistra – condizioni di vendita farmacie del 06/10/2026, art. 7.1:
-- i prodotti sono consegnati con durata residua non inferiore a 8 mesi; una durata inferiore
-- deve essere chiaramente comunicata e accettata prima della conclusione del contratto.

alter table public.impostazioni
  add column mesi_durata_residua_garantita int not null default 8
  check (mesi_durata_residua_garantita between 0 and 36);

-- Prova dell'accettazione espressa dei lotti con durata residua inferiore a quella garantita
alter table public.ordini
  add column durata_ridotta_accettata boolean not null default false;
