import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { FoglioSettimanale } from '../components/FoglioSettimanale';
import { todayISO, weekRangeFor, fmtDateShort, parseDateLocal, fmtISODate } from '../lib/dates';
import type { Locatable } from '../lib/location';
import type {
  PublicCampoBasic,
  PublicMatch,
  PublicRosterBasic,
  PublicSettingsBasic,
  PublicTraining,
  PublicVenueBasic,
} from '../types/database';

interface PublicData {
  roster: PublicRosterBasic[];
  venues: PublicVenueBasic[];
  campi: PublicCampoBasic[];
  trainings: PublicTraining[];
  matches: PublicMatch[];
  clubName: string;
  logoUrl: string | null;
}

export default function PublicProgramPage() {
  const [data, setData] = useState<PublicData | null>(null);
  const [error, setError] = useState(false);
  const [weekAnchor, setWeekAnchor] = useState(todayISO());

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [rosterRes, venuesRes, campiRes, trainingsRes, matchesRes, settingsRes] = await Promise.all([
        supabase.from('public_roster_basic').select('*'),
        supabase.from('public_venues_basic').select('*'),
        supabase.from('public_campi_avversari_basic').select('*'),
        supabase.from('public_trainings').select('*'),
        supabase.from('public_matches').select('*'),
        supabase.from('public_settings_basic').select('*').maybeSingle(),
      ]);
      if (!mounted) return;
      if (rosterRes.error || venuesRes.error || campiRes.error || trainingsRes.error || matchesRes.error) {
        setError(true);
        return;
      }
      const settingsRow = settingsRes.data as PublicSettingsBasic | null;
      setData({
        roster: (rosterRes.data || []) as PublicRosterBasic[],
        venues: (venuesRes.data || []) as PublicVenueBasic[],
        campi: (campiRes.data || []) as PublicCampoBasic[],
        trainings: (trainingsRes.data || []) as PublicTraining[],
        matches: (matchesRes.data || []) as PublicMatch[],
        clubName: settingsRow?.club_name || 'SSV Bozen Volley',
        logoUrl: settingsRow?.logo_url || null,
      });
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return (
      <div className="center-page">
        <div>Impossibile caricare il programma. Riprova più tardi.</div>
      </div>
    );
  }

  if (!data) {
    return <div className="center-page">Caricamento…</div>;
  }

  const days = weekRangeFor(weekAnchor);
  const locatables: Locatable[] = [...data.venues, ...data.campi];
  const isCurrentWeek = days.includes(todayISO());

  function shiftWeek(deltaDays: number) {
    const d = parseDateLocal(weekAnchor);
    d.setDate(d.getDate() + deltaDays);
    setWeekAnchor(fmtISODate(d));
  }

  return (
    <div style={{ background: 'var(--panna)', minHeight: '100vh' }}>
      <div className="stripe">
        <span className="r" />
        <span className="b" />
      </div>
      <header className="top">
        <div className="club">
          {data.logoUrl ? (
            <img src={data.logoUrl} alt={data.clubName} />
          ) : (
            <div className="logo-fallback">
              {data.clubName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="club-name">{data.clubName}</div>
            <div className="club-sub">Programma della settimana — Under 14/15</div>
          </div>
        </div>
      </header>
      <main>
        <div className="week-picker no-print">
          <button className="btn ghost small" onClick={() => shiftWeek(-7)}>← Settimana precedente</button>
          <div className="week-range">{fmtDateShort(days[0])} — {fmtDateShort(days[6])}</div>
          <button className="btn ghost small" onClick={() => shiftWeek(7)}>Settimana successiva →</button>
          {!isCurrentWeek && (
            <button className="btn small" style={{ marginLeft: 'auto' }} onClick={() => setWeekAnchor(todayISO())}>
              Torna a questa settimana
            </button>
          )}
        </div>
        <div className="card no-print" style={{ fontSize: 13, color: 'var(--inchiostro-soft)' }}>
          Questa pagina è pubblica: condividila pure nel gruppo WhatsApp dei genitori.
        </div>
        <div className="piano-preview">
          <div className="card">
            <FoglioSettimanale
              days={days}
              trainings={data.trainings}
              matches={data.matches}
              roster={data.roster}
              settings={{ club_name: data.clubName, logo_url: data.logoUrl }}
              locatables={locatables}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
