import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { FoglioSettimanale } from '../components/FoglioSettimanale';
import { weekRangeFor, fmtDateShort } from '../lib/dates';
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
  coachEmail: string | null;
  viceCoachNome: string | null;
  viceCoachTelefono: string | null;
  viceCoachEmail: string | null;
  dirigenteNome: string | null;
  dirigenteTelefono: string | null;
  dirigenteEmail: string | null;
}

type LoadState = 'loading' | 'invalid' | 'error' | 'ready';

export default function PublicProgramPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<LoadState>('loading');
  const [weekAnchor, setWeekAnchor] = useState<string | null>(null);
  const [data, setData] = useState<PublicData | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!token) {
        setState('invalid');
        return;
      }

      const linkRes = await supabase.from('public_week_links').select('week_start').eq('id', token).maybeSingle();
      if (!mounted) return;
      if (linkRes.error) {
        setState('error');
        return;
      }
      if (!linkRes.data) {
        setState('invalid');
        return;
      }
      const weekStart = linkRes.data.week_start as string;

      const [rosterRes, venuesRes, trainingsRes, matchesRes, settingsRes] = await Promise.all([
        supabase.from('public_roster_basic').select('*').order('cognome'),
        supabase.from('public_venues_basic').select('*'),
        supabase.from('public_trainings').select('*'),
        supabase.from('public_matches').select('*'),
        supabase.from('public_settings_basic').select('*').maybeSingle(),
      ]);
      if (!mounted) return;
      if (rosterRes.error || venuesRes.error || trainingsRes.error || matchesRes.error) {
        setState('error');
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
        coachEmail: settingsRow?.coach_email || null,
        viceCoachNome: settingsRow?.vice_coach_nome || null,
        viceCoachTelefono: settingsRow?.vice_coach_telefono || null,
        viceCoachEmail: settingsRow?.vice_coach_email || null,
        dirigenteNome: settingsRow?.dirigente_nome || null,
        dirigenteTelefono: settingsRow?.dirigente_telefono || null,
        dirigenteEmail: settingsRow?.dirigente_email || null,
      });
      setWeekAnchor(weekStart);
      setState('ready');
    }
    load();
    return () => {
      mounted = false;
    };
  }, [token]);

  if (state === 'invalid') {
    return (
      <div className="center-page">
        <div>Questo link non è valido. Chiedi al coach un link aggiornato.</div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="center-page">
        <div>Impossibile caricare il programma. Riprova più tardi.</div>
      </div>
    );
  }

  if (state === 'loading' || !data || !weekAnchor) {
    return <div className="center-page">Caricamento…</div>;
  }

  const days = weekRangeFor(weekAnchor);

  const weekConvocatiIds = new Set<string>();
  data.trainings.filter((t) => days.includes(t.data)).forEach((t) => (t.convocati || []).forEach((id) => weekConvocatiIds.add(id)));
  data.matches.filter((m) => days.includes(m.data)).forEach((m) => (m.convocati || []).forEach((id) => weekConvocatiIds.add(id)));
  const visibleRoster = data.roster.filter((p) => weekConvocatiIds.has(p.id));

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
        <div className="card no-print" style={{ fontSize: 13, color: 'var(--inchiostro-soft)' }}>
          <strong>{fmtDateShort(days[0])} — {fmtDateShort(days[6])}</strong> · Questa pagina è pubblica: condividila pure nel gruppo WhatsApp dei genitori.
        </div>
        <div className="piano-preview">
          <div className="card">
            <FoglioSettimanale
              days={days}
              trainings={data.trainings}
              matches={data.matches}
              roster={visibleRoster}
              settings={{
                club_name: data.clubName, logo_url: data.logoUrl,
                coach_nome: data.coachNome, coach_telefono: data.coachTelefono, coach_email: data.coachEmail,
                vice_coach_nome: data.viceCoachNome, vice_coach_telefono: data.viceCoachTelefono, vice_coach_email: data.viceCoachEmail,
                dirigente_nome: data.dirigenteNome, dirigente_telefono: data.dirigenteTelefono, dirigente_email: data.dirigenteEmail,
              }}
              locatables={data.venues}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
