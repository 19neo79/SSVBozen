import type { Categoria, Match, Training } from '../types/database';
import { parseDateLocal, todayISO } from './dates';

export interface CategoriaSplit {
  conv: number;
  pres: number;
}

export interface EventOutcome {
  data: string;
  type: 'training' | 'match';
  presente: boolean;
}

export interface PlayerAttendance {
  trainingConv: number;
  trainingPres: number;
  matchConv: number;
  matchPres: number;
  matchByCategoria: Record<Categoria, CategoriaSplit>;
  totalConv: number;
  totalPres: number;
  recent: EventOutcome[];
}

export interface TeamOverview {
  trainingsCount: number;
  matchesCount: number;
  matchesByCategoria: Record<Categoria, number>;
  matchesCasaTrasferta: { Casa: number; Trasferta: number };
  trainingConvTotal: number;
  trainingPresTotal: number;
  matchConvTotal: number;
  matchPresTotal: number;
  weekdayTraining: Record<number, CategoriaSplit>;
}

export interface MonthlyPoint {
  month: string;
  label: string;
  conv: number;
  pres: number;
  rate: number | null;
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

export function computePlayerAttendance(
  playerId: string,
  pastTrainings: Training[],
  pastMatches: Match[],
): PlayerAttendance {
  const trainingEvents = pastTrainings.filter((t) => (t.convocati || []).includes(playerId));
  const matchEvents = pastMatches.filter((m) => (m.convocati || []).includes(playerId));

  const trainingPres = trainingEvents.filter((t) => (t.presenze || []).includes(playerId)).length;

  const matchByCategoria: Record<Categoria, CategoriaSplit> = { U14: { conv: 0, pres: 0 }, U15: { conv: 0, pres: 0 } };
  let matchPres = 0;
  matchEvents.forEach((m) => {
    const cat: Categoria = m.categoria === 'U15' ? 'U15' : 'U14';
    matchByCategoria[cat].conv++;
    if ((m.presenze || []).includes(playerId)) {
      matchPres++;
      matchByCategoria[cat].pres++;
    }
  });

  const recent: EventOutcome[] = [
    ...trainingEvents.map((t) => ({ data: t.data, type: 'training' as const, presente: (t.presenze || []).includes(playerId) })),
    ...matchEvents.map((m) => ({ data: m.data, type: 'match' as const, presente: (m.presenze || []).includes(playerId) })),
  ]
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(-10);

  return {
    trainingConv: trainingEvents.length,
    trainingPres,
    matchConv: matchEvents.length,
    matchPres,
    matchByCategoria,
    totalConv: trainingEvents.length + matchEvents.length,
    totalPres: trainingPres + matchPres,
    recent,
  };
}

export function computeTeamOverview(pastTrainings: Training[], pastMatches: Match[]): TeamOverview {
  const matchesByCategoria: Record<Categoria, number> = { U14: 0, U15: 0 };
  const matchesCasaTrasferta = { Casa: 0, Trasferta: 0 };
  let matchConvTotal = 0;
  let matchPresTotal = 0;
  pastMatches.forEach((m) => {
    matchesByCategoria[m.categoria === 'U15' ? 'U15' : 'U14']++;
    matchesCasaTrasferta[m.casa_trasferta === 'Trasferta' ? 'Trasferta' : 'Casa']++;
    matchConvTotal += (m.convocati || []).length;
    matchPresTotal += (m.presenze || []).length;
  });

  let trainingConvTotal = 0;
  let trainingPresTotal = 0;
  const weekdayTraining: Record<number, CategoriaSplit> = {};
  pastTrainings.forEach((t) => {
    const conv = (t.convocati || []).length;
    const pres = (t.presenze || []).length;
    trainingConvTotal += conv;
    trainingPresTotal += pres;
    const wd = parseDateLocal(t.data).getDay();
    if (!weekdayTraining[wd]) weekdayTraining[wd] = { conv: 0, pres: 0 };
    weekdayTraining[wd].conv += conv;
    weekdayTraining[wd].pres += pres;
  });

  return {
    trainingsCount: pastTrainings.length,
    matchesCount: pastMatches.length,
    matchesByCategoria,
    matchesCasaTrasferta,
    trainingConvTotal,
    trainingPresTotal,
    matchConvTotal,
    matchPresTotal,
    weekdayTraining,
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

export function rateClass(r: number | null): string {
  if (r === null) return '';
  if (r >= 90) return 'rate-good';
  if (r >= 70) return 'rate-mid';
  return 'rate-bad';
}
