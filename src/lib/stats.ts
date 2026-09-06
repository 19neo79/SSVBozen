import type { Categoria, Match, Training } from '../types/database';
import { fmtISODate, parseDateLocal, todayISO } from './dates';

export interface CategoriaSplit {
  conv: number;
  pres: number;
}

export interface EventOutcome {
  data: string;
  type: 'training' | 'match';
  presente: boolean;
  ritardo: boolean;
}

export interface PlayerAttendance {
  trainingConv: number;
  trainingPres: number;
  trainingRitardi: number;
  matchConv: number;
  matchPres: number;
  matchRitardi: number;
  matchByCategoria: Record<Categoria, CategoriaSplit>;
  totalConv: number;
  totalPres: number;
  totalRitardi: number;
  recent: EventOutcome[];
  fullChronology: EventOutcome[];
  currentStreak: number;
  maxStreak: number;
  maxAbsenceStreak: number;
  firstEventDate: string | null;
  lastEventDate: string | null;
  soloAssenteCount: number;
  motivoBreakdown: Record<string, number>;
  monthlyPresence: MonthlyPoint[];
  weekdayTraining: Record<number, CategoriaSplit>;
  reliabilityScore: number | null;
}

export interface TeamOverview {
  trainingsCount: number;
  matchesCount: number;
  matchesByCategoria: Record<Categoria, number>;
  matchesCasaTrasferta: { Casa: number; Trasferta: number };
  trainingConvTotal: number;
  trainingPresTotal: number;
  trainingRitardiTotal: number;
  matchConvTotal: number;
  matchPresTotal: number;
  matchRitardiTotal: number;
  weekdayTraining: Record<number, CategoriaSplit>;
  motivoBreakdown: Record<string, number>;
}

export interface MonthlyPoint {
  month: string;
  label: string;
  conv: number;
  pres: number;
  rate: number | null;
}

export interface EventSummary {
  id: string;
  data: string;
  type: 'training' | 'match';
  label: string;
  convocati: string[];
  presenti: string[];
  rate: number | null;
}

export interface GironeSplit {
  conv: number;
  pres: number;
  rate: number | null;
}

export interface GironeComparison {
  girone1: GironeSplit;
  girone2: GironeSplit;
  splitDate: string | null;
}

/** Percentuale presenze/convocazioni, o null se non ci sono state convocazioni. */
export function rate(pres: number, conv: number): number | null {
  return conv > 0 ? Math.round((pres / conv) * 100) : null;
}

/** Filtra eventi la cui data e' oggi o nel passato (le presenze future non sono ancora significative). */
export function pastOnly<T extends { data: string }>(items: T[], today: string = todayISO()): T[] {
  return items.filter((i) => i.data <= today);
}

const WEEKDAY_LABELS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
export function weekdayLabel(day: number): string {
  return WEEKDAY_LABELS[day] || '';
}

