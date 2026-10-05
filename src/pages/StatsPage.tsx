import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRoster } from '../hooks/useRoster';
import { useTrainings } from '../hooks/useTrainings';
import { useMatches } from '../hooks/useMatches';
import { useVenues } from '../hooks/useVenues';
import { useSettings } from '../hooks/useSettings';
import { CategoriaTag } from '../components/ui/CategoriaTag';
import { StatCard } from '../components/ui/StatCard';
import { RisultatiStats } from '../components/RisultatiStats';
import { playerCategory } from '../lib/categoria';
import { certStatusFor } from '../lib/certificato';
import { isGiustificata, MOTIVI_ASSENZA } from '../lib/assenze';
import { fmtDateShort, meseEsteso, todayISO } from '../lib/dates';
import { exportStatsToExcel } from '../lib/excelExport';
import {
  buildEventSummaries,
  computePlayerAttendance,
  computeTeamOverview,
  eventExtremes,
  monthlyTrend,
  pastOnly,
  soloInRosa,
  perfectAttendanceCount,
  rate,
  rateClass,
  weekdayLabel,
  type EventOutcome,
  type EventSummary,
  type TeamMonthlyPoint,
  type PlayerAttendance,
  type TeamOverview,
} from '../lib/stats';
import type { RosterPlayer } from '../types/database';

function prevMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function Variazione({ da, a }: { da: number | null; a: number | null }) {
  if (da === null || a === null) return null;
  const diff = a - da;
  return (
    <span className={diff > 0 ? 'rate-good' : diff < 0 ? 'rate-bad' : undefined} style={{ fontWeight: 700 }}>
      {diff === 0 ? 'invariata' : `${diff > 0 ? '+' : '−'}${Math.abs(diff)} punti`}
    </span>
  );
}

