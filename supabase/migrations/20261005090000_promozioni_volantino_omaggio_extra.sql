-- Magistra – promozioni con volantino e "omaggio extra" (materiale non a magazzino, es. un espositore).
-- Richiesta di Salvatore Di Marino del 05/10/2026 (offerta Primus Task).

-- Immagine della promozione (volantino), mostrata alle farmacie nella pagina iniziale e nella scheda prodotto
alter table public.promozioni add column immagine_path text;

-- Omaggio extra: "1 espositore ogni 24 pezzi". Non impegna giacenza (non è a magazzino):
-- il portale calcola quanti ne spettano e li riporta in carrello, ordine, email e richiesta di evasione.
alter table public.promozioni
  add column omaggio_extra_testo text check (omaggio_extra_testo is null or length(trim(omaggio_extra_testo)) between 2 and 120),
  add column omaggio_extra_ogni int check (omaggio_extra_ogni is null or omaggio_extra_ogni > 0),
  add column omaggio_extra_quantita int check (omaggio_extra_quantita is null or omaggio_extra_quantita > 0),
  add constraint promo_omaggio_extra check (
    (omaggio_extra_testo is null and omaggio_extra_ogni is null and omaggio_extra_quantita is null)
    or (omaggio_extra_testo is not null and omaggio_extra_ogni is not null and omaggio_extra_quantita is not null)
  );

-- Fotografia degli omaggi extra spettanti al momento dell'invio: [{ promozione_id, nome, testo, quantita }]
alter table public.ordini add column omaggi_extra jsonb not null default '[]';

-- Archivio pubblico delle immagini delle offerte (materiale promozionale, nessun dato personale).
-- Caricamento solo dal server (chiave di servizio) dopo il controllo dell'amministratore.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('promozioni', 'promozioni', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
