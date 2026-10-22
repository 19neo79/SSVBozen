import { useState } from 'react';
import type { RosterPlayer } from '../../types/database';
import { playerCategory } from '../../lib/categoria';

/** Foto tonda dell'atleta; senza foto, le iniziali su sfondo del colore della categoria in cui gioca. */
export function FotoAtleta({ player, url, size = 44, quadrata = false }: { player: RosterPlayer; url?: string; size?: number; quadrata?: boolean }) {
  const cat = playerCategory(player.data_nascita);
  const u15 = cat === 'U15' || (cat === 'U14' && player.solo_u15);
  const stile = { width: size, height: size, fontSize: Math.round(size * 0.36), borderRadius: quadrata ? 10 : undefined };
  const iniziali = `${player.nome?.[0] || ''}${player.cognome?.[0] || ''}`.toUpperCase();
  return (
    <span className={`foto-atleta foto-atleta-vuota ${u15 ? 'u15' : 'u14'}`} style={stile} aria-hidden={url ? undefined : true}>
      {iniziali}
      {/* Si scarica solo quando la riga è visibile; finché non è pronta restano le iniziali. */}
      {url && <FotoCaricata key={url} url={url} alt={`${player.cognome} ${player.nome}`} />}
    </span>
  );
}

function FotoCaricata({ url, alt }: { url: string; alt: string }) {
  const [pronta, setPronta] = useState(false);
  const [errore, setErrore] = useState(false);
  if (errore) return null;
  return (
    <img
      className={`foto-atleta-img${pronta ? ' pronta' : ''}`}
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setPronta(true)}
      onError={() => setErrore(true)}
    />
  );
}
