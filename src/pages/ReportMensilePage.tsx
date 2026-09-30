import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUi } from '../contexts/UiContext';
import { useRoster } from '../hooks/useRoster';
import { useTrainings } from '../hooks/useTrainings';
import { useMatches } from '../hooks/useMatches';
import { useVenues } from '../hooks/useVenues';
import { useSettings } from '../hooks/useSettings';
import { useReportCommento, useSaveReportCommento } from '../hooks/useReportCommenti';
import { CategoriaTag } from '../components/ui/CategoriaTag';
import { StatCard } from '../components/ui/StatCard';
import { computeReportMensile, mesiConEventi, type Quota, type ReportMensile } from '../lib/reportMensile';
import { rateClass } from '../lib/stats';
import { dayLabelShort, fmtDateShort, meseEsteso, todayISO } from '../lib/dates';
import type { ReportCommento } from '../types/database';

function nextMonthName(mese: string): string {
  const [y, m] = mese.split('-').map(Number);
  return new Date(y, m, 1).toLocaleDateString('it-IT', { month: 'long' });
}

function pct(q: Quota): string {
  return q.rate !== null ? `${q.rate}%` : '—';
}

function Grassetto({ testo }: { testo: string }) {
  const parti = testo.split(/\*\*(.+?)\*\*/g);
  return <>{parti.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p))}</>;
}

function Voci({ testo }: { testo: string }) {
  const righe = testo.split('\n').map((r) => r.replace(/^\s*[-•]\s*/, '').trim()).filter(Boolean);
  return (
    <ul className="report-voci">
      {righe.map((r, i) => <li key={i}><Grassetto testo={r} /></li>)}
    </ul>
  );
}

