-- Salva l'ultima lista di convocati usata per ogni giorno ricorrente
-- (lun/mer/ven), cosi' la generazione della settimana successiva
-- preseleziona gli stessi convocati invece di tutta la rosa.
alter table recurring_defaults add column if not exists convocati text[] not null default '{}';
