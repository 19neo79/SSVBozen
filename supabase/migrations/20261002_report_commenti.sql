-- Commento testuale del report mensile presenze (numeri e tabelle sono calcolati dall'app).
-- Ogni campo contiene una voce per riga; **testo** viene mostrato in grassetto.
create table if not exists report_commenti (
  mese text primary key check (mese ~ '^\d{4}-\d{2}$'),
  in_breve text not null default '',
  da_seguire text not null default '',
  consigli text not null default '',
  updated_at timestamptz not null default now()
);

alter table report_commenti enable row level security;

create policy report_commenti_select on report_commenti
  for select to authenticated using (true);

create policy report_commenti_write_admin on report_commenti
  for all to authenticated
  using (my_role() = 'admin')
  with check (my_role() = 'admin');

revoke all on report_commenti from anon;