function Barre({ righe }: { righe: { label: string; sub?: string; quota: Quota }[] }) {
  return (
    <div className="bar-list">
      {righe.map((r) => (
        <div className="bar-item" key={r.label} title={`${r.label}: ${r.quota.pres} presenze su ${r.quota.conv} convocazioni`}>
          <span className="bar-label" style={{ width: 130 }}>
            {r.label}
            {r.sub && <span style={{ display: 'block', fontSize: 11.5 }}>{r.sub}</span>}
          </span>
          <div className="bar-track">
            <div className={`bar-fill ${rateClass(r.quota.rate)}`} style={{ width: `${r.quota.rate ?? 0}%` }} />
          </div>
          <span className="bar-value" style={{ width: 92 }}>
            {pct(r.quota)} <span className="muted" style={{ fontWeight: 400 }}>{r.quota.pres}/{r.quota.conv}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function ReportView({ r, commento, clubName }: { r: ReportMensile; commento: ReportCommento | null | undefined; clubName: string }) {
  const nomeMese = meseEsteso(r.mese);
  const diffPrec = r.mesePrecedente?.rate != null && r.totale.rate != null ? r.totale.rate - r.mesePrecedente.rate : null;
  const maxMotivo = Math.max(1, ...r.motivi.map((m) => m.n));

  if (r.eventi.length === 0) {
    return <div className="card"><div className="empty">Nessun allenamento o partita svolti in {nomeMese.toLowerCase()}.</div></div>;
  }

  return (
    <div className="report-mensile">
      <div className="card">
        <div className="report-eyebrow">{clubName} · Gruppo Under 14-15</div>
        <h2 className="report-titolo">Presenze di {nomeMese.toLowerCase()}</h2>
        <div className="muted" style={{ fontSize: 13.5 }}>
          {r.allenamenti} {r.allenamenti === 1 ? 'allenamento svolto' : 'allenamenti svolti'}
          {r.partite > 0 && ` e ${r.partite} ${r.partite === 1 ? 'partita' : 'partite'}`} · dati aggiornati al {fmtDateShort(todayISO())}.
          Presenza = presenti ÷ convocati, contando solo gli atleti oggi in rosa.
        </div>
      </div>

      <div className="card">
        <h3>Il mese in sintesi</h3>
        <div className="stat-cards">
          <StatCard label="Presenza media" value={pct(r.totale)} valueClass={rateClass(r.totale.rate)} sub={`${r.totale.pres} presenze su ${r.totale.conv} convocazioni`} />
          <StatCard label="Rispetto al mese prima" value={diffPrec === null ? '—' : `${diffPrec > 0 ? '+' : ''}${diffPrec} punti`}
            valueClass={diffPrec === null ? undefined : diffPrec >= 0 ? 'rate-good' : 'rate-bad'}
            sub={`media stagione ${pct(r.mediaStagione)}`} />
          <StatCard label="Allenamenti" value={r.allenamenti} sub={r.partite > 0 ? `+ ${r.partite} ${r.partite === 1 ? 'partita' : 'partite'}` : 'nessuna partita'} />
          <StatCard label="Sempre presenti" value={r.alCompleto} valueClass="rate-good" sub="atleti al 100%" />
          <StatCard label="Assenze" value={r.assenze}
            sub={r.assenze === 0 ? 'nessuna' : r.assenzeGiustificate === r.assenze ? 'tutte giustificate' : `${r.assenzeGiustificate} giustificate`} />
          <StatCard label="Ritardi" value={r.ritardi}
            sub={r.ritardiMaxEvento && r.ritardiMaxEvento.n >= 2 ? `${r.ritardiMaxEvento.n} nello stesso giorno (${fmtDateShort(r.ritardiMaxEvento.data).slice(0, 5)})` : undefined} />
        </div>
      </div>

      {commento?.in_breve.trim() && (
        <div className="card report-commento">
          <h3>In breve</h3>
          <Voci testo={commento.in_breve} />
        </div>
      )}

      <div className="card">
        <h3>Andamento settimana per settimana</h3>
        <Barre righe={r.settimane.map((s) => ({ label: s.label, sub: `${s.eventi} ${s.eventi === 1 ? 'evento' : 'eventi'}`, quota: s.quota }))} />
      </div>

      <div className="card report-break-ok">
        <h3>Evento per evento</h3>
        <div className="table-scroll">
          <table className="stats-table compatta" style={{ minWidth: 0 }}>
            <thead>
              <tr><th style={{ textAlign: 'left' }}>Data</th><th style={{ textAlign: 'left' }}>Evento</th><th>Presenti</th><th>%</th><th>Ritardi</th></tr>
            </thead>
            <tbody>
              {r.eventi.map((e, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: 'nowrap' }}>{dayLabelShort(e.data)}</td>
                  <td>
                    {e.tipo === 'Partita' ? <strong>Partita {e.dettaglio}</strong> : 'Allenamento'}
                    <span className="muted" style={{ display: 'block', fontSize: 12 }}>{e.luogo}</span>
                  </td>
                  <td className="center">{e.quota.pres}/{e.quota.conv}</td>
                  <td className={`center ${rateClass(e.quota.rate)}`} style={{ fontWeight: 700 }}>{pct(e.quota)}</td>
                  <td className="center">{e.ritardi || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ fontSize: 12 }}>Colori come nel resto delle statistiche: verde da 90%, arancione da 70%, rosso sotto il 70%.</div>
      </div>

      <div className="report-split">
        {r.giorni.length > 0 && (
          <div className="card">
            <h3>Allenamenti per giorno</h3>
            <Barre righe={r.giorni.map((g) => ({ label: g.label, sub: `${g.eventi} ${g.eventi === 1 ? 'allenamento' : 'allenamenti'}`, quota: g.quota }))} />
          </div>
        )}
        <div className="card">
          <h3>Motivi delle assenze</h3>
          {r.motivi.length === 0 ? (
            <div className="empty">Nessuna assenza nel mese.</div>
          ) : (
            <div className="bar-list">
              {r.motivi.map((m) => (
                <div className="bar-item" key={m.key}>
                  <span className="bar-label" style={{ width: 130 }}>{m.label}</span>
                  <div className="bar-track">
                    <div className={`bar-fill${m.key === 'non_specificato' || m.key === 'non_giustificata' ? ' rate-bad' : ''}`} style={{ width: `${(m.n / maxMotivo) * 100}%` }} />
                  </div>
                  <span className="bar-value" style={{ width: 92 }}>
                    {m.n} <span className="muted" style={{ fontWeight: 400 }}>{Math.round((m.n / r.assenze) * 100)}%</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card report-break-ok">
        <h3>I giocatori</h3>
        <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
          Ordinati per presenza.{' '}
          {r.categorie.map((c) => `${c.label} ${pct(c.quota)} (${c.quota.pres}/${c.quota.conv})`).join(' · ')}
        </div>
        <div className="table-scroll">
          <table className="stats-table compatta" style={{ minWidth: 0 }}>
            <thead>
              <tr><th style={{ textAlign: 'left' }}>Atleta</th><th>Presenze</th><th>%</th><th>Ritardi</th><th style={{ textAlign: 'left' }}>Assenze e motivi</th></tr>
            </thead>
            <tbody>
              {r.giocatori.map((g) => (
                <tr key={g.player.id}>
                  <td>
                    <strong>{g.player.cognome} {g.player.nome}</strong>{' '}
                    <CategoriaTag dataNascita={g.player.data_nascita} soloU15={g.player.solo_u15} />
                  </td>
                  <td className="center">{g.quota.pres}/{g.quota.conv}</td>
                  <td className={`center ${rateClass(g.quota.rate)}`} style={{ fontWeight: 700 }}>{pct(g.quota)}</td>
                  <td className="center">{g.ritardi || '–'}</td>
                  <td style={{ fontSize: 13 }}>
                    {g.assenze === 0 ? 'Nessuna' : (
                      <>
                        {g.assenze}
                        {g.maxAssenzeFila >= 2 && ` (${g.maxAssenzeFila} di fila)`} · {g.motivi.map((m) => (m.n > 1 ? `${m.label} (${m.n})` : m.label)).join(', ')}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {commento?.da_seguire.trim() && (
        <div className="card report-commento">
          <h3>Da seguire</h3>
          <Voci testo={commento.da_seguire} />
        </div>
      )}

      {commento?.consigli.trim() && (
        <div className="card report-commento">
          <h3>Consigli per {nextMonthName(r.mese)}</h3>
          <Voci testo={commento.consigli} />
        </div>
      )}
    </div>
  );
}

function EditorCommento({ mese, commento, onClose }: { mese: string; commento: ReportCommento | null | undefined; onClose: () => void }) {
  const { showToast } = useUi();
  const save = useSaveReportCommento();
  const [form, setForm] = useState({
    in_breve: commento?.in_breve || '',
    da_seguire: commento?.da_seguire || '',
    consigli: commento?.consigli || '',
  });

  async function handleSave() {
    try {
      await save.mutateAsync({ mese, ...form });
      showToast('Commento salvato');
      onClose();
    } catch {
      showToast('Errore nel salvataggio del commento');
    }
  }

  const campo = (key: keyof typeof form, label: string) => (
    <div className="field" style={{ marginTop: 12 }}>
      <label htmlFor={`commento-${key}`}>{label}</label>
      <textarea id={`commento-${key}`} rows={5} style={{ width: '100%' }} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );

  return (
    <div className="card no-print">
      <h3>Commento di {meseEsteso(mese).toLowerCase()}</h3>
      <div className="muted" style={{ fontSize: 12.5 }}>Una voce per riga. Scrivi **testo** per metterlo in grassetto. Le sezioni vuote non compaiono nel report.</div>
      {campo('in_breve', 'In breve')}
      {campo('da_seguire', 'Da seguire')}
      {campo('consigli', `Consigli per ${nextMonthName(mese)}`)}
      <div className="settings-actions">
        <button className="btn ghost" onClick={onClose}>Annulla</button>
        <button className="btn" onClick={handleSave} disabled={save.isPending}>Salva commento</button>
      </div>
    </div>
  );
}

export default function ReportMensilePage() {
  const { isAdmin } = useAuth();
  const { data: roster = [] } = useRoster();
  const { data: trainings = [] } = useTrainings();
  const { data: matches = [] } = useMatches();
  const { data: venues = [] } = useVenues();
  const { data: settings } = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState(false);

  const today = todayISO();
  const mesi = useMemo(() => mesiConEventi(trainings, matches, today), [trainings, matches, today]);
  const param = searchParams.get('mese') || '';
  const mese = /^\d{4}-\d{2}$/.test(param) ? param : mesi[0] || today.slice(0, 7);
  const report = useMemo(() => computeReportMensile(mese, trainings, matches, roster, venues, today), [mese, trainings, matches, roster, venues, today]);
  const { data: commento } = useReportCommento(mese);
  const clubName = settings?.club_name || 'SSV Bozen Volley';
  const haCommento = !!commento && !!(commento.in_breve.trim() || commento.da_seguire.trim() || commento.consigli.trim());
  const opzioniMesi = mesi.includes(mese) ? mesi : [mese, ...mesi];

  return (
    <section>
      <div className="row no-print" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <Link className="btn ghost small" to="/app/statistiche">← Statistiche</Link>
        <select value={mese} onChange={(e) => { setEditing(false); setSearchParams({ mese: e.target.value }); }} aria-label="Mese del report">
          {opzioniMesi.map((m) => <option key={m} value={m}>{meseEsteso(m)}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isAdmin && !editing && (
            <button className="btn ghost small" onClick={() => setEditing(true)}>{haCommento ? 'Modifica commento' : 'Scrivi commento'}</button>
          )}
          <button className="btn red small" onClick={() => window.print()}>Stampa / Salva PDF</button>
        </div>
      </div>

      {editing && <EditorCommento key={mese} mese={mese} commento={commento} onClose={() => setEditing(false)} />}

      <ReportView r={report} commento={commento} clubName={clubName} />

      {createPortal(
        <div id="stampa-report">
          <ReportView r={report} commento={commento} clubName={clubName} />
        </div>,
        document.body,
      )}
    </section>
  );
}
