-- Foto degli atleti (minori): archivio privato, letto da admin e allenatori, scritto solo da admin.
alter table roster add column if not exists foto_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foto-atleti', 'foto-atleti', false, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy foto_atleti_lettura on storage.objects
  for select to authenticated
  using (bucket_id = 'foto-atleti' and public.my_role() in ('admin', 'allenatore'));

create policy foto_atleti_inserimento on storage.objects
  for insert to authenticated
  with check (bucket_id = 'foto-atleti' and public.my_role() = 'admin');

create policy foto_atleti_modifica on storage.objects
  for update to authenticated
  using (bucket_id = 'foto-atleti' and public.my_role() = 'admin');

create policy foto_atleti_cancellazione on storage.objects
  for delete to authenticated
  using (bucket_id = 'foto-atleti' and public.my_role() = 'admin');
