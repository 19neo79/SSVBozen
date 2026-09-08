-- Applicato manualmente il 2026-09-08.
-- Il link pubblico del piano settimanale (/programma?settimana=AAAA-MM-GG)
-- esponeva la data in chiaro e modificabile a mano nell'URL, oltre a uno
-- slider per sfogliare altre settimane: un genitore poteva vedere
-- settimane diverse da quella condivisa semplicemente cambiando l'URL.
--
-- Sostituito con un codice opaco (id casuale) che il sistema associa
-- internamente a una specifica settimana: la pagina pubblica mostra solo
-- quella settimana, senza navigazione e senza relazione leggibile tra
-- codice e data.

create table if not exists public_week_links (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  created_at timestamptz not null default now()
);

alter table public_week_links enable row level security;

-- Chiunque (anche anonimo) puo' risolvere un codice che gia' possiede,
-- per mostrare la pagina pubblica.
drop policy if exists public_week_links_select on public_week_links;
create policy public_week_links_select on public_week_links
  for select using (true);

-- Solo lo staff autenticato (coach o admin) puo' generare nuovi link
-- dalla scheda Piano settimanale.
drop policy if exists public_week_links_insert on public_week_links;
create policy public_week_links_insert on public_week_links
  for insert to authenticated with check (true);

grant select on public_week_links to anon, authenticated;
grant insert on public_week_links to authenticated;
