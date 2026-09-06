import { useMemo, useState } from 'react';
import { useRoster } from '../hooks/useRoster';
import { useTrainings } from '../hooks/useTrainings';
import { useMatches } from '../hooks/useMatches';
import { CategoriaTag } from '../components/ui/CategoriaTag';
import { playerCategory } from '../lib/categoria';
import { certStatusFor } from '../lib/certificato';
import { fmtDateShort, todayISO } from '../lib/dates';
import {
  computePlayerAttendance,
  computeTeamOverview,
  monthlyTrainingTrend,
  pastOnly,
  rate,
  rateClass,
  weekdayLabel,
  type MonthlyPoint,
  type PlayerAttendance,
  type TeamOverview,
} from '../lib/stats';
import type { RosterPlayer } from '../types/database';

export default function StatsPage() {
  const { data: roster = [] } = useRoster();
  const { data: trainings = [] } = useTrainings();
  const { data: matches = [] } = useMatches();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const today = todayISO();
  const pastTrainings = useMemo(() => pastOnly(trainings, today), [trainings, today]);
  const pastMatches = useMemo(() => pastOnly(matches, today), [matches, today]);

  const players = useMemo(
    () => [...roster].sort((a, b) => (a.numero ?? 99) - (b.numero ?? 99) || a.cognome.localeCompare(b.cognome)),
    [roster],
  );

  const teamOverview = useMemo(() => computeTeamOverview(pastTrainings, pastMatches), [pastTrainings, pastMatches]);

  const playerStats = useMemo(() => {
    const map = new Map<string, PlayerAttendance>();
    players.forEach((p) => map.set(p.id, computePlayerAttendance(p.id, pastTrainings, pastMatches)));
    return map;
  }, [players, pastTrainings, pastMatches]);

  const monthly = useMemo(() => monthlyTrainingTrend(pastTrainings), [pastTrainings]);

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

  const ranking = useMemo(() => {
    return players
      .map((p) => {
        const s = playerStats.get(p.id)!;
        return { player: p, stats: s, totalRate: rate(s.totalPres, s.totalConv) };
      })
      .sort((a, b) => (b.totalRate ?? -1) - (a.totalRate ?? -1));
  }, [players, playerStats]);

  const weekdayRows = Object.entries(teamOverview.weekdayTraining)
    .map(([wd, split]) => ({ wd: Number(wd), label: weekdayLabel(Number(wd)), ...split, rate: rate(split.pres, split.conv) }))
    .sort((a, b) => {
      const order = (d: number) => (d === 0 ? 7 : d);
      return order(a.wd) - order(b.wd);
    });

  const selectedPlayer = selectedId ? players.find((p) => p.id === selectedId) || null : null;
  const selectedStats = selectedId ? playerStats.get(selectedId) || null : null;

  return (
    <section>
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
                <CategoriaTag dataNascita={p.data_nascita} />
              </button>
            ))}
          </div>
        </div>

        <div className="stats-main">
          {selectedPlayer && selectedStats ? (
            <PlayerStatsView player={selectedPlayer} stats={selectedStats} teamTotalRate={teamTotalRate} />
          ) : (
            <TeamStatsView
              roster={roster}
              teamOverview={teamOverview}
              teamTrainingRate={teamTrainingRate}
              teamMatchRate={teamMatchRate}
              teamTotalRate={teamTotalRate}
              monthly={monthly}
              weekdayRows={weekdayRows}
              ranking={ranking}
              certCounts={certCounts}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value, sub, valueClass }: { label: string; value: string | number; sub?: string; valueClass?: string }) {
  return (
    <div className="stat-card">
      <div className={valueClass ? `stat-value ${valueClass}` : 'stat-value'}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
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

function TeamStatsView({
  roster, teamOverview, teamTrainingRate, teamMatchRate, teamTotalRate, monthly, weekdayRows, ranking, certCounts,
}: {
  roster: RosterPlayer[];
  teamOverview: TeamOverview;
  teamTrainingRate: number | null;
  teamMatchRate: number | null;
  teamTotalRate: number | null;
  monthly: MonthlyPoint[];
  weekdayRows: { wd: number; label: string; conv: number; pres: number; rate: number | null }[];
  ranking: { player: RosterPlayer; stats: PlayerAttendance; totalRate: number | null }[];
  certCounts: Record<string, number>;
}) {
  const u14Count = roster.filter((p) => playerCategory(p.data_nascita) === 'U14').length;
  const u15Count = roster.filter((p) => playerCategory(p.data_nascita) === 'U15').length;

  return (
    <>
      <div className="card">
        <h3>Riepilogo stagione</h3>
        <div className="stat-cards">
          <StatCard label="Giocatori in rosa" value={roster.length} sub={`${u14Count} U14 · ${u15Count} U15`} />
          <StatCard label="Allenamenti svolti" value={teamOverview.trainingsCount} />
          <StatCard
            label="Partite giocate"
            value={teamOverview.matchesCount}
            sub={`${teamOverview.matchesByCategoria.U14} U14 · ${teamOverview.matchesByCategoria.U15} U15`}
          />
          <StatCard label="Casa / Trasferta" value={`${teamOverview.matchesCasaTrasferta.Casa} / ${teamOverview.matchesCasaTrasferta.Trasferta}`} />
        </div>
      </div>

      <div className="card">
        <h3>Presenza media di squadra</h3>
        <div className="stat-cards">
          <RateCard label="Allenamenti" r={teamTrainingRate} sub={`${teamOverview.trainingPresTotal}/${teamOverview.trainingConvTotal} convocazioni`} />
          <RateCard label="Partite" r={teamMatchRate} sub={`${teamOverview.matchPresTotal}/${teamOverview.matchConvTotal} convocazioni`} />
          <RateCard label="Totale" r={teamTotalRate} sub="Allenamenti + partite" />
        </div>
      </div>

      {weekdayRows.length > 0 && (
        <div className="card">
          <h3>Presenza allenamenti per giorno della settimana</h3>
          <BarList rows={weekdayRows.map((w) => ({ key: String(w.wd), label: w.label, rate: w.rate }))} />
        </div>
      )}

      {monthly.length > 0 && (
        <div className="card">
          <h3>Andamento mensile presenza allenamenti</h3>
          <BarList rows={monthly.map((m) => ({ key: m.month, label: m.label, rate: m.rate }))} />
        </div>
      )}

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
                  <th>Totale</th>
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
                        {p.cognome} {p.nome} <CategoriaTag dataNascita={p.data_nascita} />
                      </td>
                      <td className={rateClass(tRate)}>{s.trainingConv > 0 ? `${s.trainingPres}/${s.trainingConv} (${tRate}%)` : '—'}</td>
                      <td className={rateClass(mRate)}>{s.matchConv > 0 ? `${s.matchPres}/${s.matchConv} (${mRate}%)` : '—'}</td>
                      <td className={rateClass(totalRate)} style={{ fontWeight: 700 }}>{totalRate !== null ? `${totalRate}%` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
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

  return (
    <>
      <div className="card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="num-badge">{player.numero ?? '–'}</span>
          {player.cognome} {player.nome}
          <CategoriaTag dataNascita={player.data_nascita} />
        </h3>
        <div className="stat-cards">
          <RateCard label="Allenamenti" r={trainingRate} sub={`${stats.trainingPres}/${stats.trainingConv} convocazioni`} />
          <RateCard label="Partite" r={matchRate} sub={`${stats.matchPres}/${stats.matchConv} convocazioni`} />
          <RateCard
            label="Totale"
            r={totalRate}
            sub={delta !== null ? `${delta >= 0 ? '+' : ''}${delta}% vs media squadra` : undefined}
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
        <h3>Andamento recente</h3>
        {stats.recent.length === 0 ? (
          <div className="empty">Nessun evento passato registrato per questo giocatore.</div>
        ) : (
          <>
            <div className="form-trend">
              {stats.recent.map((e, i) => (
                <span
                  key={i}
                  className={`form-dot ${e.presente ? 'presente' : 'assente'}`}
                  title={`${e.type === 'training' ? 'Allenamento' : 'Partita'} · ${fmtDateShort(e.data)} · ${e.presente ? 'Presente' : 'Assente'}`}
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
