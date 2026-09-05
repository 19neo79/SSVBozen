-- Applicato manualmente il 2026-09-06.
-- Unifica "campi da gioco degli avversari" (tabella campi_avversari) dentro
-- la tabella venues, con una colonna avversario_id opzionale: una venue con
-- avversario_id NULL e' una nostra palestra, una con avversario_id valorizzato
-- e' il campo di casa di quell'avversario. Cosi' la lista Palestre mostra
-- sempre tutto, e le Palestre di un avversario si gestiscono con lo stesso
-- form/hook della scheda Palestre.
alter table venues add column if not exists avversario_id uuid references avversari(id) on delete cascade;

-- Migra eventuali righe esistenti preservando gli id (cosi' eventuali
-- matches.venue_id che le referenziano continuano a risolvere).
insert into venues (id, nome, indirizzo, cap, citta, provincia, avversario_id, created_at)
select id, nome, indirizzo, cap, citta, provincia, avversario_id, now()
from campi_avversari
on conflict (id) do nothing;

-- Ora che tutti i venue_id (allenamenti e partite) puntano sempre a venues,
-- possiamo vincolarlo con una FK vera.
alter table matches add constraint matches_venue_id_fkey foreign key (venue_id) references venues(id);

-- Nota: la vecchia tabella "campi_avversari" e la vista pubblica
-- "public_campi_avversari_basic" non sono state droppate automaticamente
-- (il tool usato per la migrazione blocca i DROP come azione distruttiva).
-- Restano vuote e non piu' referenziate dal codice: puoi rimuoverle a mano
-- quando vuoi con:
--   drop view if exists public_campi_avversari_basic;
--   drop table if exists campi_avversari;
