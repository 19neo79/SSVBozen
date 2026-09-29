-- Finora ogni palestra apparteneva a UN solo avversario (venues.avversario_id),
-- quindi se due squadre diverse giocavano nella stessa palestra bisognava
-- inserirla due volte. Sostituito con una tabella ponte che permette a più
-- avversari di condividere la stessa palestra dall'elenco esistente.

create table if not exists avversario_venues (
  avversario_id uuid not null references avversari(id) on delete cascade,
  venue_id uuid not null references venues(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (avversario_id, venue_id)
);

alter table avversario_venues enable row level security;

drop policy if exists avversario_venues_select on avversario_venues;
create policy avversario_venues_select on avversario_venues
  for select using (true);

drop policy if exists avversario_venues_write on avversario_venues;
create policy avversario_venues_write on avversario_venues
  for all to authenticated using (true) with check (true);

grant select on avversario_venues to anon, authenticated;
grant insert, update, delete on avversario_venues to authenticated;

-- Riporta i collegamenti 1:1 esistenti nella nuova tabella ponte.
insert into avversario_venues (avversario_id, venue_id)
select avversario_id, id from venues where avversario_id is not null
on conflict do nothing;

-- La colonna singola non serve più: la relazione vive solo in avversario_venues.
alter table venues drop column if exists avversario_id;
