-- Applicato manualmente il 2026-09-06.
-- 1) Aggiunge l'email ai profili (utile per riconoscere gli utenti nella UI
--    di gestione ruoli), popolata dal trigger di registrazione e con backfill
--    per gli utenti gia' esistenti.
alter table profiles add column if not exists email text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $func$
begin
  insert into public.profiles (id, nome, ruolo, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', new.email), 'allenatore', new.email);
  return new;
end;
$func$;

update profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

-- 2) Vista pubblica per nome societa' e logo, cosi' la pagina /programma
--    (senza login) puo' mostrarli senza avere accesso alla tabella settings
--    completa (che richiede autenticazione via RLS).
create or replace view public_settings_basic as
  select club_name, logo_url from settings;

grant select on public_settings_basic to anon, authenticated;
