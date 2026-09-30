import type { Categoria, Match, SetParziale } from '../types/database';
import { hasRisultato } from './risultato';

export interface Bilancio {
  giocate: number;
  vinte: number;
  perse: number;
  setVinti: number;
  setPersi: number;
  puntiFatti: number;
  puntiSubiti: number;
  setConParziali: number;
}

export interface PartitaGiocata {
  match: Match;
  noi: number;
  loro: number;
  vinta: boolean;
  persa: boolean;
}

export interface RisultatiStats {
  partite: PartitaGiocata[];
  totale: Bilancio;
  partiteConParziali: number;
  puntiClassifica: number;
  partiteClassifica: number;
  distribuzione: { risultato: string; vinta: boolean; n: number }[];
  altriRisultati: number;
  perSet: { numero: number; giocati: number; vinti: number }[];
  tieBreak: { giocati: number; vinti: number };
  vantaggi: { giocati: number; vinti: number };
  puntoAPunto: { giocati: number; vinti: number };
  primoSetVinto: { partite: number; vinte: number };
  primoSetPerso: { partite: number; vinte: number };
  scartoMedioVinti: number | null;
  scartoMedioPersi: number | null;
  migliorSet: { set: SetParziale; match: Match } | null;
  peggiorSet: { set: SetParziale; match: Match } | null;
  strisciaAttuale: { tipo: 'V' | 'P'; n: number } | null;
  migliorStrisciaV: number;
  peggiorStrisciaP: number;
  casa: Bilancio;
  trasferta: Bilancio;
  perCategoria: Record<Categoria, Bilancio>;
  perAvversario: ({ nome: string; categoria: Categoria } & Bilancio)[];
}

function bilancioVuoto(): Bilancio {
  return { giocate: 0, vinte: 0, perse: 0, setVinti: 0, setPersi: 0, puntiFatti: 0, puntiSubiti: 0, setConParziali: 0 };
}

function aggiungi(b: Bilancio, p: PartitaGiocata) {
  b.giocate++;
  if (p.vinta) b.vinte++;
  if (p.persa) b.perse++;
  b.setVinti += p.noi;
  b.setPersi += p.loro;
  (p.match.parziali || []).forEach((s) => {
    b.puntiFatti += s.noi;
    b.puntiSubiti += s.loro;
    b.setConParziali++;
  });
}

// Classifica FIPAV: 3 punti per 3-0/3-1, 2 per 3-2, 1 per 2-3, 0 per 1-3/0-3.
export function puntiFipav(noi: number, loro: number): number | null {
  if (noi === 3) return loro === 2 ? 2 : 3;
  if (loro === 3) return noi === 2 ? 1 : 0;
  return null;
}

// Ai vantaggi: il set è andato oltre i 25 punti (15 al tie-break).
function aiVantaggi(s: SetParziale, numero: number): boolean {
  return Math.max(s.noi, s.loro) > (numero === 5 ? 15 : 25);
}

const RISULTATI_TIPICI: { risultato: string; vinta: boolean }[] = [
  { risultato: '3-0', vinta: true },
  { risultato: '3-1', vinta: true },
  { risultato: '3-2', vinta: true },
  { risultato: '2-3', vinta: false },
  { risultato: '1-3', vinta: false },
  { risultato: '0-3', vinta: false },
];

