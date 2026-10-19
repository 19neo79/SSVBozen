-- Indirizzo di residenza degli atleti (dati personali di minori: solo admin e allenatori).
alter table roster add column if not exists indirizzo_comune text;
alter table roster add column if not exists indirizzo_comune_cc text;
alter table roster add column if not exists indirizzo_cap text;
alter table roster add column if not exists indirizzo_via text;
alter table roster add column if not exists indirizzo_civico text;

-- Prima bastava essere loggati; ora servono i ruoli admin o allenatore.
-- La vista public_roster_basic espone solo id, nome, cognome, numero e non cambia.
drop policy if exists roster_select on roster;
create policy roster_select on roster
  for select using (my_role() in ('admin', 'allenatore'));