export default function StatsPage() {
  const { data: roster = [] } = useRoster();
  const { data: trainings = [] } = useTrainings();
  const { data: matches = [] } = useMatches();
  const { data: venues = [] } = useVenues();
  const { data: settings } = useSettings();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'presenze' | 'risultati'>('presenze');

  const today = todayISO();
  const rosterIds = useMemo(() => new Set(roster.map((p) => p.id)), [roster]);
  const pastTrainings = useMemo(() => soloInRosa(pastOnly(trainings, today), rosterIds), [trainings, today, rosterIds]);
  const pastMatches = useMemo(() => soloInRosa(pastOnly(matches, today), rosterIds), [matches, today, rosterIds]);

  const players = useMemo(
    () => [...roster].sort((a, b) => (a.numero ?? 99) - (b.numero ?? 99) || a.cognome.localeCompare(b.cognome)),
    [roster],
  );

  const teamOverview = useMemo(() => computeTeamOverview(pastTrainings, pastMatches), [pastTrainings, pastMatches]);
  const eventSummaries = useMemo(() => buildEventSummaries(pastTrainings, pastMatches), [pastTrainings, pastMatches]);
  const eventXtremes = useMemo(() => eventExtremes(eventSummaries), [eventSummaries]);
  const perfectCount = useMemo(() => perfectAttendanceCount(eventSummaries), [eventSummaries]);

  const playerStats = useMemo(() => {
    const map = new Map<string, PlayerAttendance>();
    players.forEach((p) => map.set(p.id, computePlayerAttendance(p.id, pastTrainings, pastMatches)));
    return map;
  }, [players, pastTrainings, pastMatches]);

  const monthly = useMemo(() => monthlyTrend(pastTrainings, pastMatches), [pastTrainings, pastMatches]);

  const certCounts = useMemo(() => {
    const counts: Record<string, number> = { scaduto: 0, 'in-scadenza': 0, valido: 0, assente: 0 };
    const now = new Date();
    roster.forEach((p) => { counts[certStatusFor(p.certificato, now)]++; });
    return counts;
  }, [roster]);

  const teamTrainingRate = rate(teamOverview.trainingPresTotal, teamOverview.trainingConvTotal);
  const teamMatchRate = rate(teamOverview.matchPresTotal, teamOverview.matchConvTotal);
  const teamTotalRate = rate(
    teamOverview.trainingPresTotal + teamOverview.matchPresTotal,
    teamOverview.trainingConvTotal + teamOverview.matchConvTotal,
  );
  const ratedEvents = eventSummaries.filter((e) => e.rate !== null);
  const perEventAvg = ratedEvents.length > 0
    ? Math.round(ratedEvents.reduce((acc, e) => acc + (e.rate as number), 0) / ratedEvents.length)
    : null;

  const ranking = useMemo(() => {
    return players
      .map((p) => {
        const s = playerStats.get(p.id)!;
        return { player: p, stats: s, totalRate: rate(s.totalPres, s.totalConv) };
      })
      .sort((a, b) => (b.totalRate ?? -1) - (a.totalRate ?? -1));
  }, [players, playerStats]);

  const fedeltaCount = useMemo(
    () => ranking.filter(({ stats }) => stats.totalConv > 0 && stats.maxAbsenceStreak <= 1).length,
    [ranking],
  );

  const weekdayRows = Object.entries(teamOverview.weekdayTraining)
    .map(([wd, split]) => ({ wd: Number(wd), label: weekdayLabel(Number(wd)), ...split, rate: rate(split.pres, split.conv) }))
    .sort((a, b) => {
      const order = (d: number) => (d === 0 ? 7 : d);
      return order(a.wd) - order(b.wd);
    });

  const selectedPlayer = selectedId ? players.find((p) => p.id === selectedId) || null : null;
  const selectedStats = selectedId ? playerStats.get(selectedId) || null : null;

  async function handleExportExcel() {
    await exportStatsToExcel({
      clubName: settings?.club_name || 'SSV Bozen Volley',
      players,
      playerStats,
      teamOverview,
      pastTrainings,
      pastMatches,
      venues,
      teamTrainingRate,
      teamMatchRate,
      teamTotalRate,
      perEventAvg,
      certCounts,
      fedeltaCount,
      monthly,
    });
  }

  return (
    <section>
      <div className="row no-print" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div className="seg-tabs">
          <button type="button" className={tab === 'presenze' ? 'active' : ''} onClick={() => setTab('presenze')}>Presenze</button>
          <button type="button" className={tab === 'risultati' ? 'active' : ''} onClick={() => setTab('risultati')}>Risultati</button>
        </div>
        {tab === 'presenze' && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn small" to="/app/statistiche/report">Report del mese</Link>
            <button className="btn ghost small" onClick={handleExportExcel}>Esporta Excel (squadra + giocatori)</button>
          </div>
        )}
      </div>
      {tab === 'risultati' ? (
        <RisultatiStats matches={matches} clubName={settings?.club_name || 'SSV Bozen Volley'} />
      ) : (
        <div className="stats-layout">
          <div className="stats-sidebar">
            <button
              type="button"
              className={`stats-player-btn stats-player-all${selectedId === null ? ' active' : ''}`}
              onClick={() => setSelectedId(null)}
            >
              Tutta la squadra
            </button>
            <div className="stats-player-list">
              {players.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`stats-player-btn${selectedId === p.id ? ' active' : ''}`}
                  onClick={() => setSelectedId(p.id)}
                >
                  <span className="num-badge">{p.numero ?? '–'}</span>
                  <span style={{ flex: 1 }}>{p.cognome} {p.nome}</span>
                  <CategoriaTag dataNascita={p.data_nascita} soloU15={p.solo_u15} />
                </button>
              ))}
            </div>
          </div>

          <div className="stats-main">
            {selectedPlayer && selectedStats ? (
              <PlayerStatsView key={selectedPlayer.id} player={selectedPlayer} stats={selectedStats} teamTotalRate={teamTotalRate} />
            ) : (
              <TeamStatsView
                roster={roster}
                trainingsTotal={trainings.length}
                matchesTotal={matches.length}
                teamOverview={teamOverview}
                teamTrainingRate={teamTrainingRate}
                teamMatchRate={teamMatchRate}
                teamTotalRate={teamTotalRate}
                perEventAvg={perEventAvg}
                perfectCount={perfectCount}
                eventXtremes={eventXtremes}
                monthly={monthly}
                weekdayRows={weekdayRows}
                ranking={ranking}
                certCounts={certCounts}
                fedeltaCount={fedeltaCount}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function RateCard({ label, r, sub }: { label: string; r: number | null; sub?: string }) {
  return (
    <div className="stat-card">
      <div className={`stat-value ${rateClass(r)}`}>{r !== null ? `${r}%` : '—'}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function BarList({ rows }: { rows: { key: string; label: string; rate: number | null }[] }) {
  return (
    <div className="bar-list">
      {rows.map((r) => (
        <div className="bar-item" key={r.key}>
          <span className="bar-label">{r.label}</span>
          <div className="bar-track">
            <div className={`bar-fill ${rateClass(r.rate)}`} style={{ width: `${r.rate ?? 0}%` }} />
          </div>
          <span className="bar-value">{r.rate !== null ? `${r.rate}%` : '—'}</span>
        </div>
      ))}
    </div>
  );
}

function LineChart({ points }: { points: { label: string; rate: number | null }[] }) {
  if (points.length === 0) return <div className="empty">Nessun dato disponibile.</div>;
  const w = 640;
  const h = 180;
  const padX = 34;
  const padY = 24;
  const usableW = w - padX * 2;
  const usableH = h - padY * 2;
  const stepX = points.length > 1 ? usableW / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: padX + i * stepX,
    y: padY + usableH - (usableH * (p.rate ?? 0)) / 100,
    label: p.label,
  }));
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="line-chart" preserveAspectRatio="xMidYMid meet">
      {[0, 25, 50, 75, 100].map((g) => {
        const y = padY + usableH - (usableH * g) / 100;
        return (
          <g key={g}>
            <line x1={padX} y1={y} x2={w - padX} y2={y} className="line-chart-grid" />
            <text x={padX - 6} y={y + 3} textAnchor="end" className="line-chart-axis">{g}</text>
          </g>
        );
      })}
      <path d={path} className="line-chart-path" fill="none" />
      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r={3.5} className="line-chart-dot" />
          <text x={c.x} y={h - 4} textAnchor="middle" className="line-chart-label">{c.label}</text>
        </g>
      ))}
    </svg>
  );
}

