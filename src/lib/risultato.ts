import type { SetParziale } from '../types/database';

export function setVinti(parziali: SetParziale[]): { noi: number; loro: number } {
  return {
    noi: parziali.filter((s) => s.noi > s.loro).length,
    loro: parziali.filter((s) => s.loro > s.noi).length,
  };
}

export function fmtParziali(parziali: SetParziale[]): string {
  return parziali.map((s) => `${s.noi}-${s.loro}`).join(', ');
}

type ConRisultato = { risultato_noi?: number | null; risultato_loro?: number | null };

export function hasRisultato(m: ConRisultato): boolean {
  return m.risultato_noi != null && m.risultato_loro != null;
}

export function esito(m: ConRisultato): 'Vinta' | 'Persa' | 'Pari' | null {
  if (!hasRisultato(m)) return null;
  if (m.risultato_noi! > m.risultato_loro!) return 'Vinta';
  if (m.risultato_noi! < m.risultato_loro!) return 'Persa';
  return 'Pari';
}

/** Regole FIPAV del singolo set: almeno 25 punti (15 al tie-break) e 2 di scarto; oltre, scarto esattamente 2. */
export function erroreSet(s: SetParziale, numero: number): string | null {
  const minimo = numero === 5 ? 15 : 25;
  const vincente = Math.max(s.noi, s.loro);
  const scarto = Math.abs(s.noi - s.loro);
  if (scarto === 0) return `il ${numero}° set non può finire in parità`;
  if (vincente < minimo) return `nel ${numero}° set (${s.noi}-${s.loro}) chi vince deve arrivare almeno a ${minimo}`;
  if (scarto < 2) return `nel ${numero}° set (${s.noi}-${s.loro}) servono almeno 2 punti di scarto`;
  if (vincente > minimo && scarto !== 2) return `nel ${numero}° set (${s.noi}-${s.loro}) oltre i ${minimo} punti si vince con esattamente 2 punti di scarto`;
  return null;
}
