-- Numero gara FIPAV: identificativo univoco assegnato dalla federazione a ogni partita.
alter table matches add column if not exists numero_gara_fipav text;
