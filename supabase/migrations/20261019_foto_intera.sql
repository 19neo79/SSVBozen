-- Oltre al ritaglio sul viso (foto_path) conserviamo la foto intera ridotta, mostrata nella scheda atleta.
alter table roster add column if not exists foto_intera_path text;
