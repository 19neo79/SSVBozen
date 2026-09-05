import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { FoglioSettimanale } from '../components/FoglioSettimanale';
import { todayISO, weekRangeFor, fmtDateShort } from '../lib/dates';
import type { Locatable } from '../lib/location';
import type {
  PublicCampoBasic,
  PublicMatch,
  PublicRosterBasic,
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

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [rosterRes, venuesRes, campiRes, trainingsRes, matchesRes] = await Promise.all([
        supabase.from('public_roster_basic').select('*'),
        supabase.from('public_venues_basic').select('*'),
        supabase.from('public_campi_avversari_basic').select('*'),
        supabase.from('public_trainings').select('*'),
        supabase.from('public_matches').select('*'),
      ]);
      if (!mounted) return;
      if (rosterRes.error || venuesRes.error || campiRes.error || trainingsRes.error || matchesRes.error) {
        setError(true);
        return;
      }
      setData({
        roster: (rosterRes.data || []) as PublicRosterBasic[],
        venues: (venuesRes.data || []) as PublicVenueBasic[],
        campi: (campiRes.data || []) as PublicCampoBasic[],
        trainings: (trainingsRes.data || []) as PublicTraining[],
        matches: (matchesRes.data || []) as PublicMatch[],
        clubName: 'SSV Bozen Volley',
        logoUrl: null,
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

  const days = weekRangeFor(todayISO());
  const locatables: Locatable[] = [...data.venues, ...data.campi];

  return (
    <div style={{ background: 'var(--panna)', minHeight: '100vh' }}>
      <div className="stripe">
        <span className="r" />
        <span className="b" />
      </div>
      <header className="top">
        <div className="club">
          <div className="logo-fallback">SB</div>
          <div>
            <div className="club-name">{data.clubName}</div>
            <div className="club-sub">Programma della settimana — Under 14/15</div>
          </div>
        </div>
      </header>
      <main>
        <div className="card no-print" style={{ fontSize: 13, color: 'var(--inchiostro-soft)' }}>
          Settimana dal {fmtDateShort(days[0])} al {fmtDateShort(days[6])}. Questa pagina è pubblica: condividila pure nel gruppo WhatsApp dei genitori.
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
