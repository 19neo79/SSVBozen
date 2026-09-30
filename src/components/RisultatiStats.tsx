import { useMemo, useState } from 'react';
import { StatCard } from './ui/StatCard';
import { fmtDateShort } from '../lib/dates';
import { exportRisultatiToExcel } from '../lib/excelRisultati';
import { computeRisultatiStats, decimale, perc, quoziente, type Bilancio } from '../lib/statsRisultati';
import type { Categoria, Match } from '../types/database';

type FiltroCategoria = 'Tutte' | Categoria;

export function RisultatiStats({ matches, clubName }: { matches: Match[]; clubName: string }) {
  const [categoria, setCategoria] = useState<FiltroCategoria>('Tutte');
  const [amichevoli, setAmichevoli] = useState(false);

  const filtrate = useMemo(
    () => matches.filter((m) => (categoria === 'Tutte' || m.categoria === categoria) && (amichevoli || !m.amichevole)),
    [matches, categoria, amichevoli],
  );
  const s = useMemo(() => computeRisultatiStats(filtrate), [filtrate]);
  const t = s.totale;

  const filtri = (
    <div className="row no-print" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div className="seg-tabs">
        {(['Tutte', 'U14', 'U15'] as FiltroCategoria[]).map((c) => (
          <button key={c} type="button" className={categoria === c ? 'active' : ''} onClick={() => setCategoria(c)}>
            {c === 'Tutte' ? 'Tutte le categorie' : c}
          </button>
        ))}
      </div>
      <label className="chk">
        <input type="checkbox" checked={amichevoli} onChange={(e) => setAmichevoli(e.target.checked)} />
        Includi amichevoli
      </label>
      <button
        className="btn ghost small"
        style={{ marginLeft: 'auto' }}
        disabled={s.partite.length === 0}
        title={s.partite.length === 0 ? 'Disponibile quando ci sarà almeno un risultato inserito' : undefined}
        onClick={() => exportRisultatiToExcel({
          clubName,
          s,
          filtro: `${categoria === 'Tutte' ? 'Tutte le categorie' : categoria}${amichevoli ? ' con amichevoli' : ''}`,
        })}
      >
        Esporta Excel (risultati)
      </button>
    </div>
  );

  if (s.partite.length === 0) {
    return (
      <>
        {filtri}
        <div className="card">
          <div className="empty">
            Nessun risultato inserito{categoria !== 'Tutte' ? ` per l'${categoria}` : ''}. Inseriscilo dalla scheda Partite con il pulsante &quot;Risultato&quot;: da lì in poi qui compariranno le statistiche e potrai esportarle in Excel.
          </div>
        </div>
      </>
    );
  }

  const conParziali = s.partiteConParziali > 0;
  const maxDistr = Math.max(1, ...s.distribuzione.map((d) => d.n));
  const forma = s.partite.slice(-10);

  const contesti: { label: string; b: Bilancio }[] = [
    { label: 'Casa', b: s.casa },
    { label: 'Trasferta', b: s.trasferta },
    ...(categoria === 'Tutte' ? [{ label: 'Under 14', b: s.perCategoria.U14 }, { label: 'Under 15', b: s.perCategoria.U15 }] : []),
  ].filter((c) => c.b.giocate > 0);

  return (
    <>
      {filtri}

      <div className="card">
        <h3>Bilancio</h3>
        <div className="stat-cards">
          <StatCard
            label="Partite giocate"
            value={t.giocate}
            sub={categoria === 'Tutte' ? `${s.perCategoria.U14.giocate} U14 · ${s.perCategoria.U15.giocate} U15` : undefined}
          />
          <StatCard label="Vinte" value={t.vinte} valueClass="rate-good" />
          <StatCard label="Perse" value={t.perse} valueClass="rate-bad" />
          <StatCard label="% vittorie" value={`${perc(t.vinte, t.giocate) ?? 0}%`} />
          <StatCard
            label="Punti classifica"
            value={s.puntiClassifica}
            sub={s.partiteClassifica > 0 ? `media ${decimale(s.puntiClassifica / s.partiteClassifica, 2)} a partita · sistema FIPAV` : 'sistema FIPAV'}
          />
          <StatCard
            label="Striscia attuale"
            value={s.strisciaAttuale ? `${s.strisciaAttuale.n} ${s.strisciaAttuale.tipo === 'V' ? (s.strisciaAttuale.n === 1 ? 'vittoria' : 'vittorie') : (s.strisciaAttuale.n === 1 ? 'sconfitta' : 'sconfitte')}` : '—'}
            valueClass={s.strisciaAttuale ? (s.strisciaAttuale.tipo === 'V' ? 'rate-good' : 'rate-bad') : undefined}
            sub={`record: ${s.migliorStrisciaV} vittorie di fila · ${s.peggiorStrisciaP} sconfitte di fila`}
          />
        </div>
      </div>

      <div className="card">
        <h3>Forma</h3>
        <div className="form-trend">
          {forma.map((p) => (
            <span
              key={p.match.id}
              className={`form-dot ${p.vinta ? 'vinta' : p.persa ? 'persa' : 'pari'}`}
              title={`${fmtDateShort(p.match.data)} · ${p.match.casa_trasferta} vs ${p.match.avversario} · ${p.noi}-${p.loro}`}
            >
              {p.vinta ? 'V' : p.persa ? 'P' : '='}
            </span>
          ))}
        </div>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
          Ultime {forma.length} partite, dalla più vecchia alla più recente — passa il mouse per data, avversario e risultato.
        </div>
      </div>

      <div className="card">
        <h3>Set</h3>
        <div className="stat-cards">
          <StatCard label="Set vinti" value={t.setVinti} />
          <StatCard label="Set persi" value={t.setPersi} />
          <StatCard label="Quoziente set" value={quoziente(t.setVinti, t.setPersi)} sub="set vinti ÷ set persi" />
          <StatCard label="% set vinti" value={`${perc(t.setVinti, t.setVinti + t.setPersi) ?? 0}%`} />
        </div>
      </div>

      <div className="card">
        <h3>Punti</h3>
        {!conParziali ? (
          <div className="empty">Per le statistiche sui punti servono i parziali dei set: inseriscili nel risultato delle partite.</div>
        ) : (
          <>
            <div className="stat-cards">
              <StatCard label="Punti fatti" value={t.puntiFatti} />
              <StatCard label="Punti subiti" value={t.puntiSubiti} />
              <StatCard label="Quoziente punti" value={quoziente(t.puntiFatti, t.puntiSubiti)} sub="punti fatti ÷ punti subiti" />
              <StatCard label="Media punti fatti per set" value={decimale(t.puntiFatti / t.setConParziali)} />
              <StatCard label="Media punti subiti per set" value={decimale(t.puntiSubiti / t.setConParziali)} />
              <StatCard
                label="Differenza punti"
                value={`${t.puntiFatti - t.puntiSubiti > 0 ? '+' : ''}${t.puntiFatti - t.puntiSubiti}`}
                valueClass={t.puntiFatti >= t.puntiSubiti ? 'rate-good' : 'rate-bad'}
              />
            </div>
            <NotaParziali s={s.partiteConParziali} tot={t.giocate} />
          </>
        )}
      </div>

      <div className="card">
        <h3>Rendimento per contesto</h3>
        <div className="table-scroll">
          <table className="stats-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Contesto</th>
                <th>G</th>
                <th>V</th>
                <th>P</th>
                <th>% V</th>
                <th>Set</th>
                <th>Quoz. set</th>
                <th>Punti</th>
                <th>Media set</th>
              </tr>
            </thead>
            <tbody>
              {contesti.map(({ label, b }) => (
                <tr key={label}>
                  <td style={{ fontWeight: 700 }}>{label}</td>
                  <td className="center">{b.giocate}</td>
                  <td className="center">{b.vinte}</td>
                  <td className="center">{b.perse}</td>
                  <td className="center">{perc(b.vinte, b.giocate) ?? 0}%</td>
                  <td className="center">{b.setVinti}-{b.setPersi}</td>
                  <td className="center">{quoziente(b.setVinti, b.setPersi)}</td>
                  <td className="center">{b.setConParziali > 0 ? `${b.puntiFatti}-${b.puntiSubiti}` : '—'}</td>
                  <td className="center">
                    {b.setConParziali > 0 ? `${decimale(b.puntiFatti / b.setConParziali)} – ${decimale(b.puntiSubiti / b.setConParziali)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
          Set e punti sono indicati come fatti-subiti; &quot;Media set&quot; = punti fatti e subiti in media per ogni set giocato.
        </div>
      </div>

      <div className="card">
        <h3>Distribuzione dei risultati</h3>
        <div className="bar-list">
          {s.distribuzione.map((d) => (
            <div className="bar-item" key={d.risultato} title={`${d.risultato}: ${d.n} ${d.n === 1 ? 'partita' : 'partite'}`}>
              <span className="bar-label" style={{ fontWeight: 700, color: 'var(--inchiostro)' }}>
                {d.vinta ? 'Vinta' : 'Persa'} {d.risultato}
              </span>
              <div className="bar-track">
                <div className={`bar-fill ${d.vinta ? 'rate-good' : 'rate-bad'}`} style={{ width: `${(d.n / maxDistr) * 100}%` }} />
              </div>
              <span className="bar-value">{d.n}</span>
            </div>
          ))}
        </div>
        {s.altriRisultati > 0 && (
          <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
            Più {s.altriRisultati} {s.altriRisultati === 1 ? 'partita' : 'partite'} con risultato non al meglio dei 5 set (es. 2-1).
          </div>
        )}
      </div>

      {conParziali && (
        <>
          <div className="card">
            <h3>Rendimento set per set</h3>
            <div className="bar-list">
              {s.perSet.filter((x) => x.giocati > 0).map((x) => {
                const r = perc(x.vinti, x.giocati) ?? 0;
                return (
                  <div className="bar-item" key={x.numero} title={`${x.numero}° set: vinti ${x.vinti} su ${x.giocati}`}>
                    <span className="bar-label">{x.numero === 5 ? 'Tie-break' : `${x.numero}° set`}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${r}%` }} />
                    </div>
                    <span className="bar-value" style={{ width: 88 }}>{r}% ({x.vinti}/{x.giocati})</span>
                  </div>
                );
              })}
            </div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
              Percentuale di set vinti in base alla posizione del set nella partita: indica se la squadra parte bene o cala alla distanza.
            </div>
          </div>

          <div className="card">
            <h3>Momenti chiave</h3>
            <div className="stat-cards">
              <StatCard
                label="Vinto il 1° set"
                value={s.primoSetVinto.partite > 0 ? `${perc(s.primoSetVinto.vinte, s.primoSetVinto.partite)}%` : '—'}
                sub={`partita poi vinta ${s.primoSetVinto.vinte} volte su ${s.primoSetVinto.partite}`}
              />
              <StatCard
                label="Rimonte"
                value={s.primoSetPerso.vinte}
                sub={`partite vinte dopo aver perso il 1° set (su ${s.primoSetPerso.partite})`}
              />
              <StatCard label="Tie-break vinti" value={s.tieBreak.giocati > 0 ? `${s.tieBreak.vinti}/${s.tieBreak.giocati}` : '—'} />
              <StatCard
                label="Set ai vantaggi vinti"
                value={s.vantaggi.giocati > 0 ? `${s.vantaggi.vinti}/${s.vantaggi.giocati}` : '—'}
                sub="oltre i 25 punti (15 al tie-break)"
              />
              <StatCard
                label="Set punto a punto vinti"
                value={s.puntoAPunto.giocati > 0 ? `${s.puntoAPunto.vinti}/${s.puntoAPunto.giocati}` : '—'}
                sub="chiusi con 3 punti di scarto o meno"
              />
              <StatCard
                label="Scarto medio"
                value={`+${decimale(s.scartoMedioVinti)} / −${decimale(s.scartoMedioPersi)}`}
                sub="punti di margine nei set vinti / persi"
              />
              {s.migliorSet && (
                <StatCard
                  label="Set più netto vinto"
                  value={`${s.migliorSet.set.noi}-${s.migliorSet.set.loro}`}
                  sub={`vs ${s.migliorSet.match.avversario} · ${fmtDateShort(s.migliorSet.match.data)}`}
                />
              )}
              {s.peggiorSet && (
                <StatCard
                  label="Set più netto perso"
                  value={`${s.peggiorSet.set.noi}-${s.peggiorSet.set.loro}`}
                  sub={`vs ${s.peggiorSet.match.avversario} · ${fmtDateShort(s.peggiorSet.match.data)}`}
                />
              )}
            </div>
            <NotaParziali s={s.partiteConParziali} tot={t.giocate} />
          </div>
        </>
      )}

      <div className="card">
        <h3>Scontri diretti</h3>
        <div className="table-scroll">
          <table className="stats-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Avversario</th>
                {categoria === 'Tutte' && <th>Cat.</th>}
                <th>G</th>
                <th>V-P</th>
                <th>Set</th>
                <th>Punti</th>
                <th>Quoz. punti</th>
              </tr>
            </thead>
            <tbody>
              {s.perAvversario.map((a) => (
                <tr key={`${a.categoria}-${a.nome}`}>
                  <td>{a.nome}</td>
                  {categoria === 'Tutte' && (
                    <td className="center">
                      <span className={`tag-categoria ${a.categoria.toLowerCase()}`} style={{ marginLeft: 0 }}>{a.categoria}</span>
                    </td>
                  )}
                  <td className="center">{a.giocate}</td>
                  <td className="center">{a.vinte}-{a.perse}</td>
                  <td className="center">{a.setVinti}-{a.setPersi}</td>
                  <td className="center">{a.setConParziali > 0 ? `${a.puntiFatti}-${a.puntiSubiti}` : '—'}</td>
                  <td className="center">{a.setConParziali > 0 ? quoziente(a.puntiFatti, a.puntiSubiti) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ fontSize: 12.5, color: 'var(--inchiostro-soft)' }}>
        <strong>Come leggere i dati.</strong> Punti classifica secondo il sistema FIPAV: 3 punti per la vittoria 3-0 o 3-1, 2 per il 3-2,
        1 per la sconfitta 2-3, nessuno per 1-3 e 0-3. Quoziente set e quoziente punti sono i criteri usati dalla FIPAV per
        spareggiare le squadre a pari punti in classifica: sopra 1 la squadra ne ha vinti/fatti più di quanti ne ha persi/subiti.
      </div>
    </>
  );
}

function NotaParziali({ s, tot }: { s: number; tot: number }) {
  if (s >= tot) return null;
  return (
    <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
      Calcolato sulle {s} partite su {tot} di cui sono stati inseriti i parziali dei set.
    </div>
  );
}