export function computeRisultatiStats(matches: Match[]): RisultatiStats {
  const partite: PartitaGiocata[] = matches
    .filter(hasRisultato)
    .sort((a, b) => (a.data === b.data ? a.orario.localeCompare(b.orario) : a.data.localeCompare(b.data)))
    .map((m) => ({
      match: m,
      noi: m.risultato_noi!,
      loro: m.risultato_loro!,
      vinta: m.risultato_noi! > m.risultato_loro!,
      persa: m.risultato_noi! < m.risultato_loro!,
    }));

  const totale = bilancioVuoto();
  const casa = bilancioVuoto();
  const trasferta = bilancioVuoto();
  const perCategoria: Record<Categoria, Bilancio> = { U14: bilancioVuoto(), U15: bilancioVuoto() };
  const avversari = new Map<string, { nome: string; categoria: Categoria } & Bilancio>();
  const conteggioRisultati = new Map<string, number>();
  const perSet = [1, 2, 3, 4, 5].map((numero) => ({ numero, giocati: 0, vinti: 0 }));
  const tieBreak = { giocati: 0, vinti: 0 };
  const vantaggi = { giocati: 0, vinti: 0 };
  const puntoAPunto = { giocati: 0, vinti: 0 };
  const primoSetVinto = { partite: 0, vinte: 0 };
  const primoSetPerso = { partite: 0, vinte: 0 };
  const scartiVinti: number[] = [];
  const scartiPersi: number[] = [];
  let migliorSet: RisultatiStats['migliorSet'] = null;
  let peggiorSet: RisultatiStats['peggiorSet'] = null;
  let puntiClassifica = 0;
  let partiteClassifica = 0;
  let partiteConParziali = 0;

  partite.forEach((p) => {
    const m = p.match;
    aggiungi(totale, p);
    aggiungi(m.casa_trasferta === 'Casa' ? casa : trasferta, p);
    aggiungi(perCategoria[m.categoria || 'U14'], p);

    const chiaveAvv = `${m.categoria}|${m.avversario.trim().toLowerCase()}`;
    if (!avversari.has(chiaveAvv)) avversari.set(chiaveAvv, { nome: m.avversario, categoria: m.categoria, ...bilancioVuoto() });
    aggiungi(avversari.get(chiaveAvv)!, p);

    const chiaveRis = `${p.noi}-${p.loro}`;
    conteggioRisultati.set(chiaveRis, (conteggioRisultati.get(chiaveRis) || 0) + 1);

    const pf = puntiFipav(p.noi, p.loro);
    if (pf !== null) {
      puntiClassifica += pf;
      partiteClassifica++;
    }

    const parziali = m.parziali || [];
    if (parziali.length === 0) return;
    partiteConParziali++;

    parziali.forEach((s, i) => {
      const numero = i + 1;
      const vinto = s.noi > s.loro;
      const scarto = Math.abs(s.noi - s.loro);
      if (perSet[i]) {
        perSet[i].giocati++;
        if (vinto) perSet[i].vinti++;
      }
      if (numero === 5) {
        tieBreak.giocati++;
        if (vinto) tieBreak.vinti++;
      }
      if (aiVantaggi(s, numero)) {
        vantaggi.giocati++;
        if (vinto) vantaggi.vinti++;
      }
      if (scarto <= 3) {
        puntoAPunto.giocati++;
        if (vinto) puntoAPunto.vinti++;
      }
      if (vinto) {
        scartiVinti.push(scarto);
        if (!migliorSet || scarto > migliorSet.set.noi - migliorSet.set.loro) migliorSet = { set: s, match: m };
      } else {
        scartiPersi.push(scarto);
        if (!peggiorSet || scarto > peggiorSet.set.loro - peggiorSet.set.noi) peggiorSet = { set: s, match: m };
      }
    });

    const primo = parziali[0];
    if (primo.noi > primo.loro) {
      primoSetVinto.partite++;
      if (p.vinta) primoSetVinto.vinte++;
    } else {
      primoSetPerso.partite++;
      if (p.vinta) primoSetPerso.vinte++;
    }
  });

  let strisciaAttuale: RisultatiStats['strisciaAttuale'] = null;
  let migliorStrisciaV = 0;
  let peggiorStrisciaP = 0;
  let corrV = 0;
  let corrP = 0;
  partite.forEach((p) => {
    corrV = p.vinta ? corrV + 1 : 0;
    corrP = p.persa ? corrP + 1 : 0;
    migliorStrisciaV = Math.max(migliorStrisciaV, corrV);
    peggiorStrisciaP = Math.max(peggiorStrisciaP, corrP);
  });
  if (corrV > 0) strisciaAttuale = { tipo: 'V', n: corrV };
  else if (corrP > 0) strisciaAttuale = { tipo: 'P', n: corrP };

  const media = (xs: number[]) => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const tipici = new Set(RISULTATI_TIPICI.map((r) => r.risultato));

  return {
    partite,
    totale,
    partiteConParziali,
    puntiClassifica,
    partiteClassifica,
    distribuzione: RISULTATI_TIPICI.map((r) => ({ ...r, n: conteggioRisultati.get(r.risultato) || 0 })),
    altriRisultati: Array.from(conteggioRisultati.entries()).filter(([k]) => !tipici.has(k)).reduce((a, [, n]) => a + n, 0),
    perSet,
    tieBreak,
    vantaggi,
    puntoAPunto,
    primoSetVinto,
    primoSetPerso,
    scartoMedioVinti: media(scartiVinti),
    scartoMedioPersi: media(scartiPersi),
    migliorSet,
    peggiorSet,
    strisciaAttuale,
    migliorStrisciaV,
    peggiorStrisciaP,
    casa,
    trasferta,
    perCategoria,
    perAvversario: Array.from(avversari.values()).sort((a, b) => b.giocate - a.giocate || a.nome.localeCompare(b.nome)),
  };
}

export function perc(n: number, d: number): number | null {
  return d > 0 ? Math.round((n / d) * 100) : null;
}

export function quoziente(n: number, d: number): string {
  if (d === 0) return n > 0 ? '∞' : '—';
  return (n / d).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function decimale(n: number | null, cifre = 1): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('it-IT', { minimumFractionDigits: cifre, maximumFractionDigits: cifre });
}

