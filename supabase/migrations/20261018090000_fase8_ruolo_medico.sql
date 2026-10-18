-- Magistra – Fase 8: nuovo ruolo «medico» (docs/AREA_MEDICI.md).
-- In una migrazione a parte: un nuovo valore di un tipo enumerato si può usare solo dopo il commit.
alter type public.ruolo_utente add value if not exists 'medico';
