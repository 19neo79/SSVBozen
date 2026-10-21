-- Divise SSV Bozen Maschile: maglia con numero + pantaloncino della stessa taglia.
-- gruppo null = da assegnare; roster_id senza vincolo verso roster, così se un ragazzo viene cancellato
-- la divisa resta con il suo nome e risulta "non più in rosa".
create table if not exists divise (
  id uuid primary key default gen_random_uuid(),
  gruppo text check (gruppo in ('U17', 'U14-15', 'U12-13')),
  numero int not null check (numero between 0 and 99),
  taglia text not null check (taglia in ('XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL')),
  libero boolean not null default false,
  roster_id uuid,
  giocatore_nome text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Al massimo una divisa normale e una da libero per ragazzo.
  unique (roster_id, libero)
);

-- Stessa regola per i nomi scritti a mano, ignorando maiuscole e spazi.
create unique index if not exists divise_nome_libero
  on divise (lower(regexp_replace(trim(giocatore_nome), '\s+', ' ', 'g')), libero)
  where roster_id is null and giocatore_nome is not null;

create or replace function divise_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists divise_updated_at on divise;
create trigger divise_updated_at before update on divise
  for each row execute function divise_set_updated_at();

alter table divise enable row level security;

create policy divise_admin on divise
  for all to authenticated
  using (my_role() = 'admin')
  with check (my_role() = 'admin');

revoke all on divise from anon;