const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_LABELS[(m || 1) - 1]} ${String(y).slice(-2)}`;
}

export function rateClass(r: number | null): string {
  if (r === null) return '';
  if (r >= 90) return 'rate-good';
  if (r >= 70) return 'rate-mid';
  return 'rate-bad';
}

export function computePlayerAttendance(
  playerId: string,
  pastTrainings: Training[],
  pastMatches: Match[],
): PlayerAttendance {
  const trainingEvents = pastTrainings.filter((t) => (t.convocati || []).includes(playerId));
  const matchEvents = pastMatches.filter((m) => (m.convocati || []).includes(playerId));

  const trainingPres = trainingEvents.filter((t) => (t.presenze || []).includes(playerId)).length;
  const trainingRitardi = trainingEvents.filter((t) => (t.ritardi || []).includes(playerId)).length;

  const matchByCategoria: Record<Categoria, CategoriaSplit> = { U14: { conv: 0, pres: 0 }, U15: { conv: 0, pres: 0 } };
  let matchPres = 0;
  let matchRitardi = 0;
  matchEvents.forEach((m) => {
    const cat: Categoria = m.categoria === 'U15' ? 'U15' : 'U14';
    matchByCategoria[cat].conv++;
    const presente = (m.presenze || []).includes(playerId);
    if (presente) {
      matchPres++;
      matchByCategoria[cat].pres++;
      if ((m.ritardi || []).includes(playerId)) matchRitardi++;
    }
  });

  const fullChronology: EventOutcome[] = [
    ...trainingEvents.map((t) => ({
      data: t.data,
      type: 'training' as const,
      presente: (t.presenze || []).includes(playerId),
      ritardo: (t.ritardi || []).includes(playerId),
    })),
    ...matchEvents.map((m) => ({
      data: m.data,
      type: 'match' as const,
      presente: (m.presenze || []).includes(playerId),
      ritardo: (m.ritardi || []).includes(playerId),
    })),
  ].sort((a, b) => a.data.localeCompare(b.data));

  let currentStreak = 0;
  for (let i = fullChronology.length - 1; i >= 0; i--) {
    if (fullChronology[i].presente) currentStreak++;
    else break;
  }
  let maxStreak = 0;
  let run = 0;
  let maxAbsenceStreak = 0;
  let absRun = 0;
  fullChronology.forEach((e) => {
    if (e.presente) {
      run++;
      maxStreak = Math.max(maxStreak, run);
      absRun = 0;
    } else {
      absRun++;
      maxAbsenceStreak = Math.max(maxAbsenceStreak, absRun);
      run = 0;
    }
  });

  const firstEventDate = fullChronology.length > 0 ? fullChronology[0].data : null;
  const lastEventDate = fullChronology.length > 0 ? fullChronology[fullChronology.length - 1].data : null;

  let soloAssenteCount = 0;
  [...trainingEvents, ...matchEvents].forEach((ev) => {
    const conv = ev.convocati || [];
    const pres = ev.presenze || [];
    const assentiCount = conv.length - pres.length;
    if (assentiCount === 1 && conv.includes(playerId) && !pres.includes(playerId)) soloAssenteCount++;
  });

  const motivoBreakdown: Record<string, number> = {};
  [...trainingEvents, ...matchEvents].forEach((ev) => {
    const presente = (ev.presenze || []).includes(playerId);
    if (!presente) {
      const m = (ev.motivi_assenza || {})[playerId];
      const key = m || 'non_specificato';
      motivoBreakdown[key] = (motivoBreakdown[key] || 0) + 1;
    }
  });

  const monthlyMap = new Map<string, CategoriaSplit>();
  fullChronology.forEach((e) => {
    const key = e.data.slice(0, 7);
    if (!monthlyMap.has(key)) monthlyMap.set(key, { conv: 0, pres: 0 });
    const slot = monthlyMap.get(key)!;
    slot.conv++;
    if (e.presente) slot.pres++;
  });
  const monthlyPresence: MonthlyPoint[] = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({ month: key, label: monthLabel(key), conv: v.conv, pres: v.pres, rate: rate(v.pres, v.conv) }));

  const weekdayTraining: Record<number, CategoriaSplit> = {};
  trainingEvents.forEach((t) => {
    const wd = parseDateLocal(t.data).getDay();
    if (!weekdayTraining[wd]) weekdayTraining[wd] = { conv: 0, pres: 0 };
    weekdayTraining[wd].conv++;
    if ((t.presenze || []).includes(playerId)) weekdayTraining[wd].pres++;
  });

  const totalConv = trainingEvents.length + matchEvents.length;
  const totalPres = trainingPres + matchPres;
  const weightedConv = trainingEvents.length * 1 + matchEvents.length * 2;
  const weightedPres = trainingPres * 1 + matchPres * 2;
  const reliabilityScore = weightedConv > 0 ? Math.round((weightedPres / weightedConv) * 100) : null;

  return {
    trainingConv: trainingEvents.length,
    trainingPres,
    trainingRitardi,
    matchConv: matchEvents.length,
    matchPres,
    matchRitardi,
    matchByCategoria,
    totalConv,
    totalPres,
    totalRitardi: trainingRitardi + matchRitardi,
    recent: fullChronology.slice(-10),
    fullChronology,
    currentStreak,
    maxStreak,
    maxAbsenceStreak,
    firstEventDate,
    lastEventDate,
    soloAssenteCount,
    motivoBreakdown,
    monthlyPresence,
    weekdayTraining,
    reliabilityScore,
  };
}

export function computeTeamOverview(pastTrainings: Training[], pastMatches: Match[]): TeamOverview {
  const matchesByCategoria: Record<Categoria, number> = { U14: 0, U15: 0 };
  const matchesCasaTrasferta = { Casa: 0, Trasferta: 0 };
  let matchConvTotal = 0;
  let matchPresTotal = 0;
  let matchRitardiTotal = 0;
  pastMatches.forEach((m) => {
    matchesByCategoria[m.categoria === 'U15' ? 'U15' : 'U14']++;
    matchesCasaTrasferta[m.casa_trasferta === 'Trasferta' ? 'Trasferta' : 'Casa']++;
    matchConvTotal += (m.convocati || []).length;
    matchPresTotal += (m.presenze || []).length;
    matchRitardiTotal += (m.ritardi || []).length;
  });

  let trainingConvTotal = 0;
  let trainingPresTotal = 0;
  let trainingRitardiTotal = 0;
  const weekdayTraining: Record<number, CategoriaSplit> = {};
  pastTrainings.forEach((t) => {
    const conv = (t.convocati || []).length;
    const pres = (t.presenze || []).length;
    trainingConvTotal += conv;
    trainingPresTotal += pres;
    trainingRitardiTotal += (t.ritardi || []).length;
    const wd = parseDateLocal(t.data).getDay();
    if (!weekdayTraining[wd]) weekdayTraining[wd] = { conv: 0, pres: 0 };
    weekdayTraining[wd].conv += conv;
    weekdayTraining[wd].pres += pres;
  });

  const motivoBreakdown: Record<string, number> = {};
  [...pastTrainings, ...pastMatches].forEach((ev) => {
    const conv = ev.convocati || [];
    const pres = ev.presenze || [];
    conv.filter((id) => !pres.includes(id)).forEach((id) => {
      const m = (ev.motivi_assenza || {})[id];
      const key = m || 'non_specificato';
      motivoBreakdown[key] = (motivoBreakdown[key] || 0) + 1;
    });
  });

  return {
    trainingsCount: pastTrainings.length,
    matchesCount: pastMatches.length,
    matchesByCategoria,
    matchesCasaTrasferta,
    trainingConvTotal,
    trainingPresTotal,
    trainingRitardiTotal,
    matchConvTotal,
    matchPresTotal,
    matchRitardiTotal,
    weekdayTraining,
    motivoBreakdown,
  };
}

/** Andamento mensile della presenza agli allenamenti lungo la stagione. */
export function monthlyTrainingTrend(pastTrainings: Training[]): MonthlyPoint[] {
  const map = new Map<string, CategoriaSplit>();
  pastTrainings.forEach((t) => {
    const key = t.data.slice(0, 7);
    if (!map.has(key)) map.set(key, { conv: 0, pres: 0 });
    const e = map.get(key)!;
    e.conv += (t.convocati || []).length;
    e.pres += (t.presenze || []).length;
  });
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({ month: key, label: monthLabel(key), conv: v.conv, pres: v.pres, rate: rate(v.pres, v.conv) }));
}

/** Elenco unificato di allenamenti+partite passati con conteggi, per trovare estremi ed eventi al 100%. */
export function buildEventSummaries(pastTrainings: Training[], pastMatches: Match[]): EventSummary[] {
  const fromTrainings: EventSummary[] = pastTrainings.map((t) => {
    const convocati = t.convocati || [];
    const presenti = (t.presenze || []).filter((id) => convocati.includes(id));
    return { id: t.id, data: t.data, type: 'training', label: 'Allenamento', convocati, presenti, rate: rate(presenti.length, convocati.length) };
  });
  const fromMatches: EventSummary[] = pastMatches.map((m) => {
    const convocati = m.convocati || [];
    const presenti = (m.presenze || []).filter((id) => convocati.includes(id));
    return { id: m.id, data: m.data, type: 'match', label: `Partita vs ${m.avversario}`, convocati, presenti, rate: rate(presenti.length, convocati.length) };
  });
  return [...fromTrainings, ...fromMatches].sort((a, b) => a.data.localeCompare(b.data));
}

export function eventExtremes(events: EventSummary[]): { best: EventSummary | null; worst: EventSummary | null } {
  const withRate = events.filter((e) => e.rate !== null);
  if (withRate.length === 0) return { best: null, worst: null };
  let best = withRate[0];
  let worst = withRate[0];
  withRate.forEach((e) => {
    if ((e.rate as number) > (best.rate as number)) best = e;
    if ((e.rate as number) < (worst.rate as number)) worst = e;
  });
  return { best, worst };
}

export function perfectAttendanceCount(events: EventSummary[]): number {
  return events.filter((e) => e.convocati.length > 0 && e.rate === 100).length;
}

/** Confronto tra prima e seconda meta' della stagione (spaccata automaticamente a meta' tra il primo e l'ultimo evento). */
export function gironeComparison(events: EventSummary[]): GironeComparison {
  if (events.length === 0) {
    return { girone1: { conv: 0, pres: 0, rate: null }, girone2: { conv: 0, pres: 0, rate: null }, splitDate: null };
  }
  const first = parseDateLocal(events[0].data).getTime();
  const last = parseDateLocal(events[events.length - 1].data).getTime();
  const splitDate = fmtISODate(new Date((first + last) / 2));

  const sum = (list: EventSummary[]): GironeSplit => {
    const conv = list.reduce((acc, e) => acc + e.convocati.length, 0);
    const pres = list.reduce((acc, e) => acc + e.presenti.length, 0);
    return { conv, pres, rate: rate(pres, conv) };
  };

  return {
    girone1: sum(events.filter((e) => e.data <= splitDate)),
    girone2: sum(events.filter((e) => e.data > splitDate)),
    splitDate,
  };
}
