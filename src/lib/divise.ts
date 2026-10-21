import type { Divisa, GruppoDivisa, RosterPlayer, TagliaDivisa } from '../types/database';

export const GRUPPI_DIVISA: GruppoDivisa[] = ['U17', 'U14-15', 'U12-13'];
export const TAGLIE: TagliaDivisa[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

export function etichettaGruppo(g: GruppoDivisa | null): string {
  return g ?? 'Da assegnare';
}

/** Per confrontare i nomi scritti a mano: senza maiuscole né spazi superflui. */
export function normalizzaNome(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Gruppo nell'ordine U17, U14-15, U12-13, poi da assegnare; normali prima dei liberi; poi numero. */
export function ordinaDivise(d: Divisa[]): Divisa[] {
  const posGruppo = (g: GruppoDivisa | null) => (g ? GRUPPI_DIVISA.indexOf(g) : GRUPPI_DIVISA.length);
  return [...d].sort((a, b) => posGruppo(a.gruppo) - posGruppo(b.gruppo) || Number(a.libero) - Number(b.libero) || a.numero - b.numero);
}

export type ColonnaRiepilogo = GruppoDivisa | 'nessuno' | 'totale';
export interface CellaRiepilogo {
  totale: number;
  libero: number;
}
export interface Riepilogo {
  righe: { taglia: TagliaDivisa; celle: Record<ColonnaRiepilogo, CellaRiepilogo> }[];
  totali: Record<ColonnaRiepilogo, CellaRiepilogo>;
  assegnate: number;
  libere: number;
}

export const COLONNE_RIEPILOGO: ColonnaRiepilogo[] = [...GRUPPI_DIVISA, 'nessuno', 'totale'];

function celleVuote(): Record<ColonnaRiepilogo, CellaRiepilogo> {
  return Object.fromEntries(COLONNE_RIEPILOGO.map((c) => [c, { totale: 0, libero: 0 }])) as Record<ColonnaRiepilogo, CellaRiepilogo>;
}

/** Quante divise per taglia (righe) e gruppo (colonne), con quante sono da libero. */
export function riepilogo(d: Divisa[]): Riepilogo {
  const righe = TAGLIE.map((taglia) => ({ taglia, celle: celleVuote() }));
  const totali = celleVuote();
  let assegnate = 0;
  for (const x of d) {
    const riga = righe.find((r) => r.taglia === x.taglia);
    for (const col of [x.gruppo ?? 'nessuno', 'totale'] as ColonnaRiepilogo[]) {
      for (const celle of riga ? [riga.celle, totali] : [totali]) {
        celle[col].totale += 1;
        if (x.libero) celle[col].libero += 1;
      }
    }
    if (x.giocatore_nome) assegnate += 1;
  }
  return { righe, totali, assegnate, libere: d.length - assegnate };
}

/** Id delle divise con lo stesso numero nello stesso gruppo e dello stesso tipo (senza gruppo non conta). */
export function numeriDoppi(d: Divisa[]): Set<string> {
  const perChiave = new Map<string, string[]>();
  for (const x of d) {
    if (!x.gruppo) continue;
    const k = `${x.gruppo}|${x.numero}|${x.libero}`;
    perChiave.set(k, [...(perChiave.get(k) || []), x.id]);
  }
  return new Set([...perChiave.values()].filter((ids) => ids.length > 1).flat());
}

export interface Assegnazione {
  id: string | null;
  roster_id: string | null;
  giocatore_nome: string | null;
  libero: boolean;
}

/**
 * L'altra divisa dello stesso tipo che quel ragazzo ha già, se c'è (una normale e una da libero al massimo).
 * Stesso ragazzo = stesso id della rosa, oppure stesso nome quando almeno una delle due divise è scritta a mano
 * (es. assegnata prima che entrasse in rosa, o dopo che ne è uscito). Due ragazzi della rosa omonimi restano distinti.
 */
export function divisaInConflitto(d: Divisa[], a: Assegnazione): Divisa | undefined {
  const nome = a.giocatore_nome ? normalizzaNome(a.giocatore_nome) : '';
  if (!a.roster_id && !nome) return undefined;
  return d.find((x) => {
    if (x.id === a.id || x.libero !== a.libero) return false;
    if (a.roster_id && x.roster_id === a.roster_id) return true;
    const stessoNome = !!nome && !!x.giocatore_nome && normalizzaNome(x.giocatore_nome) === nome;
    return stessoNome && (!x.roster_id || !a.roster_id);
  });
}

export interface Blocco {
  gruppo: GruppoDivisa | null;
  da: number;
  a: number;
  taglia: TagliaDivisa;
  libero: boolean;
}

export function erroreBlocco(b: Blocco): string | null {
  if (!Number.isInteger(b.da) || !Number.isInteger(b.a) || b.da < 0 || b.a > 99) return 'I numeri vanno da 0 a 99';
  if (b.da > b.a) return 'Il numero iniziale deve essere minore o uguale a quello finale';
  return null;
}

export function creaBlocco(b: Blocco): Pick<Divisa, 'gruppo' | 'numero' | 'taglia' | 'libero'>[] {
  return Array.from({ length: b.a - b.da + 1 }, (_, i) => ({ gruppo: b.gruppo, numero: b.da + i, taglia: b.taglia, libero: b.libero }));
}

/** Nome da mostrare: quello attuale della rosa se il ragazzo c'è ancora, altrimenti quello salvato. */
export function nomeGiocatore(d: Divisa, rosa: RosterPlayer[]): { nome: string | null; fuoriRosa: boolean } {
  if (d.roster_id) {
    const r = rosa.find((p) => p.id === d.roster_id);
    if (r) return { nome: `${r.nome} ${r.cognome}`, fuoriRosa: false };
    return { nome: d.giocatore_nome, fuoriRosa: true };
  }
  return { nome: d.giocatore_nome, fuoriRosa: false };
}

/** Ragazzi della rosa senza nessuna divisa, per cognome (conta anche una divisa con il loro nome scritto a mano). */
export function rosaSenzaDivisa(rosa: RosterPlayer[], d: Divisa[]): RosterPlayer[] {
  const conDivisa = new Set(d.map((x) => x.roster_id).filter(Boolean));
  const nomiAMano = new Set(d.filter((x) => !x.roster_id && x.giocatore_nome).map((x) => normalizzaNome(x.giocatore_nome!)));
  return rosa.filter((p) => !conDivisa.has(p.id) && !nomiAMano.has(normalizzaNome(`${p.nome} ${p.cognome}`))).sort((a, b) => a.cognome.localeCompare(b.cognome, 'it') || a.nome.localeCompare(b.nome, 'it'));
}

/** Le azioni su più divise valgono solo per quelle selezionate che si vedono con i filtri attuali. */
export function selezioneVisibile(selezione: Set<string>, visibili: Divisa[]): string[] {
  return visibili.filter((x) => selezione.has(x.id)).map((x) => x.id);
}

/** Numeri del blocco già usati nello stesso gruppo e tipo: avviso, non blocco (senza gruppo non conta). */
export function numeriGiaPresenti(d: Divisa[], b: Blocco): number[] {
  if (!b.gruppo) return [];
  const usati = new Set(d.filter((x) => x.gruppo === b.gruppo && x.libero === b.libero).map((x) => x.numero));
  return creaBlocco(b).map((x) => x.numero).filter((n) => usati.has(n));
}
