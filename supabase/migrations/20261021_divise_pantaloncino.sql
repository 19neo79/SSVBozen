-- Non tutte le divise hanno il pantaloncino: le esistenti partono senza, si spunta chi ce l'ha.
alter table divise add column if not exists pantaloncino boolean not null default false;

-- "Sposta qui" salva anche il pantaloncino.
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
    insert into divise (gruppo, numero, taglia, libero, pantaloncino, roster_id, giocatore_nome, note)
    values (
      dati->>'gruppo', (dati->>'numero')::int, dati->>'taglia', coalesce((dati->>'libero')::boolean, false),
      coalesce((dati->>'pantaloncino')::boolean, false), (dati->>'roster_id')::uuid, dati->>'giocatore_nome', dati->>'note'
    )
    returning id into salvata;
  else
    update divise set
      gruppo = dati->>'gruppo',
      numero = (dati->>'numero')::int,
      taglia = dati->>'taglia',
      libero = coalesce((dati->>'libero')::boolean, false),
      pantaloncino = coalesce((dati->>'pantaloncino')::boolean, false),
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
