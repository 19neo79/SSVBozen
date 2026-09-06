-- Applicato manualmente il 2026-09-06.
-- Aggiunge il tracciamento dei ritardi (sottoinsieme di presenze: chi era
-- presente ma e' arrivato tardi) e del motivo dell'assenza per chi era
-- convocato ma non e' risultato presente. Non tocchiamo le viste pubbliche
-- (public_trainings/public_matches): questi dati restano riservati allo
-- staff, come gia' avviene per "presenze".

alter table trainings add column if not exists ritardi text[] not null default '{}';
alter table trainings add column if not exists motivi_assenza jsonb not null default '{}'::jsonb;

alter table matches add column if not exists ritardi text[] not null default '{}';
alter table matches add column if not exists motivi_assenza jsonb not null default '{}'::jsonb;
