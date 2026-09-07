-- Applicato manualmente il 2026-09-07.
-- Alcuni atleti nati 2013-2015 (quindi anagraficamente U14) non possono
-- giocare in U14 per motivi societari/tecnici e sono convocabili solo in
-- U15. Aggiunge un flag per gestire questa eccezione oltre alla regola
-- federale gia' presente (i nati 2012 non possono giocare in U14).

alter table roster add column if not exists solo_u15 boolean not null default false;
