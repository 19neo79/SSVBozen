-- Risultato partita, sempre dal punto di vista di SSV: set vinti/persi e parziali set per set.
-- parziali: array di {"noi": int, "loro": int}; se presente, risultato_noi/loro ne derivano.
alter table matches add column if not exists risultato_noi smallint;
alter table matches add column if not exists risultato_loro smallint;
alter table matches add column if not exists parziali jsonb not null default '[]'::jsonb;

-- Il risultato non è riservato: lo esponiamo anche nella pagina pubblica /campionato.
create or replace view public_matches with (security_invoker = false) as
  select id, data, orario, casa_trasferta, categoria, avversario, venue_id, luogo_custom, convocati,
         risultato_noi, risultato_loro, parziali
  from matches;
