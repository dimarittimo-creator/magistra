-- Dati iniziali (docs/SOCIETA_E_SEDI.md). Gli IBAN NON sono qui:
-- stanno in supabase/seed_privato.sql, escluso dal repository (modello in supabase/esempi/).

insert into public.impostazioni (id) values (true);

-- Operatore logistico del deposito
insert into public.operatori_logistici
  (ragione_sociale, nome_breve, partita_iva, codice_fiscale, sede_legale, sede_operativa,
   email, pec, telefono, cellulare, percentuale_compenso)
values
  ('NEW CIENNE DISTRIBUZIONE S.R.L.', 'CIENNE', '10664671210', '10664671210',
   'Centro Direzionale, Isola G1, Scala D, Int. 21 – 80143 Napoli (NA)',
   'Via Salvatore Piccolo, 211 – 80014 ASI Napoli (NA)',
   'a.nuzzo@ciennegroup.it', 'newciennedistribuzione@pec.it', '081 18902097', '320 2171312', 2);

-- Società emittenti
insert into public.societa
  (codice, ragione_sociale, nome_breve,
   sede_legale_indirizzo, sede_legale_cap, sede_legale_citta, sede_legale_provincia,
   partita_iva, codice_fiscale, sdi, pec, rea, capitale_sociale_testo, sito, logo_path,
   attiva_farmacie, attiva_privati, predefinita, note)
values
  ('sage', 'SAGE'' PHARMA S.r.l.', 'Sagè Pharma',
   'Viale Antonio Gramsci, 21', '80122', 'Napoli', 'NA',
   '01698370994', '01698370994', 'M5UXCR1', 'sagepharma1@pec.it', 'NA - 853582',
   '€ 100.000,00', 'www.sagepharma.it', '/brand/logo-sage-pharma.jpg',
   true, true, true, 'Capitale sociale: confermare la dicitura "i.v."'),
  ('bioeleva', 'BIOELEVA S.r.l.', 'Bioeleva',
   'Viale Antonio Gramsci, 21', '80122', 'Napoli', 'NA',
   '04363330277', '04363330277', 'M5UXCR1', 'bioeleva@legalmail.it', 'NA - 1108752',
   '€ 13.612,00 i.v.', 'www.bioeleva.com', null,
   true, true, false, 'Logo da fornire');

-- Sedi iniziali
insert into public.sedi (societa_id, tipo, nome, indirizzo, cap, citta, provincia, telefono, email, predefinito, operatore_id, note)
select s.id, v.tipo::public.tipo_sede, v.nome, v.indirizzo, v.cap, v.citta, v.provincia, v.telefono, v.email, v.predefinito,
       case when v.tipo = 'deposito' then (select id from public.operatori_logistici where nome_breve = 'CIENNE') end,
       v.note
from (values
  ('sage', 'legale', 'Sede legale Sagè Pharma', 'Viale Antonio Gramsci, 21', '80122', 'Napoli', 'NA', null, null, false, null),
  ('sage', 'operativa', 'Unità operativa amministrativa Guantai ad Orsolone', 'Via Comunale Guantai ad Orsolone, 40/B', '80131', 'Napoli', 'NA', null, null, false,
   'Unità locale NA/5, aperta l''11/07/2024. Non è luogo di partenza della merce.'),
  ('sage', 'deposito', 'Deposito CIENNE', 'Via Salvatore Piccolo, 211', '80014', 'ASI Napoli', 'NA', '081 18902097', 'a.nuzzo@ciennegroup.it', true,
   'Gestito da NEW CIENNE DISTRIBUZIONE S.R.L. Spedisce per Sagè Pharma e Bioeleva.'),
  ('bioeleva', 'legale', 'Sede legale Bioeleva', 'Viale Antonio Gramsci, 21', '80122', 'Napoli', 'NA', null, null, false, null)
) as v(codice_societa, tipo, nome, indirizzo, cap, citta, provincia, telefono, email, predefinito, note)
join public.societa s on s.codice = v.codice_societa;
