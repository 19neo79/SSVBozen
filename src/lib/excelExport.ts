import type { Match, RosterPlayer, Training } from '../types/database';
import type { PlayerAttendance, TeamOverview } from './stats';
import { rate } from './stats';
import { isGiustificata, motivoLabel } from './assenze';
import { playerCategory } from './categoria';
import { fmtDateShort, todayISO } from './dates';
import { resolveLocation, type Locatable } from './location';

interface ExportParams {
  clubName: string;
  players: RosterPlayer[];
  playerStats: Map<string, PlayerAttendance>;
  teamOverview: TeamOverview;
  pastTrainings: Training[];
  pastMatches: Match[];
  venues: Locatable[];
  teamTrainingRate: number | null;
  teamMatchRate: number | null;
  teamTotalRate: number | null;
  perEventAvg: number | null;
  certCounts: Record<string, number>;
  fedeltaCount: number;
}

type Row = (string | number)[];

function pct(r: number | null): string {
  return r === null ? '—' : `${r}%`;
}

function sheetNameFor(player: RosterPlayer, used: Set<string>): string {
  const raw = `${player.cognome} ${player.nome}`.trim().replace(/[:\\/?*[\]]/g, ' ');
  const base = raw.slice(0, 27) || 'Giocatore';
  let name = base;
  let i = 2;
  while (used.has(name.toLowerCase())) {
    name = `${base.slice(0, 27 - String(i).length - 1)} ${i}`;
    i++;
  }
  used.add(name.toLowerCase());
  return name;
}

function esitoFor(presente: boolean, ritardo: boolean, motivo: string | undefined): string {
  if (presente) return ritardo ? 'Presente (ritardo)' : 'Presente';
  return isGiustificata(motivo) ? 'Assente giustificata' : 'Assente non giustificata';
}

