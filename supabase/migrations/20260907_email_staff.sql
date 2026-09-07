-- Applicato manualmente il 2026-09-07.
-- Aggiunge l'email ai referenti staff (coach, vice coach, dirigente),
-- oltre al cellulare gia' presente.

alter table settings add column if not exists coach_email text;
alter table settings add column if not exists vice_coach_email text;
alter table settings add column if not exists dirigente_email text;

create or replace view public_settings_basic as
  select
    club_name, logo_url,
    coach_nome, coach_telefono, coach_email,
    vice_coach_nome, vice_coach_telefono, vice_coach_email,
    dirigente_nome, dirigente_telefono, dirigente_email
  from settings;

grant select on public_settings_basic to anon, authenticated;