function MonthHeatmap({ chronology, monthKey }: { chronology: EventOutcome[]; monthKey: string }) {
  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const offset = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const byDate = new Map(chronology.map((e) => [e.data, e]));
  const cells: { day: number | null; status: string }[] = [];
  for (let i = 0; i < offset; i++) cells.push({ day: null, status: 'empty' });
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const e = byDate.get(iso);
    let status = 'none';
    if (e) status = e.presente ? 'presente' : isGiustificata(e.motivo) ? 'assente-giustificata' : 'assente-non-giustificata';
    cells.push({ day: d, status });
  }
  return (
    <div>
      <div className="heatmap-weekdays">
        {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="heatmap-grid">
        {cells.map((c, i) => (
          <span key={i} className={`heatmap-cell heatmap-${c.status}`}>{c.day ?? ''}</span>
        ))}
      </div>
      <div className="heatmap-legend">
        <span><i className="heatmap-swatch heatmap-presente" /> Presente</span>
        <span><i className="heatmap-swatch heatmap-assente-giustificata" /> Assente giustificata</span>
        <span><i className="heatmap-swatch heatmap-assente-non-giustificata" /> Assente non giustificata</span>
        <span><i className="heatmap-swatch heatmap-none" /> Nessun evento</span>
      </div>
    </div>
  );
}

function MotivoBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const nonGiustificate = (breakdown.non_giustificata || 0) + (breakdown.non_specificato || 0);
  const giustificate = total - nonGiustificate;
  const percGiustificate = total > 0 ? Math.round((giustificate / total) * 100) : null;
  const rows = [...MOTIVI_ASSENZA.map((m) => ({ key: m.value, label: m.label })), { key: 'non_specificato', label: 'Non specificato' }];

  if (total === 0) {
    return <div className="empty">Nessuna assenza registrata.</div>;
  }

  return (
    <>
      <div className="stat-cards">
        <StatCard label="Assenze totali" value={total} />
        <RateCard label="Giustificate" r={percGiustificate} sub={`${giustificate}/${total}`} />
      </div>
      <BarList
        rows={rows
          .filter((r) => breakdown[r.key])
          .map((r) => ({ key: r.key, label: r.label, rate: Math.round((breakdown[r.key] / total) * 100) }))}
      />
    </>
  );
}

function TeamStatsView({
  roster, trainingsTotal, matchesTotal, teamOverview, teamTrainingRate, teamMatchRate, teamTotalRate,
  perEventAvg, perfectCount, eventXtremes, monthly, weekdayRows, ranking, certCounts, fedeltaCount,
}: {
  roster: RosterPlayer[];
  trainingsTotal: number;
  matchesTotal: number;
  teamOverview: TeamOverview;
  teamTrainingRate: number | null;
  teamMatchRate: number | null;
  teamTotalRate: number | null;
  perEventAvg: number | null;
  perfectCount: number;
  eventXtremes: { best: EventSummary | null; worst: EventSummary | null };
  monthly: TeamMonthlyPoint[];
  weekdayRows: { wd: number; label: string; conv: number; pres: number; rate: number | null }[];
  ranking: { player: RosterPlayer; stats: PlayerAttendance; totalRate: number | null }[];
  certCounts: Record<string, number>;
  fedeltaCount: number;
}) {
  const u14Count = roster.filter((p) => playerCategory(p.data_nascita) === 'U14').length;
  const u15Count = roster.filter((p) => playerCategory(p.data_nascita) === 'U15').length;
  const avgConvTraining = teamOverview.trainingsCount > 0 ? Math.round(teamOverview.trainingConvTotal / teamOverview.trainingsCount) : null;
  const avgConvMatch = teamOverview.matchesCount > 0 ? Math.round(teamOverview.matchConvTotal / teamOverview.matchesCount) : null;

  return (
    <>
      <div className="card">
        <h3>Riepilogo stagione</h3>
        <div className="stat-cards">
          <StatCard label="Giocatori in rosa" value={roster.length} sub={`${u14Count} U14 · ${u15Count} U15`} />
          <StatCard label="Allenamenti svolti" value={teamOverview.trainingsCount} sub={`${trainingsTotal} programmati in totale`} />
          <StatCard
            label="Partite giocate"
            value={teamOverview.matchesCount}
            sub={`${teamOverview.matchesByCategoria.U14} U14 · ${teamOverview.matchesByCategoria.U15} U15 · ${matchesTotal} in totale`}
          />
          <StatCard label="Casa / Trasferta" value={`${teamOverview.matchesCasaTrasferta.Casa} / ${teamOverview.matchesCasaTrasferta.Trasferta}`} />
          <StatCard label="Convocati medi/allenamento" value={avgConvTraining ?? '—'} />
          <StatCard label="Convocati medi/partita" value={avgConvMatch ?? '—'} />
        </div>
      </div>

      <div className="card">
        <h3>Presenza media di squadra</h3>
        <div className="stat-cards">
          <RateCard label="Allenamenti" r={teamTrainingRate} sub={`${teamOverview.trainingPresTotal}/${teamOverview.trainingConvTotal} convocazioni`} />
          <RateCard label="Partite" r={teamMatchRate} sub={`${teamOverview.matchPresTotal}/${teamOverview.matchConvTotal} convocazioni`} />
          <RateCard label="Totale" r={teamTotalRate} sub="Allenamenti + partite" />
          <RateCard label="Media per evento" r={perEventAvg} sub="Media delle % di ogni singolo evento" />
        </div>
      </div>

      <div className="card">
        <h3>Affidabilità di squadra</h3>
        <div className="muted" style={{ fontSize: 12.5, marginBottom: 4 }}>
          Indice pesato: partita conta doppio di un allenamento; un ritardo vale il 75% di una presenza puntuale;
          un'assenza senza motivo (o non giustificata) vale 0; un'assenza giustificata non viene conteggiata (né a favore né contro).
        </div>
        <div className="stat-cards">
          <RateCard label="Affidabilità di squadra" r={teamOverview.reliabilityScore} />
        </div>
      </div>

      <div className="card">
        <h3>Eventi da ricordare</h3>
        <div className="stat-cards">
          <StatCard label="Eventi con presenza 100%" value={perfectCount} />
          <StatCard
            label="Presenza più alta"
            value={eventXtremes.best ? `${eventXtremes.best.rate}%` : '—'}
            sub={eventXtremes.best ? `${eventXtremes.best.label} · ${fmtDateShort(eventXtremes.best.data)}` : undefined}
          />
          <StatCard
            label="Presenza più bassa"
            value={eventXtremes.worst ? `${eventXtremes.worst.rate}%` : '—'}
            sub={eventXtremes.worst ? `${eventXtremes.worst.label} · ${fmtDateShort(eventXtremes.worst.data)}` : undefined}
            valueClass={eventXtremes.worst && eventXtremes.worst.rate !== null && eventXtremes.worst.rate < 70 ? 'rate-bad' : undefined}
          />
          <StatCard label="Fedeltà stagionale" value={fedeltaCount} sub="Mai 2+ assenze di fila" />
        </div>
      </div>

      {weekdayRows.length > 0 && (
        <div className="card">
          <h3>Presenza allenamenti per giorno della settimana</h3>
          <BarList rows={weekdayRows.map((w) => ({ key: String(w.wd), label: w.label, rate: w.rate }))} />
        </div>
      )}

      {monthly.length > 0 && (() => {
        const ultimo = monthly[monthly.length - 1];
        const precedente = monthly.find((m) => m.month === prevMonthKey(ultimo.month)) || null;
        const stagione = monthly.reduce((acc, m) => ({ pres: acc.pres + m.totale.pres, conv: acc.conv + m.totale.conv }), { pres: 0, conv: 0 });
        const rateStagione = rate(stagione.pres, stagione.conv);
        return (
          <div className="card">
            <h3>{meseEsteso(ultimo.month)} a confronto</h3>
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 4 }}>
              Presenza (allenamenti e partite) dell'ultimo mese con eventi svolti, confrontata con il mese precedente e con la media della stagione.
            </div>
            <div className="stat-cards">
              <RateCard label={meseEsteso(ultimo.month)} r={ultimo.totale.rate} sub={`${ultimo.totale.pres}/${ultimo.totale.conv} presenze · ${ultimo.totale.eventi} ${ultimo.totale.eventi === 1 ? 'evento' : 'eventi'}`} />
              <div className="stat-card">
                <div className={`stat-value ${rateClass(precedente?.totale.rate ?? null)}`}>{precedente?.totale.rate != null ? `${precedente.totale.rate}%` : '—'}</div>
                <div className="stat-label">{meseEsteso(prevMonthKey(ultimo.month))}</div>
                <div className="stat-sub">
                  {precedente ? <>{meseEsteso(ultimo.month)}: <Variazione da={precedente.totale.rate} a={ultimo.totale.rate} /></> : 'nessun evento svolto'}
                </div>
              </div>
              <div className="stat-card">
                <div className={`stat-value ${rateClass(rateStagione)}`}>{rateStagione !== null ? `${rateStagione}%` : '—'}</div>
                <div className="stat-label">Media stagione</div>
                <div className="stat-sub">
                  {monthly.length > 1 ? <>{meseEsteso(ultimo.month)}: <Variazione da={rateStagione} a={ultimo.totale.rate} /></> : 'per ora coincide con l\'unico mese svolto'}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {monthly.length > 0 && (
        <div className="card">
          <h3>Presenze mese per mese</h3>
          <div className="table-scroll">
            <table className="stats-table compatta" style={{ minWidth: 0 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Mese</th>
                  <th>All.</th>
                  <th>% all.</th>
                  <th>Partite</th>
                  <th>% partite</th>
                  <th>Totale</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m) => (
                  <tr key={m.month}>
                    <td style={{ fontWeight: 700 }}>{meseEsteso(m.month)}</td>
                    <td className="center">{m.allenamenti.eventi}</td>
                    <td className={`center ${rateClass(m.allenamenti.rate)}`}>{m.allenamenti.rate !== null ? `${m.allenamenti.rate}%` : '—'}</td>
                    <td className="center">{m.partite.eventi}</td>
                    <td className={`center ${rateClass(m.partite.rate)}`}>{m.partite.rate !== null ? `${m.partite.rate}%` : '—'}</td>
                    <td className={`center ${rateClass(m.totale.rate)}`} style={{ fontWeight: 700 }}>
                      {m.totale.rate !== null ? `${m.totale.rate}%` : '—'}
                      <span className="muted" style={{ display: 'block', fontWeight: 400, fontSize: 11.5 }}>{m.totale.pres}/{m.totale.conv}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
            All. = allenamenti svolti nel mese; le percentuali sono presenti ÷ convocati, contando solo gli eventi già svolti.
          </div>
          {monthly.length >= 2 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 16 }}>Andamento della presenza totale</div>
              <LineChart points={monthly.map((m) => ({ label: m.label, rate: m.totale.rate }))} />
            </>
          )}
        </div>
      )}

      <div className="card">
        <h3>Analisi delle assenze</h3>
        <MotivoBreakdown breakdown={teamOverview.motivoBreakdown} />
      </div>

      <div className="card">
        <h3>Certificati medici</h3>
        <div className="stat-cards">
          <StatCard label="Scaduti" value={certCounts.scaduto} valueClass={certCounts.scaduto > 0 ? 'rate-bad' : undefined} />
          <StatCard label="In scadenza (30gg)" value={certCounts['in-scadenza']} valueClass={certCounts['in-scadenza'] > 0 ? 'rate-mid' : undefined} />
          <StatCard label="Validi" value={certCounts.valido} />
          <StatCard label="Non caricati" value={certCounts.assente} />
        </div>
      </div>

      <div className="card">
        <h3>Classifica presenze giocatori</h3>
        {ranking.length === 0 ? (
          <div className="empty">Nessun dato disponibile.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Giocatore</th>
                  <th>Allenamenti</th>
                  <th>Partite</th>
                  <th>Ritardi</th>
                  <th>Totale</th>
                  <th>Affidabilità*</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map(({ player: p, stats: s, totalRate }) => {
                  const tRate = rate(s.trainingPres, s.trainingConv);
                  const mRate = rate(s.matchPres, s.matchConv);
                  return (
                    <tr key={p.id}>
                      <td>
                        <span className="num-badge" style={{ marginRight: 8 }}>{p.numero ?? '–'}</span>
                        {p.cognome} {p.nome} <CategoriaTag dataNascita={p.data_nascita} soloU15={p.solo_u15} />
                      </td>
                      <td className={rateClass(tRate)}>{s.trainingConv > 0 ? `${s.trainingPres}/${s.trainingConv} (${tRate}%)` : '—'}</td>
                      <td className={rateClass(mRate)}>{s.matchConv > 0 ? `${s.matchPres}/${s.matchConv} (${mRate}%)` : '—'}</td>
                      <td>{s.totalRitardi || '—'}</td>
                      <td className={rateClass(totalRate)} style={{ fontWeight: 700 }}>{totalRate !== null ? `${totalRate}%` : '—'}</td>
                      <td className={rateClass(s.reliabilityScore)}>{s.reliabilityScore !== null ? `${s.reliabilityScore}%` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
          * Affidabilità: indice pesato (partita doppio di un allenamento) dove un ritardo vale il 75% di una presenza,
          un'assenza senza motivo vale 0 e un'assenza giustificata non viene conteggiata.
        </div>
      </div>
    </>
  );
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function PlayerStatsView({
  player, stats, teamTotalRate,
}: {
  player: RosterPlayer;
  stats: PlayerAttendance;
  teamTotalRate: number | null;
}) {
  const trainingRate = rate(stats.trainingPres, stats.trainingConv);
  const matchRate = rate(stats.matchPres, stats.matchConv);
  const totalRate = rate(stats.totalPres, stats.totalConv);
  const delta = totalRate !== null && teamTotalRate !== null ? totalRate - teamTotalRate : null;
  const cert = certStatusFor(player.certificato);
  const hasMatchCategoria = stats.matchByCategoria.U14.conv > 0 || stats.matchByCategoria.U15.conv > 0;
  const lastMonthKey = stats.lastEventDate ? stats.lastEventDate.slice(0, 7) : null;
  const firstMonthKey = stats.firstEventDate ? stats.firstEventDate.slice(0, 7) : null;
  const [meseCal, setMeseCal] = useState(lastMonthKey);
  const eventiMese = meseCal ? stats.fullChronology.filter((e) => e.data.slice(0, 7) === meseCal) : [];
  const presentiMese = eventiMese.filter((e) => e.presente).length;

  return (
    <>
      <div className="card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="num-badge">{player.numero ?? '–'}</span>
          {player.cognome} {player.nome}
          <CategoriaTag dataNascita={player.data_nascita} soloU15={player.solo_u15} />
        </h3>
        <div className="stat-cards">
          <RateCard label="Allenamenti" r={trainingRate} sub={`${stats.trainingPres}/${stats.trainingConv} convocazioni · ${stats.trainingRitardi} ritardi`} />
          <RateCard label="Partite" r={matchRate} sub={`${stats.matchPres}/${stats.matchConv} convocazioni · ${stats.matchRitardi} ritardi`} />
          <RateCard
            label="Totale"
            r={totalRate}
            sub={delta !== null ? `${delta >= 0 ? '+' : ''}${delta}% vs media squadra` : undefined}
          />
          <RateCard label="Affidabilità*" r={stats.reliabilityScore} sub="Partite doppio, ritardo 75%, assenze giustificate escluse" />
          <StatCard
            label="Ritardi"
            value={stats.trainingRitardi + stats.matchRitardi}
            sub={`${stats.trainingRitardi} allenamenti · ${stats.matchRitardi} partite`}
            cardClass="stat-card-orange"
          />
          <StatCard
            label="Allenamenti saltati senza giustificazione"
            value={stats.trainingAssenzeIngiustificate}
            cardClass="stat-card-red"
          />
        </div>
      </div>

      {hasMatchCategoria && (
        <div className="card">
          <h3>Partite per categoria</h3>
          <div className="stat-cards">
            <RateCard
              label="Under 14"
              r={rate(stats.matchByCategoria.U14.pres, stats.matchByCategoria.U14.conv)}
              sub={`${stats.matchByCategoria.U14.pres}/${stats.matchByCategoria.U14.conv} convocazioni`}
            />
            <RateCard
              label="Under 15"
              r={rate(stats.matchByCategoria.U15.pres, stats.matchByCategoria.U15.conv)}
              sub={`${stats.matchByCategoria.U15.pres}/${stats.matchByCategoria.U15.conv} convocazioni`}
            />
          </div>
        </div>
      )}

      <div className="card">
        <h3>Striscia e record</h3>
        <div className="stat-cards">
          <StatCard label="Striscia attuale" value={stats.currentStreak} sub="Presenze consecutive" />
          <StatCard label="Striscia massima" value={stats.maxStreak} sub="Record stagionale" />
          <StatCard
            label="Assenze consecutive max"
            value={stats.maxAbsenceStreak}
            valueClass={stats.maxAbsenceStreak >= 2 ? 'rate-bad' : undefined}
          />
          <StatCard label="Volte unico assente" value={stats.soloAssenteCount} />
          <StatCard label="Primo evento" value={stats.firstEventDate ? fmtDateShort(stats.firstEventDate) : '—'} />
          <StatCard label="Ultimo evento" value={stats.lastEventDate ? fmtDateShort(stats.lastEventDate) : '—'} />
        </div>
      </div>

      <div className="card">
        <h3>Andamento recente</h3>
        {stats.recent.length === 0 ? (
          <div className="empty">Nessun evento passato registrato per questo giocatore.</div>
        ) : (
          <>
            <div className="form-trend">
              {stats.recent.map((e, i) => (
                <span
                  key={i}
                  className={`form-dot ${e.ritardo ? 'ritardo' : e.presente ? 'presente' : 'assente'}`}
                  title={`${e.type === 'training' ? 'Allenamento' : 'Partita'} · ${fmtDateShort(e.data)} · ${e.presente ? (e.ritardo ? 'Presente (in ritardo)' : 'Presente') : 'Assente'}`}
                >
                  {e.presente ? '✓' : '✗'}
                </span>
              ))}
            </div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
              Ultimi {stats.recent.length} eventi (allenamenti e partite) a cui è stato convocato, dal più vecchio al più recente — passa il mouse per i dettagli.
            </div>
          </>
        )}
      </div>

      {meseCal && firstMonthKey && lastMonthKey && (
        <div className="card">
          <h3>Calendario mensile presenze</h3>
          <div className="mese-nav" style={{ marginBottom: 4 }}>
            <button className="btn ghost small" aria-label="Mese precedente" disabled={meseCal <= firstMonthKey} onClick={() => setMeseCal(shiftMonth(meseCal, -1))}>
              ←<span className="mese-nav-testo"> Mese precedente</span>
            </button>
            <h3>{meseEsteso(meseCal)}</h3>
            <button className="btn ghost small" aria-label="Mese successivo" disabled={meseCal >= lastMonthKey} onClick={() => setMeseCal(shiftMonth(meseCal, 1))}>
              <span className="mese-nav-testo">Mese successivo </span>→
            </button>
          </div>
          <div className="muted" style={{ fontSize: 12.5, textAlign: 'center', marginBottom: 8 }}>
            {eventiMese.length === 0
              ? 'Nessuna convocazione in questo mese.'
              : `Presente a ${presentiMese} su ${eventiMese.length} ${eventiMese.length === 1 ? 'convocazione' : 'convocazioni'}`}
          </div>
          <MonthHeatmap chronology={stats.fullChronology} monthKey={meseCal} />
        </div>
      )}

      <div className="card">
        <h3>Analisi delle assenze</h3>
        <MotivoBreakdown breakdown={stats.motivoBreakdown} />
      </div>

      <div className="card">
        <h3>Certificato medico</h3>
        <div className={`cert-status-line cert-status-${cert}`}>
          {cert === 'assente' && 'Nessuna data caricata'}
          {cert === 'scaduto' && `Scaduto — ${fmtDateShort(player.certificato || '')}`}
          {cert === 'in-scadenza' && `In scadenza — ${fmtDateShort(player.certificato || '')}`}
          {cert === 'valido' && `Valido fino al ${fmtDateShort(player.certificato || '')}`}
        </div>
      </div>
    </>
  );
}
