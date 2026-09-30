import type { Match, RosterPlayer, Training } from '../types/database';
import { computePlayerAttendance, monthlyTrend, pastOnly, rate, soloInRosa, weekdayLabel } from './stats';
import { motivoLabel } from './assenze';
import { playerCategory } from './categoria';
import { fmtISODate, parseDateLocal } from './dates';
import { resolveLocation, type Locatable } from './location';

export interface Quota {
  pres: number;
  conv: number;
  rate: number | null;
}

export interface EventoReport {
  data: string;
  tipo: 'Allenamento' | 'Partita';
  dettaglio: string;
  luogo: string;
  quota: Quota;
  ritardi: number;
}

export interface GiocatoreReport {
  player: RosterPlayer;
  quota: Quota;
  ritardi: number;
  assenze: number;
  motivi: { label: string; n: number }[];
  strisciaAttuale: number;
  maxAssenzeFila: number;
}

export interface ReportMensile {
  mese: string;
  eventi: EventoReport[];
  allenamenti: number;
  partite: number;
  totale: Quota;
  alCompleto: number;
  assenze: number;
  assenzeGiustificate: number;
  motivi: { key: string; label: string; n: number }[];
  ritardi: number;
  ritardiMaxEvento: { n: number; data: string } | null;
  settimane: { label: string; eventi: number; quota: Quota }[];
  giorni: { label: string; eventi: number; quota: Quota }[];
  giocatori: GiocatoreReport[];
  categorie: { label: string; quota: Quota }[];
  mesePrecedente: Quota | null;
  mediaStagione: Quota;
}

const quota = (pres: number, conv: number): Quota => ({ pres, conv, rate: rate(pres, conv) });

// Le assenze senza motivo o segnate "non giustificata" non contano come giustificate.
const NON_GIUSTIFICATE = new Set(['non_giustificata', 'non_specificato']);

