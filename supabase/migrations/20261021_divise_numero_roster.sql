-- Il "N. maglia" della rosa segue il numero della divisa normale assegnata al ragazzo.
-- Le maglie da libero non lo cambiano; togliere la divisa lascia il numero com'è.
create or replace function divise_allinea_numero_roster() returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.roster_id is not null and not new.libero then
    update roster set numero = new.numero where id = new.roster_id and numero is distinct from new.numero;
  end if;
  return null;
end;
$$;

drop trigger if exists divise_numero_roster on divise;
create trigger divise_numero_roster after insert or update of numero, roster_id, libero on divise
  for each row execute function divise_allinea_numero_roster();

-- Allinea le divise già assegnate.
update roster r set numero = d.numero
from divise d
where d.roster_id = r.id and not d.libero and r.numero is distinct from d.numero;
