import { dayLabelShort, fmtDateShort } from '../lib/dates';
import { resolveLocation, type Locatable } from '../lib/location';

export interface FoglioTraining {
  data: string;
  orario: string;
  venue_id: string | null;
  palestra_custom: string | null;
  convocati: string[];
}

export interface FoglioMatch {
  data: string;
  orario: string;
  casa_trasferta: string;
  categoria: string;
  avversario: string;
  venue_id: string | null;
  luogo_custom: string | null;
  convocati: string[];
}

export interface FoglioPlayer {
  id: string;
  nome: string;
  cognome: string;
  numero: number | null;
}

interface FoglioSettings {
  club_name: string;
  logo_url: string | null;
  coach_nome?: string | null;
  coach_telefono?: string | null;
  vice_coach_nome?: string | null;
  vice_coach_telefono?: string | null;
  dirigente_nome?: string | null;
  dirigente_telefono?: string | null;
}

interface FoglioProps {
  days: string[];
  trainings: FoglioTraining[];
  matches: FoglioMatch[];
  roster: FoglioPlayer[];
  settings: FoglioSettings | undefined;
  locatables: Locatable[];
}

export function FoglioSettimanale({ days, trainings, matches, roster, settings, locatables }: FoglioProps) {
  const weekTrainings = trainings
    .filter((t) => days.includes(t.data))
    .sort((a, b) => (a.data === b.data ? a.orario.localeCompare(b.orario) : a.data.localeCompare(b.data)));
  const weekMatches = matches
    .filter((m) => days.includes(m.data))
    .sort((a, b) => (a.data === b.data ? a.orario.localeCompare(b.orario) : a.data.localeCompare(b.data)));
  const players = [...roster].sort((a, b) => (a.numero ?? 99) - (b.numero ?? 99) || a.cognome.localeCompare(b.cognome));

  type Ev = { type: 'training'; item: FoglioTraining } | { type: 'match'; item: FoglioMatch };
  const events: Ev[] = [
    ...weekTrainings.map((t) => ({ type: 'training' as const, item: t })),
    ...weekMatches.map((m) => ({ type: 'match' as const, item: m })),
  ];

  const clubName = settings?.club_name || 'SSV Bozen Volley';

  const referenti: { ruolo: string; nome: string; telefono: string | null }[] = [
    { ruolo: 'Coach', nome: settings?.coach_nome || '', telefono: settings?.coach_telefono || null },
    { ruolo: 'Vice Coach', nome: settings?.vice_coach_nome || '', telefono: settings?.vice_coach_telefono || null },
    { ruolo: 'Dirigente', nome: settings?.dirigente_nome || '', telefono: settings?.dirigente_telefono || null },
  ].filter((r) => r.nome);

  return (
    <>
      <div className="foglio-head">
        {settings?.logo_url ? (
          <img src={settings.logo_url} alt={clubName} />
        ) : (
          <div className="logo-fallback" style={{ height: 56, width: 56, fontSize: 24 }}>
            {clubName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <div className="foglio-title">{clubName}</div>
          <div className="foglio-sub">Piano settimanale allenamenti e partite</div>
        </div>
        <div className="foglio-week">{fmtDateShort(days[0])} – {fmtDateShort(days[6])}</div>
      </div>

      <div className="sezione-title">Programma della settimana</div>
      {referenti.length > 0 && (
        <div className="foglio-referenti">
          {referenti.map((r, i) => (
            <span key={r.ruolo}>
              {i > 0 && ' · '}
              {r.ruolo} {r.nome}{r.telefono && <> <a href={`tel:${r.telefono}`}>{r.telefono}</a></>}
            </span>
          ))}
        </div>
      )}

      {events.length === 0 ? (
        <div className="muted" style={{ padding: '8px 0' }}>Nessun allenamento o partita programmati questa settimana.</div>
      ) : players.length === 0 ? (
        <div className="muted" style={{ padding: '8px 0' }}>Nessun giocatore in rosa.</div>
      ) : (
        <table className="matrix">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Giocatore</th>
              {events.map((e, i) => {
                if (e.type === 'training') {
                  const t = e.item;
                  const loc = resolveLocation(t.venue_id, t.palestra_custom, locatables);
                  return (
                    <th className="ev-training" key={`t-${i}`}>
                      {dayLabelShort(t.data)}
                      <span className="sub">Allenamento</span>
                      <span className="sub">{t.orario}</span>
                      <span className="sub">
                        {loc.mapsUrl ? <a className="maps-link" href={loc.mapsUrl} target="_blank" rel="noopener noreferrer">{loc.label}</a> : loc.label}
                      </span>
                    </th>
                  );
                }
                const m = e.item;
                const loc = resolveLocation(m.venue_id, m.luogo_custom, locatables);
                return (
                  <th className="ev-match" key={`m-${i}`}>
                    {dayLabelShort(m.data)} · U{(m.categoria || 'U14').slice(-2)}
                    <span className="sub">{m.orario} · {m.casa_trasferta}</span>
                    <span className="sub">vs {m.avversario}</span>
                    <span className="sub">
                      {loc.mapsUrl ? <a className="maps-link" href={loc.mapsUrl} target="_blank" rel="noopener noreferrer">{loc.label}</a> : loc.label}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <th>{p.numero ?? ''} {p.cognome} {p.nome}</th>
                {events.map((e, i) => {
                  const conv = e.item.convocati || [];
                  const si = conv.includes(p.id);
                  return (
                    <td className={`center${si ? ' si' : ''}`} key={i}>{si ? '✓' : ''}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="foglio-footer">Generato con il gestionale squadre giovanili · {clubName}</div>
    </>
  );
}
