import { COMUNI_ALTO_ADIGE } from '../data/comuniAltoAdige';
import { FRAZIONI_ALTO_ADIGE } from '../data/frazioniAltoAdige';

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

export interface FrazioneAA {
  nome: string;
  nomeDe: string;
  comune: ComuneAA;
}

export const FRAZIONI_AA: FrazioneAA[] = FRAZIONI_ALTO_ADIGE.flatMap(([cc, nome, nomeDe]) => {
  const comune = COMUNI_AA.find((c) => c.cc === cc);
  return comune ? [{ nome, nomeDe, comune }] : [];
});

/** Voce dell'elenco dei comuni per una frazione: sceglierla imposta il suo comune. */
export function etichettaFrazione(f: FrazioneAA): string {
  return `${f.nome}${f.nomeDe ? ` / ${f.nomeDe}` : ''} – frazione di ${f.comune.nome}`;
}

export function frazioneDaEtichetta(testo: string): FrazioneAA | undefined {
  return FRAZIONI_AA.find((f) => etichettaFrazione(f) === testo);
}

/** Semplifica per confrontare: minuscole, senza accenti né punteggiatura, ß → ss. */
function semplifica(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Parole che non distinguono una via o un paese dall'altro: non contano nel confronto.
const GENERICHE = new Set(['via', 'viale', 'vicolo', 'piazza', 'piazzetta', 'strada', 'corso', 'largo', 'localita', 'loc', 'str', 'strasse', 'weg', 'gasse', 'platz', 'di', 'del', 'della', 'dei', 'de', 'd', 'la', 'il', 'san', 'santa', 'sant', 'st']);

function paroleUtili(s: string): string[] {
  return semplifica(s).split(' ').filter((w) => w.length >= 3 && !GENERICHE.has(w));
}

/** Distanza tra due parole: lettere da aggiungere, togliere, cambiare o scambiare di posto. */
function distanza(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/**
 * Quanto il testo scritto somiglia a un nome (più basso = più simile), null se troppo diverso.
 * Tollera 1 errore nelle parole fino a 6 lettere e 2 in quelle più lunghe, anche se la parola è scritta a metà.
 */
function somiglianza(testo: string, nomi: string[]): number | null {
  const cercate = paroleUtili(testo);
  if (!cercate.length) return null;
  const candidate = nomi.flatMap(paroleUtili);
  let totale = 0;
  for (const q of cercate) {
    const soglia = q.length <= 3 ? 0 : q.length <= 6 ? 1 : 2;
    let migliore = Infinity;
    for (const w of candidate) {
      migliore = Math.min(migliore, distanza(q, w));
      if (w.length > q.length) migliore = Math.min(migliore, distanza(q, w.slice(0, q.length)));
    }
    if (migliore > soglia) return null;
    totale += migliore;
  }
  return totale;
}

function piuSimili<T>(voci: T[], testo: string, nomi: (v: T) => string[], limit: number): T[] {
  return voci
    .map((v) => ({ v, s: somiglianza(testo, nomi(v)) }))
    .filter((x): x is { v: T; s: number } => x.s !== null)
    .sort((a, b) => a.s - b.s)
    .slice(0, limit)
    .map((x) => x.v);
}

/** Frazioni il cui nome (italiano o tedesco) inizia con il testo scritto. */
export function cercaFrazioni(testo: string, limit = 15): FrazioneAA[] {
  const q = semplifica(testo);
  if (q.length < 2) return [];
  const inizia = (s: string) => {
    const n = semplifica(s);
    return n.startsWith(q) || n.split(' ').some((w) => w.startsWith(q));
  };
  return FRAZIONI_AA.filter((f) => inizia(f.nome) || (f.nomeDe && inizia(f.nomeDe))).slice(0, limit);
}

export type LuogoAA = { tipo: 'comune'; comune: ComuneAA } | { tipo: 'frazione'; frazione: FrazioneAA };

/** Per "Forse intendevi…": comuni e frazioni dal nome simile, anche con errori di battitura. */
export function luoghiSimili(testo: string, limit = 4): LuogoAA[] {
  const luoghi: LuogoAA[] = [
    ...COMUNI_AA.map((comune) => ({ tipo: 'comune' as const, comune })),
    ...FRAZIONI_AA.map((frazione) => ({ tipo: 'frazione' as const, frazione })),
  ];
  return piuSimili(luoghi, testo, (l) => (l.tipo === 'comune' ? [l.comune.nome, l.comune.nomeDe] : [l.frazione.nome, l.frazione.nomeDe]), limit);
}

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

/** Per "Forse intendevi…": vie dal nome simile, quando nessuna contiene esattamente il testo scritto. */
export function vieSimili(vie: Via[], testo: string, limit = 4): Via[] {
  return piuSimili(vie, testo, (v) => [v.n, v.d || ''], limit);
}

export function indirizzoCompleto(p: { indirizzo_via: string | null; indirizzo_civico: string | null; indirizzo_cap: string | null; indirizzo_comune: string | null }): string {
  const via = [p.indirizzo_via, p.indirizzo_civico].filter(Boolean).join(' ');
  const citta = [p.indirizzo_cap, p.indirizzo_comune].filter(Boolean).join(' ');
  return [via, citta].filter(Boolean).join(', ');
}
