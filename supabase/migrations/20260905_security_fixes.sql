-- Applicato manualmente il 2026-09-05 dopo la revisione dello schema esistente.
-- Fix 1: impedisce che un utente autenticato possa auto-promuoversi ad admin
-- aggiornando il proprio campo "ruolo" tramite la policy profiles_update_self.
drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and ruolo = (select p2.ruolo from profiles p2 where p2.id = auth.uid())
  );

-- Consente comunque all'admin di cambiare il ruolo di altri utenti.
create policy profiles_update_admin on profiles
  for update
  using (my_role() = 'admin')
  with check (my_role() = 'admin');

-- Fix 2: le viste pubbliche (usate dalla pagina /programma senza login)
-- avevano INSERT/UPDATE/DELETE/TRUNCATE concessi a anon e authenticated
-- oltre a SELECT. Essendo viste "di proprietà" del owner delle tabelle,
-- bypassano le RLS delle tabelle sottostanti anche in scrittura: un
-- visitatore anonimo avrebbe potuto modificare/cancellare righe in
-- roster, venues, trainings, matches, campi_avversari. Lasciamo solo SELECT.
revoke insert, update, delete, truncate
  on public_roster_basic, public_venues_basic, public_trainings, public_matches, public_campi_avversari_basic
  from anon, authenticated;