function prevMonthKey(mese: string): string {
  const [y, m] = mese.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function lunediDi(iso: string): string {
  const d = parseDateLocal(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return fmtISODate(d);
}

export function computeReportMensile(
  mese: string,
  trainings: Training[],
  matches: Match[],
  roster: RosterPlayer[],
  locatables: Locatable[],
  today: string,
): ReportMensile {
  const rosterIds = new Set(roster.map((p) => p.id));
  const tuttiAllenamenti = soloInRosa(pastOnly(trainings, today), rosterIds);
  const tuttePartite = soloInRosa(pastOnly(matches, today), rosterIds);
  const nelMese = (x: { data: string }) => x.data.slice(0, 7) === mese;
  const pt = tuttiAllenamenti.filter(nelMese);
  const pm = tuttePartite.filter(nelMese);

  const motiviMap = new Map<string, number>();
  let ritardi = 0;
  let ritardiMaxEvento: ReportMensile['ritardiMaxEvento'] = null;

  const conteggia = (
    e: { data: string; convocati: string[]; presenze: string[]; ritardi: string[]; motivi_assenza: Record<string, string> },
  ) => {
    const conv = e.convocati;
    const pres = e.presenze.filter((id) => conv.includes(id));
    const rit = e.ritardi.filter((id) => conv.includes(id)).length;
    conv.filter((id) => !pres.includes(id)).forEach((id) => {
      const key = e.motivi_assenza[id] || 'non_specificato';
      motiviMap.set(key, (motiviMap.get(key) || 0) + 1);
    });
    ritardi += rit;
    if (rit > 0 && (!ritardiMaxEvento || rit > ritardiMaxEvento.n)) ritardiMaxEvento = { n: rit, data: e.data };
    return { q: quota(pres.length, conv.length), rit };
  };

  const eventi: EventoReport[] = [
    ...pt.map((t) => {
      const { q, rit } = conteggia(t);
      return { data: t.data, tipo: 'Allenamento' as const, dettaglio: t.orario, luogo: resolveLocation(t.venue_id, t.palestra_custom, locatables).label, quota: q, ritardi: rit };
    }),
    ...pm.map((m) => {
      const { q, rit } = conteggia(m);
      return {
        data: m.data, tipo: 'Partita' as const, dettaglio: `${m.categoria} · ${m.casa_trasferta} vs ${m.avversario}`,
        luogo: resolveLocation(m.venue_id, m.luogo_custom, locatables).label, quota: q, ritardi: rit,
      };
    }),
  ].sort((a, b) => a.data.localeCompare(b.data));

  const totale = quota(eventi.reduce((s, e) => s + e.quota.pres, 0), eventi.reduce((s, e) => s + e.quota.conv, 0));
  const motivi = Array.from(motiviMap.entries())
    .map(([key, n]) => ({ key, label: key === 'non_specificato' ? 'Non indicato' : motivoLabel(key), n }))
    .sort((a, b) => b.n - a.n);
  const assenze = motivi.reduce((s, m) => s + m.n, 0);
  const assenzeGiustificate = motivi.filter((m) => !NON_GIUSTIFICATE.has(m.key)).reduce((s, m) => s + m.n, 0);

  const [anno, numMese] = mese.split('-').map(Number);
  const nomeMese = new Date(anno, numMese - 1, 1).toLocaleDateString('it-IT', { month: 'long' });
  const settimaneMap = new Map<string, EventoReport[]>();
  eventi.forEach((e) => {
    const k = lunediDi(e.data);
    if (!settimaneMap.has(k)) settimaneMap.set(k, []);
    settimaneMap.get(k)!.push(e);
  });
  const ultimoGiorno = new Date(anno, numMese, 0).getDate();
  const settimane = Array.from(settimaneMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([lunedi, evs]) => {
      const lun = parseDateLocal(lunedi);
      const inizio = lun.getMonth() + 1 === numMese ? lun.getDate() : 1;
      const dom = new Date(lun.getFullYear(), lun.getMonth(), lun.getDate() + 6);
      const fine = dom.getMonth() + 1 === numMese ? dom.getDate() : ultimoGiorno;
      return {
        label: `${inizio}–${fine} ${nomeMese}`,
        eventi: evs.length,
        quota: quota(evs.reduce((s, e) => s + e.quota.pres, 0), evs.reduce((s, e) => s + e.quota.conv, 0)),
      };
    });

  const giorniMap = new Map<number, EventoReport[]>();
  eventi.filter((e) => e.tipo === 'Allenamento').forEach((e) => {
    const wd = parseDateLocal(e.data).getDay();
    if (!giorniMap.has(wd)) giorniMap.set(wd, []);
    giorniMap.get(wd)!.push(e);
  });
  const giorni = [1, 2, 3, 4, 5, 6, 0]
    .filter((wd) => giorniMap.has(wd))
    .map((wd) => {
      const evs = giorniMap.get(wd)!;
      return {
        label: weekdayLabel(wd),
        eventi: evs.length,
        quota: quota(evs.reduce((s, e) => s + e.quota.pres, 0), evs.reduce((s, e) => s + e.quota.conv, 0)),
      };
    });

  const giocatori: GiocatoreReport[] = roster
    .map((p) => {
      const s = computePlayerAttendance(p.id, pt, pm);
      return {
        player: p,
        quota: quota(s.totalPres, s.totalConv),
        ritardi: s.totalRitardi,
        assenze: s.totalConv - s.totalPres,
        motivi: Object.entries(s.motivoBreakdown)
          .map(([k, n]) => ({ label: k === 'non_specificato' ? 'senza motivo' : motivoLabel(k).toLowerCase(), n }))
          .sort((a, b) => b.n - a.n),
        strisciaAttuale: s.currentStreak,
        maxAssenzeFila: s.maxAbsenceStreak,
      };
    })
    .filter((g) => g.quota.conv > 0)
    .sort((a, b) => (b.quota.rate ?? 0) - (a.quota.rate ?? 0) || b.quota.conv - a.quota.conv || a.player.cognome.localeCompare(b.player.cognome));

  const somma = (gs: GiocatoreReport[]) => quota(gs.reduce((s, g) => s + g.quota.pres, 0), gs.reduce((s, g) => s + g.quota.conv, 0));
  const u14 = giocatori.filter((g) => playerCategory(g.player.data_nascita) === 'U14' && !g.player.solo_u15);
  const u15 = giocatori.filter((g) => playerCategory(g.player.data_nascita) === 'U15' || (playerCategory(g.player.data_nascita) === 'U14' && g.player.solo_u15));
  const categorie = [
    { label: 'Under 14', quota: somma(u14) },
    { label: 'Under 15', quota: somma(u15) },
  ].filter((c) => c.quota.conv > 0);

  const trend = monthlyTrend(tuttiAllenamenti, tuttePartite);
  const prec = trend.find((m) => m.month === prevMonthKey(mese));
  const finoAlMese = trend.filter((m) => m.month <= mese);

  return {
    mese,
    eventi,
    allenamenti: pt.length,
    partite: pm.length,
    totale,
    alCompleto: giocatori.filter((g) => g.quota.pres === g.quota.conv).length,
    assenze,
    assenzeGiustificate,
    motivi,
    ritardi,
    ritardiMaxEvento,
    settimane,
    giorni,
    giocatori,
    categorie,
    mesePrecedente: prec ? quota(prec.totale.pres, prec.totale.conv) : null,
    mediaStagione: quota(finoAlMese.reduce((s, m) => s + m.totale.pres, 0), finoAlMese.reduce((s, m) => s + m.totale.conv, 0)),
  };
}

/** Mesi (YYYY-MM) con almeno un evento già svolto, dal più recente. */
export function mesiConEventi(trainings: Training[], matches: Match[], today: string): string[] {
  const set = new Set<string>();
  [...pastOnly(trainings, today), ...pastOnly(matches, today)].forEach((e) => set.add(e.data.slice(0, 7)));
  return Array.from(set).sort().reverse();
}
