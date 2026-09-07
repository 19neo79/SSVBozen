-- Applicato manualmente il 2026-09-07.
-- Referenti dello staff (coach, vice coach, dirigente) da mostrare nel
-- piano settimanale (pagina pubblica, anteprima privata e stampa),
-- cosi' i genitori sanno subito chi contattare.

alter table settings add column if not exists coach_nome text;
alter table settings add column if not exists coach_telefono text;
alter table settings add column if not exists vice_coach_nome text;
alter table settings add column if not exists vice_coach_telefono text;
alter table settings add column if not exists dirigente_nome text;
alter table settings add column if not exists dirigente_telefono text;

update settings set
  coach_nome = 'Marco Feltrin',
  coach_telefono = '3475842373',
  vice_coach_nome = 'Andrea Luppino',
  vice_coach_telefono = '3803461446',
  dirigente_nome = 'Manuel Riccadonna',
  dirigente_telefono = '3312553665'
where id = 1;

-- La vista pubblica (usata da /programma senza login) deve esporre anche
-- questi campi, che sono lo scopo stesso della richiesta: farli vedere
-- ai genitori.
create or replace view public_settings_basic as
  select
    club_name, logo_url,
    coach_nome, coach_telefono,
    vice_coach_nome, vice_coach_telefono,
    dirigente_nome, dirigente_telefono
  from settings;

grant select on public_settings_basic to anon, authenticated;
