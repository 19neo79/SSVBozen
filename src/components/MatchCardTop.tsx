import type { CSSProperties } from 'react';
import { fmtDate, parseDateLocal } from '../lib/dates';
import { esito, hasRisultato } from '../lib/risultato';
import type { ResolvedLocation } from '../lib/location';
import type { Categoria, SetParziale } from '../types/database';

interface PartitaBase {
  data: string;
  orario: string;
  casa_trasferta: string;
  categoria: Categoria;
  avversario: string;
  risultato_noi: number | null;
  risultato_loro: number | null;
  parziali: SetParziale[];
}

const BORDO_ESITO = { Vinta: '#1a7a34', Persa: 'var(--rosso)', Pari: 'var(--inchiostro-soft)', daDisputare: '#e0a800' };

/** Colore della card: giallo da disputare, poi colore dell'esito. */
export function bordoEsito(m: PartitaBase): string {
  return BORDO_ESITO[esito(m) ?? 'daDisputare'];
}

export function MatchCardTop({ m, loc, numeroGara, amichevole, oggi, nascondiRisultato }: {
  m: PartitaBase;
  loc: ResolvedLocation;
  /** undefined = riga non mostrata. */
  numeroGara?: string | null;
  amichevole?: boolean;
  oggi?: boolean;
  /** Il tabellone è bianco: va nascosto quando la card non è colorata (es. durante una modifica). */
  nascondiRisultato?: boolean;
}) {
  const giorno = parseDateLocal(m.data);
  return (
    <>
      <div className={`match-band ${m.categoria === 'U15' ? 'u15' : 'u14'}`}>
        <div className="match-cal" title={fmtDate(m.data)}>
          <div className="match-cal-gs">{giorno.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '')}</div>
          <div className="match-cal-gn">{String(giorno.getDate()).padStart(2, '0')}</div>
          <div className="match-cal-mm">{giorno.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')}</div>
          <div className="match-cal-hh">{m.orario}</div>
        </div>
        <div className="match-band-info">
          <div className="match-titolo">
            vs {m.avversario}
            {oggi && <span className="match-band-tag outline">Oggi</span>}
            {amichevole && <span className="match-band-tag outline">Amichevole</span>}
          </div>
          <div className="match-luogo">
            <span className="match-ct">{m.casa_trasferta}</span>
            <span>
              <svg className="match-pin" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
              </svg>
              {loc.mapsUrl ? <a href={loc.mapsUrl} target="_blank" rel="noopener noreferrer">{loc.label}</a> : loc.label}
            </span>
          </div>
          {numeroGara !== undefined && <div className="match-band-sub">N. Gara FIPAV: {numeroGara || '—'}</div>}
        </div>
        <div className="match-band-cat">{m.categoria || 'U14'}</div>
      </div>
      {hasRisultato(m) && !nascondiRisultato && (
        <div className="tabellone" style={{ '--esito': bordoEsito(m) } as CSSProperties}>
          <div className="tabellone-squadre">
            <div className="tabellone-box">
              <div className="tabellone-num">{m.risultato_noi}</div>
              <div className="tabellone-nome">SSV Bozen</div>
            </div>
            <div className="tabellone-sep">–</div>
            <div className="tabellone-box">
              <div className="tabellone-num">{m.risultato_loro}</div>
              <div className="tabellone-nome">{m.avversario}</div>
            </div>
          </div>
          <div className="tabellone-esito">{esito(m)}</div>
          {(m.parziali || []).length > 0 && (
            <div className="tabellone-set">
              {m.parziali.map((p, i) => (
                <span key={i} className={p.noi > p.loro ? 'vinto' : undefined} title={`${i + 1}° set`}>{p.noi}-{p.loro}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
