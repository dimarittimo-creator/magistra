-- Magistra – Fase 7: correzioni dal controllo di sicurezza di Supabase (db advisors).

-- 1. Funzioni di controllo e trigger con search_path fisso (usano solo funzioni di sistema).
alter function public.iban_valido(text) set search_path = '';
alter function public.partita_iva_valida(text) set search_path = '';
alter function public.codice_fiscale_valido(text) set search_path = '';
alter function public.imposta_aggiornato_il() set search_path = '';
alter function public.blocca_cancellazione() set search_path = '';
alter function public.blocca_modifica_registro() set search_path = '';
alter function public.farmacie_codice_fisso() set search_path = '';
alter function public.stato_ordine_aperto(public.stato_ordine) set search_path = '';

-- 2. Funzioni interne (ruolo e dati dell'utente collegato, visibilità ordini, storico):
--    servono solo agli utenti collegati e alle regole di sicurezza; i visitatori non le chiamano.
--    Restano pubbliche documento_legale_corrente e area_privati_attivabile (informazioni non riservate).
revoke execute on function public.e_admin() from anon, public;
revoke execute on function public.e_staff() from anon, public;
revoke execute on function public.ruolo_corrente() from anon, public;
revoke execute on function public.farmacia_attiva() from anon, public;
revoke execute on function public.mia_farmacia_id() from anon, public;
revoke execute on function public.mio_privato_id() from anon, public;
revoke execute on function public.privato_attivo() from anon, public;
revoke execute on function public.ordine_visibile(uuid) from anon, public;
revoke execute on function public.registra_storico() from anon, public;
grant execute on function public.e_admin() to authenticated, service_role;
grant execute on function public.e_staff() to authenticated, service_role;
grant execute on function public.ruolo_corrente() to authenticated, service_role;
grant execute on function public.farmacia_attiva() to authenticated, service_role;
grant execute on function public.mia_farmacia_id() to authenticated, service_role;
grant execute on function public.mio_privato_id() to authenticated, service_role;
grant execute on function public.privato_attivo() to authenticated, service_role;
grant execute on function public.ordine_visibile(uuid) to authenticated, service_role;
grant execute on function public.registra_storico() to authenticated, service_role;