export async function exportStatsToExcel(params: ExportParams) {
  const XLSX = await import('xlsx');
  const {
    clubName, players, playerStats, teamOverview, pastTrainings, pastMatches, venues,
    teamTrainingRate, teamMatchRate, teamTotalRate, perEventAvg, certCounts, fedeltaCount,
  } = params;

  const wb = XLSX.utils.book_new();

  // ---- Scheda "Squadra" ----
  const teamRows: Row[] = [];
  teamRows.push([`${clubName} — Statistiche squadra`]);
  teamRows.push([`Esportato il ${fmtDateShort(todayISO())}`]);
  teamRows.push([]);
  teamRows.push(['Riepilogo stagione']);
  teamRows.push(['Giocatori in rosa', players.length]);
  teamRows.push(['Allenamenti svolti', pastTrainings.length]);
  teamRows.push(['Partite giocate', pastMatches.length]);
  teamRows.push(['Partite in casa', teamOverview.matchesCasaTrasferta.Casa]);
  teamRows.push(['Partite in trasferta', teamOverview.matchesCasaTrasferta.Trasferta]);
  teamRows.push([]);
  teamRows.push(['Presenza media di squadra']);
  teamRows.push(['Allenamenti', pct(teamTrainingRate), `${teamOverview.trainingPresTotal}/${teamOverview.trainingConvTotal} convocazioni`]);
  teamRows.push(['Partite', pct(teamMatchRate), `${teamOverview.matchPresTotal}/${teamOverview.matchConvTotal} convocazioni`]);
  teamRows.push(['Totale', pct(teamTotalRate)]);
  teamRows.push(['Media per evento', pct(perEventAvg)]);
  teamRows.push(['Affidabilità di squadra', pct(teamOverview.reliabilityScore)]);
  teamRows.push([]);
  teamRows.push(['Certificati medici']);
  teamRows.push(['Scaduti', certCounts.scaduto || 0]);
  teamRows.push(['In scadenza (30gg)', certCounts['in-scadenza'] || 0]);
  teamRows.push(['Validi', certCounts.valido || 0]);
  teamRows.push(['Non caricati', certCounts.assente || 0]);
  teamRows.push([]);
  teamRows.push(['Fedeltà stagionale (mai 2+ assenze di fila)', fedeltaCount]);
  teamRows.push([]);
  teamRows.push(['Classifica presenze giocatori']);
  teamRows.push([
    'Numero', 'Cognome', 'Nome', 'Categoria',
    'All. conv', 'All. pres', 'All. %',
    'Partite conv', 'Partite pres', 'Partite %',
    'Ritardi', 'Totale %', 'Affidabilità %', 'Ass. ingiustificate (allenamenti)',
  ]);
  players
    .map((p) => ({ p, s: playerStats.get(p.id)! }))
    .sort((a, b) => (rate(b.s.totalPres, b.s.totalConv) ?? -1) - (rate(a.s.totalPres, a.s.totalConv) ?? -1))
    .forEach(({ p, s }) => {
      teamRows.push([
        p.numero ?? '', p.cognome, p.nome, playerCategory(p.data_nascita) || '',
        s.trainingConv, s.trainingPres, rate(s.trainingPres, s.trainingConv) ?? '',
        s.matchConv, s.matchPres, rate(s.matchPres, s.matchConv) ?? '',
        s.totalRitardi, rate(s.totalPres, s.totalConv) ?? '',
        s.reliabilityScore ?? '', s.trainingAssenzeIngiustificate,
      ]);
    });

  const teamSheet = XLSX.utils.aoa_to_sheet(teamRows);
  teamSheet['!cols'] = [
    { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
    { wch: 9 }, { wch: 9 }, { wch: 7 },
    { wch: 11 }, { wch: 11 }, { wch: 9 },
    { wch: 8 }, { wch: 9 }, { wch: 13 }, { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, teamSheet, 'Squadra');

  // ---- Una scheda per giocatore ----
  const usedNames = new Set<string>();
  players.forEach((p) => {
    const s = playerStats.get(p.id);
    if (!s) return;
    const rows: Row[] = [];
    rows.push([`${p.cognome} ${p.nome}`, `Numero ${p.numero ?? '—'}`, playerCategory(p.data_nascita) || '']);
    rows.push([]);
    rows.push(['Riepilogo presenze']);
    rows.push(['Allenamenti', `${s.trainingPres}/${s.trainingConv}`, pct(rate(s.trainingPres, s.trainingConv)), `${s.trainingRitardi} ritardi`]);
    rows.push(['Partite', `${s.matchPres}/${s.matchConv}`, pct(rate(s.matchPres, s.matchConv)), `${s.matchRitardi} ritardi`]);
    rows.push(['Totale', `${s.totalPres}/${s.totalConv}`, pct(rate(s.totalPres, s.totalConv))]);
    rows.push(['Affidabilità*', '', pct(s.reliabilityScore)]);
    rows.push(['Allenamenti saltati senza giustificazione', s.trainingAssenzeIngiustificate]);
    rows.push([]);
    rows.push(['Striscia e record']);
    rows.push(['Striscia attuale (presenze consecutive)', s.currentStreak]);
    rows.push(['Striscia massima', s.maxStreak]);
    rows.push(['Assenze consecutive max', s.maxAbsenceStreak]);
    rows.push(['Volte unico assente', s.soloAssenteCount]);
    rows.push(['Primo evento', s.firstEventDate ? fmtDateShort(s.firstEventDate) : '—']);
    rows.push(['Ultimo evento', s.lastEventDate ? fmtDateShort(s.lastEventDate) : '—']);
    rows.push([]);
    rows.push(['Assenze per motivo']);
    const motivoEntries = Object.entries(s.motivoBreakdown);
    if (motivoEntries.length === 0) rows.push(['Nessuna assenza']);
    else motivoEntries.forEach(([k, v]) => rows.push([motivoLabel(k), v]));
    rows.push([]);
    rows.push(['Calendario presenze']);
    rows.push(['Data', 'Tipo', 'Dettaglio', 'Esito', 'Motivo assenza']);

    const trainingRows: Row[] = pastTrainings
      .filter((t) => (t.convocati || []).includes(p.id))
      .map((t) => {
        const loc = resolveLocation(t.venue_id, t.palestra_custom, venues);
        const presente = (t.presenze || []).includes(p.id);
        const ritardo = (t.ritardi || []).includes(p.id);
        const motivo = (t.motivi_assenza || {})[p.id];
        return [t.data, 'Allenamento', `${t.orario} · ${loc.label}`, esitoFor(presente, ritardo, motivo), presente ? '' : motivoLabel(motivo)];
      });
    const matchRows: Row[] = pastMatches
      .filter((m) => (m.convocati || []).includes(p.id))
      .map((m) => {
        const loc = resolveLocation(m.venue_id, m.luogo_custom, venues);
        const presente = (m.presenze || []).includes(p.id);
        const ritardo = (m.ritardi || []).includes(p.id);
        const motivo = (m.motivi_assenza || {})[p.id];
        return [
          m.data, 'Partita', `${m.orario} · ${m.casa_trasferta} vs ${m.avversario} · ${loc.label}`,
          esitoFor(presente, ritardo, motivo), presente ? '' : motivoLabel(motivo),
        ];
      });
    const calendarRows = [...trainingRows, ...matchRows].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    if (calendarRows.length === 0) rows.push(['Nessun evento']);
    else calendarRows.forEach((r) => rows.push(r));

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 40 }, { wch: 22 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, sheet, sheetNameFor(p, usedNames));
  });

  const safeClub = clubName.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  XLSX.writeFile(wb, `Statistiche_${safeClub}_${todayISO()}.xlsx`);
}
