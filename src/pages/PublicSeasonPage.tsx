import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { resolveLocation } from '../lib/location';
import { dayLabelShort, fmtISODate, todayISO } from '../lib/dates';
import type {
  PublicMatch,
  PublicSettingsBasic,
  PublicTraining,
  PublicVenueBasic,
} from '../types/database';

function currentMese(): string {
  return todayISO().slice(0, 7);
}

function monthRange(mese: string): { start: string; end: string } {
  const [y, m] = mese.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function shiftMese(mese: string, delta: number): string {
  const [y, m] = mese.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return fmtISODate(d).slice(0, 7);
}

function meseLabel(mese: string): string {
  const [y, m] = mese.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface Data {
  trainings: PublicTraining[];
  matches: PublicMatch[];
  venues: PublicVenueBasic[];
  clubName: string;
  logoUrl: string | null;
}

type Ev =
  | { type: 'training'; item: PublicTraining }
  | { type: 'match'; item: PublicMatch };

export default function PublicSeasonPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mese = /^\d{4}-\d{2}$/.test(searchParams.get('mese') || '') ? searchParams.get('mese')! : currentMese();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const { start, end } = monthRange(mese);
      const [trainingsRes, matchesRes, venuesRes, settingsRes] = await Promise.all([
        supabase.from('public_trainings').select('*').gte('data', start).lte('data', end),
        supabase.from('public_matches').select('*').gte('data', start).lte('data', end),
        supabase.from('public_venues_basic').select('*'),
        supabase.from('public_settings_basic').select('*').maybeSingle(),
      ]);
      if (!mounted) return;
      if (trainingsRes.error || matchesRes.error || venuesRes.error) {
        setError(true);
        setLoading(false);
        return;
      }
      const settingsRow = settingsRes.data as PublicSettingsBasic | null;
      setData({
        trainings: (trainingsRes.data || []) as PublicTraining[],
        matches: (matchesRes.data || []) as PublicMatch[],
        venues: (venuesRes.data || []) as PublicVenueBasic[],
        clubName: settingsRow?.club_name || 'SSV Bozen Volley',
        logoUrl: settingsRow?.logo_url || null,
      });
      setError(false);
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [mese]);

  function goToMese(next: string) {
    setSearchParams(next === currentMese() ? {} : { mese: next });
  }

  const clubName = data?.clubName || 'SSV Bozen Volley';
  const today = todayISO();

  const eventsByDay = (() => {
    if (!data) return [] as { data: string; events: Ev[] }[];
    const map = new Map<string, Ev[]>();
    data.trainings.forEach((t) => {
      if (!map.has(t.data)) map.set(t.data, []);
      map.get(t.data)!.push({ type: 'training', item: t });
    });
    data.matches.forEach((m) => {
      if (!map.has(m.data)) map.set(m.data, []);
      map.get(m.data)!.push({ type: 'match', item: m });
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([data, events]) => ({
        data,
        events: events.sort((a, b) => a.item.orario.localeCompare(b.item.orario)),
      }));
  })();

  return (
    <div style={{ background: 'var(--panna)', minHeight: '100vh' }}>
      <div className="stripe">
        <span className="r" />
        <span className="b" />
      </div>
      <header className="top">
        <div className="club">
          {data?.logoUrl ? (
            <img src={data.logoUrl} alt={clubName} />
          ) : (
            <div className="logo-fallback">
              {clubName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="club-name">{clubName}</div>
            <div className="club-sub">Calendario allenamenti e partite</div>
          </div>
        </div>
      </header>
      <main>
        <div className="card" style={{ fontSize: 13, color: 'var(--inchiostro-soft)' }}>
          Questa pagina è pubblica e mostra tutti gli impegni della squadra: condividila pure nel gruppo WhatsApp dei genitori.
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <button className="btn ghost small" onClick={() => goToMese(shiftMese(mese, -1))}>← Mese precedente</button>
            <h3 style={{ margin: 0 }}>{meseLabel(mese)}</h3>
            <button className="btn ghost small" onClick={() => goToMese(shiftMese(mese, 1))}>Mese successivo →</button>
          </div>
          {mese !== currentMese() && (
            <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
              <button className="btn ghost small" onClick={() => goToMese(currentMese())}>Torna al mese corrente</button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="card">Caricamento…</div>
        ) : error ? (
          <div className="card">Impossibile caricare il calendario. Riprova più tardi.</div>
        ) : eventsByDay.length === 0 ? (
          <div className="empty">Nessun allenamento o partita programmati in {meseLabel(mese).toLowerCase()}.</div>
        ) : (
          <div className="event-list">
            {eventsByDay.map(({ data: giorno, events }) => (
              <div className="card" key={giorno} style={{ padding: '14px 18px' }}>
                <div style={{ fontFamily: "'Barlow Condensed'", fontWeight: 800, fontSize: 17, marginBottom: 10 }}>
                  {dayLabelShort(giorno)}
                  {giorno === today && <span className="tag-svolto" style={{ marginLeft: 8 }}>Oggi</span>}
                </div>
                <div className="event-list" style={{ marginTop: 0 }}>
                  {events.map((e, i) => {
                    if (e.type === 'training') {
                      const t = e.item;
                      const loc = resolveLocation(t.venue_id, t.palestra_custom, data!.venues);
                      return (
                        <div className="event" key={`t-${i}`}>
                          <div className="event-main">
                            <div className="event-date">Allenamento</div>
                            <div className="event-detail">
                              {t.orario} · {loc.mapsUrl ? <a href={loc.mapsUrl} target="_blank" rel="noopener noreferrer">{loc.label}</a> : loc.label}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    const m = e.item;
                    const loc = resolveLocation(m.venue_id, m.luogo_custom, data!.venues);
                    return (
                      <div className="event match" key={`m-${i}`}>
                        <div className="event-main">
                          <div className="event-date">
                            Partita
                            <span className={`tag-categoria ${(m.categoria || 'U14').toLowerCase()}`} style={{ marginLeft: 0 }}>{m.categoria || 'U14'}</span>
                          </div>
                          <div className="event-detail">
                            {m.orario} · {m.casa_trasferta} · vs {m.avversario} ·{' '}
                            {loc.mapsUrl ? <a href={loc.mapsUrl} target="_blank" rel="noopener noreferrer">{loc.label}</a> : loc.label}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
