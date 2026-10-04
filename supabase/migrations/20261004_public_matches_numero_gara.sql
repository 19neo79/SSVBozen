-- La pagina pubblica /campionato mostra anche N. Gara FIPAV e l'etichetta amichevole.
create or replace view public_matches with (security_invoker = false) as
  select id, data, orario, casa_trasferta, categoria, avversario, venue_id, luogo_custom, convocati,
         risultato_noi, risultato_loro, parziali, numero_gara_fipav, amichevole
  from matches;
