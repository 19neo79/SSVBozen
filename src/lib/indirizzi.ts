import { COMUNI_ALTO_ADIGE } from '../data/comuniAltoAdige';

export interface ComuneAA {
  cc: string;
  nome: string;
  nomeDe: string;
  cap: string;
}

export interface Via {
  n: string;
  d?: string;
}

export const COMUNI_AA: ComuneAA[] = COMUNI_ALTO_ADIGE.map(([cc, nome, nomeDe, cap]) => ({ cc, nome, nomeDe, cap }));

const norm = (s: string) => s.trim().toLowerCase();

/** Riconosce un comune altoatesino dal nome italiano o tedesco. */
export function trovaComuneAA(testo: string): ComuneAA | undefined {
  const q = norm(testo);
  if (!q) return undefined;
  return COMUNI_AA.find((c) => norm(c.nome) === q || (c.nomeDe && norm(c.nomeDe) === q));
}

const cacheVie = new Map<string, Promise<Via[]>>();

/** Vie del comune da OpenStreetMap, caricate solo quando servono (file statici in /stradario). */
export function caricaVie(cc: string): Promise<Via[]> {
  if (!cacheVie.has(cc)) {
    cacheVie.set(
      cc,
      fetch(`/stradario/${cc}.json`)
        .then((r) => (r.ok ? r.json() : { vie: [] }))
        .then((j: { vie: Via[] }) => j.vie)
        .catch(() => {
          cacheVie.delete(cc);
          return [];
        }),
    );
  }
  return cacheVie.get(cc)!;
}

/** Suggerimenti: prima le vie che iniziano con il testo (in italiano o tedesco), poi quelle che lo contengono. */
export function cercaVie(vie: Via[], testo: string, limit = 50): Via[] {
  const q = norm(testo);
  if (!q) return vie.slice(0, limit);
  const parole = (v: Via) => [v.n, v.d || ''].map(norm);
  const inizio = vie.filter((v) => parole(v).some((p) => p.startsWith(q) || p.split(' ').some((w) => w.startsWith(q))));
  const resto = vie.filter((v) => !inizio.includes(v) && parole(v).some((p) => p.includes(q)));
  return [...inizio, ...resto].slice(0, limit);
}

export function indirizzoCompleto(p: { indirizzo_via: string | null; indirizzo_civico: string | null; indirizzo_cap: string | null; indirizzo_comune: string | null }): string {
  const via = [p.indirizzo_via, p.indirizzo_civico].filter(Boolean).join(' ');
  const citta = [p.indirizzo_cap, p.indirizzo_comune].filter(Boolean).join(' ');
  return [via, citta].filter(Boolean).join(', ');
}
