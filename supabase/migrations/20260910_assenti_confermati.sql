-- Stato esplicito "assente" (distinto dal semplice "non presente"), per poter
-- mostrare nella UI un vero terzo stato "non ancora segnato" prima che il
-- mister marchi qualcuno presente o assente. Le statistiche continuano a
-- considerare assente chiunque non sia in "presenze", indipendentemente da
-- questo campo, che serve solo per la UI di gestione presenze.
alter table trainings add column if not exists assenti_confermati text[] not null default '{}';
alter table matches add column if not exists assenti_confermati text[] not null default '{}';
