import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { FoglioSettimanale } from '../components/FoglioSettimanale';
import { todayISO, weekRangeFor, fmtDateShort, parseDateLocal, fmtISODate } from '../lib/dates';
import type {
  PublicMatch,
  PublicRosterBasic,
  PublicSettingsBasic,
  PublicTraining,
  PublicVenueBasic,
} from '../types/database';

interface PublicData {
  roster: PublicRosterBasic[];
  venues: PublicVenueBasic[];
  trainings: PublicTraining[];
  matches: PublicMatch[];
  clubName: string;
  logoUrl: string | null;
  coachNome: string | null;
  coachTelefono: string | null;
  viceCoachNome: string | null;
  viceCoachTelefono: string | null;
  dirigenteNome: string | null;
  dirigenteTelefono: string | null;
}

function weekFromSearchParams(params: URLSearchParams): string {
  const w = params.get('settimana');
  return w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : todayISO();
}

export default function PublicProgramPage() {
  const [data, setData] = useState<PublicData | null>(null);
  const [error, setError] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [weekAnchor, setWeekAnchorState] = useState(() => weekFromSearchParams(searchParams));

  function setWeekAnchor(next: string) {
    setWeekAnchorState(next);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('settimana', next);
      return p;
    }, { replace: true });
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [rosterRes, venuesRes, trainingsRes, matchesRes, settingsRes] = await Promise.all([
        supabase.from('public_roster_basic').select('*').order('cognome'),
        supabase.from('public_venues_basic').select('*'),
        supabase.from('public_trainings').select('*'),
        supabase.from('public_matches').select('*'),
        supabase.from('public_settings_basic').select('*').maybeSingle(),
      ]);
      if (!mounted) return;
      if (rosterRes.error || venuesRes.error || trainingsRes.error || matchesRes.error) {
        setError(true);
        return;
      }
      const settingsRow = settingsRes.data as PublicSettingsBasic | null;
      setData({
        roster: (rosterRes.data || []) as PublicRosterBasic[],
        venues: (venuesRes.data || []) as PublicVenueBasic[],
        trainings: (trainingsRes.data || []) as PublicTraining[],
        matches: (matchesRes.data || []) as PublicMatch[],
        clubName: settingsRow?.club_name || 'SSV Bozen Volley',
        logoUrl: settingsRow?.logo_url || null,
        coachNome: settingsRow?.coach_nome || null,
        coachTelefono: settingsRow?.coach_telefono || null,
        viceCoachNome: settingsRow?.vice_coach_nome || null,
        viceCoachTelefono: settingsRow?.vice_coach_telefono || null,
        dirigenteNome: settingsRow?.dirigente_nome || null,
        dirigenteTelefono: settingsRow?.dirigente_telefono || null,
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
              settings={{
                club_name: data.clubName, logo_url: data.logoUrl,
                coach_nome: data.coachNome, coach_telefono: data.coachTelefono,
                vice_coach_nome: data.viceCoachNome, vice_coach_telefono: data.viceCoachTelefono,
                dirigente_nome: data.dirigenteNome, dirigente_telefono: data.dirigenteTelefono,
              }}
              locatables={data.venues}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
