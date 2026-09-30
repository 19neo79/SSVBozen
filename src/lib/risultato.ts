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
