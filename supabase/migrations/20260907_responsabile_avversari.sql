-- Applicato manualmente il 2026-09-07.
-- Aggiunge un referente (nome, cellulare, email) per ogni squadra avversaria,
-- utile per contattare l'organizzazione della trasferta/casa.

alter table avversari add column if not exists responsabile text;
alter table avversari add column if not exists telefono_responsabile text;
alter table avversari add column if not exists email_responsabile text;
