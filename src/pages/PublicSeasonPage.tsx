import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { resolveLocation } from '../lib/location';
import { MatchCardTop, bordoEsito } from '../components/MatchCardTop';
import { hasRisultato } from '../lib/risultato';
import { fmtISODate, meseEsteso, todayISO } from '../lib/dates';
import type { PublicMatch, PublicSettingsBasic, PublicVenueBasic } from '../types/database';

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

interface Data {
  matches: PublicMatch[];
  venues: PublicVenueBasic[];
  clubName: string;
  logoUrl: string | null;
}

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
      const [matchesRes, venuesRes, settingsRes] = await Promise.all([
        supabase.from('public_matches').select('*').gte('data', start).lte('data', end),
        supabase.from('public_venues_basic').select('*'),
        supabase.from('public_settings_basic').select('*').maybeSingle(),
      ]);
      if (!mounted) return;
      if (matchesRes.error || venuesRes.error) {
        setError(true);
        setLoading(false);
        return;
      }
      const settingsRow = settingsRes.data as PublicSettingsBasic | null;
      setData({
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

  const partite = (data?.matches || [])
    .slice()
    .sort((a, b) => a.data.localeCompare(b.data) || a.orario.localeCompare(b.orario));

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
            <div className="club-sub">Calendario partite</div>
          </div>
        </div>
      </header>
      <main>
        <div className="card" style={{ fontSize: 13, color: 'var(--inchiostro-soft)' }}>
          Questa pagina è pubblica e mostra tutte le partite della squadra: condividila pure nel gruppo WhatsApp dei genitori.
        </div>

        <div className="card">
          <div className="mese-nav">
            <button className="btn ghost small" aria-label="Mese precedente" onClick={() => goToMese(shiftMese(mese, -1))}>
              ←<span className="mese-nav-testo"> Mese precedente</span>
            </button>
            <h3>{meseEsteso(mese)}</h3>
            <button className="btn ghost small" aria-label="Mese successivo" onClick={() => goToMese(shiftMese(mese, 1))}>
              <span className="mese-nav-testo">Mese successivo </span>→
            </button>
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
        ) : partite.length === 0 ? (
          <div className="empty">Nessuna partita programmata in {meseEsteso(mese).toLowerCase()}.</div>
        ) : (
          <div className="event-list">
            {partite.map((m) => (
              <div
                className={`event match card-esito${hasRisultato(m) ? ' giocata' : ''}`}
                key={m.id}
                style={hasRisultato(m) ? { background: bordoEsito(m), borderColor: bordoEsito(m) } : { borderLeftColor: bordoEsito(m) }}
              >
                <div className="event-main">
                  <MatchCardTop m={m} loc={resolveLocation(m.venue_id, m.luogo_custom, data!.venues)} numeroGara={m.numero_gara_fipav} amichevole={m.amichevole} oggi={m.data === today} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
