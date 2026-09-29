import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useUi } from '../contexts/UiContext';
import { useRoster } from '../hooks/useRoster';
import { useVenues } from '../hooks/useVenues';
import { useTrainings } from '../hooks/useTrainings';
import { useMatches } from '../hooks/useMatches';
import { useSettings } from '../hooks/useSettings';
import { useGetOrCreatePublicWeekLink } from '../hooks/usePublicWeekLink';
import { FoglioSettimanale } from '../components/FoglioSettimanale';
import { WeekPicker } from '../components/ui/WeekPicker';
import { fmtDateShort, fmtISODate, parseDateLocal, todayISO, weekRangeFor } from '../lib/dates';

export default function WeekPlanPage() {
  const { showToast } = useUi();
  const [pianoData, setPianoData] = useState(todayISO());
  const { data: roster = [] } = useRoster();
  const { data: venues = [] } = useVenues();
  const { data: trainings = [] } = useTrainings();
  const { data: matches = [] } = useMatches();
  const { data: settings } = useSettings();
  const getOrCreateLink = useGetOrCreatePublicWeekLink();

  const days = weekRangeFor(pianoData);
  const locatables = venues;
  const isCurrentWeek = days.includes(todayISO());

  function handlePrint() {
    window.print();
  }

  function shiftWeek(deltaDays: number) {
    const d = parseDateLocal(pianoData);
    d.setDate(d.getDate() + deltaDays);
    setPianoData(fmtISODate(d));
  }

  async function resolvePublicUrl(): Promise<string> {
    const token = await getOrCreateLink.mutateAsync(days[0]);
    return `${window.location.origin}/programma/${token}`;
  }

  async function handleCopyPublicLink() {
    try {
      const url = await resolvePublicUrl();
      try {
        await navigator.clipboard.writeText(url);
        showToast('Link copiato negli appunti — incollalo pure su WhatsApp');
      } catch {
        window.prompt('Copia questo link:', url);
      }
    } catch {
      showToast('Errore nella generazione del link pubblico');
    }
  }

  async function handlePreviewPublicLink() {
    try {
      const url = await resolvePublicUrl();
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      showToast('Errore nella generazione del link pubblico');
    }
  }

  async function handleCopySeasonLink() {
    const url = `${window.location.origin}/campionato`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copiato negli appunti — incollalo pure su WhatsApp');
    } catch {
      window.prompt('Copia questo link:', url);
    }
  }

  return (
    <section>
      <WeekPicker
        className="no-print"
        rangeStart={days[0]}
        rangeEnd={days[6]}
        value={pianoData}
        isCurrentWeek={isCurrentWeek}
        onShift={shiftWeek}
        onReset={() => setPianoData(todayISO())}
        onPick={setPianoData}
      >
        <button className="btn red" onClick={handlePrint}>Stampa / Salva PDF</button>
      </WeekPicker>

      <div className="card no-print">
        <h3 style={{ fontSize: 17 }}>Condividi questa settimana</h3>
        <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Questo link mostra sempre il programma di <strong>{fmtDateShort(days[0])} — {fmtDateShort(days[6])}</strong>,
          qualunque giorno lo si apra: comodo per mandarlo la domenica quando vuoi condividere già la settimana successiva.
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={handleCopyPublicLink}>Copia link pubblico per questa settimana</button>
          <button className="btn ghost" onClick={handlePreviewPublicLink}>Anteprima</button>
        </div>
      </div>

      <div className="card no-print">
        <h3 style={{ fontSize: 17 }}>Condividi tutte le partite</h3>
        <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Questo link mostra tutte le partite della stagione mese per mese, sempre aggiornato — non
          contiene dati riservati, va bene condividerlo una volta per tutte con i genitori.
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={handleCopySeasonLink}>Copia link partite</button>
          <a className="btn ghost" href={`${window.location.origin}/campionato`} target="_blank" rel="noopener noreferrer">Anteprima</a>
        </div>
      </div>

      <div className="card no-print" style={{ fontSize: 13, color: 'var(--inchiostro-soft)' }}>
        Suggerimento: dopo aver premuto &quot;Stampa / Salva PDF&quot;, scegli &quot;Salva come PDF&quot; nella finestra di stampa (o &quot;Salva su file&quot; da telefono). Il PDF risultante puoi condividerlo direttamente nel gruppo WhatsApp dei genitori.
      </div>

      <div className="scroll-hint no-print">← Scorri per vedere tutta la settimana →</div>
      <div className="piano-preview">
        <div className="card">
          <FoglioSettimanale days={days} trainings={trainings} matches={matches} roster={roster} settings={settings} locatables={locatables} />
        </div>
      </div>

      {createPortal(
        <div id="stampa-piano">
          <div className="foglio">
            <FoglioSettimanale days={days} trainings={trainings} matches={matches} roster={roster} settings={settings} locatables={locatables} />
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
