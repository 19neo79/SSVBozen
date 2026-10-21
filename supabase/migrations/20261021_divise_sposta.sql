-- "Sposta qui" in un solo passaggio: libera la vecchia divisa del ragazzo e salva la nuova insieme.
-- Se uno dei due passi fallisce non cambia nulla. security invoker: valgono le regole RLS (solo admin).
-- divisa_id null = nuova divisa, altrimenti modifica di quella esistente. Restituisce l'id della divisa salvata.
create or replace function salva_divisa_spostando(vecchia uuid, dati jsonb, divisa_id uuid default null)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  salvata uuid;
begin
  update divise set roster_id = null, giocatore_nome = null where id = vecchia;
  if not found then
    raise exception 'La divisa da liberare non esiste più';
  end if;

  if divisa_id is null then
    insert into divise (gruppo, numero, taglia, libero, roster_id, giocatore_nome, note)
    values (
      dati->>'gruppo', (dati->>'numero')::int, dati->>'taglia', coalesce((dati->>'libero')::boolean, false),
      (dati->>'roster_id')::uuid, dati->>'giocatore_nome', dati->>'note'
    )
    returning id into salvata;
  else
    update divise set
      gruppo = dati->>'gruppo',
      numero = (dati->>'numero')::int,
      taglia = dati->>'taglia',
      libero = coalesce((dati->>'libero')::boolean, false),
      roster_id = (dati->>'roster_id')::uuid,
      giocatore_nome = dati->>'giocatore_nome',
      note = dati->>'note'
    where id = divisa_id
    returning id into salvata;
    if salvata is null then
      raise exception 'Questa divisa non esiste più: forse è stata eliminata';
    end if;
  end if;

  return salvata;
end;
$$;

revoke all on function salva_divisa_spostando(uuid, jsonb, uuid) from public, anon;
grant execute on function salva_divisa_spostando(uuid, jsonb, uuid) to authenticated;
