-- Data e ora di consegna della divisa al ragazzo.
alter table divise add column if not exists consegnata_il timestamptz;

-- La consegna vale per quel ragazzo: si azzera se la divisa resta senza giocatore o passa a un altro
-- (popup, "Togli giocatore", "Sposta qui", azioni multiple), a meno che nello stesso salvataggio
-- non venga indicata una nuova consegna.
create or replace function divise_azzera_consegna() returns trigger
language plpgsql
set search_path = public
as $$
declare
  cambiato boolean;
begin
  if new.giocatore_nome is null then
    new.consegnata_il := null;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.consegnata_il is not distinct from old.consegnata_il then
    if new.roster_id is not null or old.roster_id is not null then
      cambiato := new.roster_id is distinct from old.roster_id;
    else
      cambiato := lower(regexp_replace(trim(new.giocatore_nome), '\s+', ' ', 'g'))
        is distinct from lower(regexp_replace(trim(coalesce(old.giocatore_nome, '')), '\s+', ' ', 'g'));
    end if;
    if cambiato then
      new.consegnata_il := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists divise_consegna on divise;
create trigger divise_consegna before insert or update on divise
  for each row execute function divise_azzera_consegna();

-- "Sposta qui" salva anche la consegna, se indicata nello stesso momento.
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
    insert into divise (gruppo, numero, taglia, libero, pantaloncino, roster_id, giocatore_nome, note, consegnata_il)
    values (
      dati->>'gruppo', (dati->>'numero')::int, dati->>'taglia', coalesce((dati->>'libero')::boolean, false),
      coalesce((dati->>'pantaloncino')::boolean, false), (dati->>'roster_id')::uuid, dati->>'giocatore_nome', dati->>'note', (dati->>'consegnata_il')::timestamptz
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
      note = dati->>'note',
      consegnata_il = (dati->>'consegnata_il')::timestamptz
    where id = divisa_id
    returning id into salvata;
    if salvata is null then
      raise exception 'Questa divisa non esiste più: forse è stata eliminata';
    end if;
  end if;

  return salvata;
end;
$$;
