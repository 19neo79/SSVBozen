-- Dati necessari al calcolo automatico del codice fiscale.
-- luogo_nascita: etichetta leggibile (es. "BOLZANO (BZ)"); luogo_nascita_cc: codice catastale (Belfiore).
alter table roster add column if not exists sesso text check (sesso in ('M', 'F'));
alter table roster add column if not exists luogo_nascita text;
alter table roster add column if not exists luogo_nascita_cc text;
