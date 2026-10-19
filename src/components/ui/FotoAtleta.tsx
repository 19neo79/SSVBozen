import type { RosterPlayer } from '../../types/database';
import { playerCategory } from '../../lib/categoria';

/** Foto tonda dell'atleta; senza foto, le iniziali su sfondo del colore della categoria in cui gioca. */
export function FotoAtleta({ player, url, size = 44 }: { player: RosterPlayer; url?: string; size?: number }) {
  const cat = playerCategory(player.data_nascita);
  const u15 = cat === 'U15' || (cat === 'U14' && player.solo_u15);
  const stile = { width: size, height: size, fontSize: Math.round(size * 0.36) };
  if (url) return <img className="foto-atleta" src={url} alt={`${player.cognome} ${player.nome}`} style={stile} />;
  const iniziali = `${player.nome?.[0] || ''}${player.cognome?.[0] || ''}`.toUpperCase();
  return (
    <span className={`foto-atleta foto-atleta-vuota ${u15 ? 'u15' : 'u14'}`} style={stile} aria-hidden="true">
      {iniziali}
    </span>
  );
}
