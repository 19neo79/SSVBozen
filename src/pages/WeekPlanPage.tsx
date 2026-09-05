import { useState } from 'react';
import { useRoster } from '../hooks/useRoster';
import { useVenues } from '../hooks/useVenues';
import { useAvversari } from '../hooks/useAvversari';
import { useTrainings } from '../hooks/useTrainings';
import { useMatches } from '../hooks/useMatches';
import { useSettings } from '../hooks/useSettings';
import { FoglioSettimanale } from '../components/FoglioSettimanale';
import { fmtDateShort, fmtISODate, parseDateLocal, todayISO, weekRangeFor } from '../lib/dates';
import type { Locatable } from '../lib/location';

export default function WeekPlanPage() {
  const [pianoData, setPianoData] = useState(todayISO());
  const { data: roster = [] } = useRoster();
  const { data: venues = [] } = useVenues();
  const { data: avversari = [] } = useAvversari();
  const { data: trainings = [] } = useTrainings();
  const { data: matches = [] } = useMatches();
  const { data: settings } = useSettings();

  const days = weekRangeFor(pianoData);
  const locatables: Locatable[] = [...venues, ...avversari.flatMap((o) => o.campi || [])];
  const isCurrentWeek = days.includes(todayISO());

  function handlePrint() {
    window.print();
  }

  function shiftWeek(deltaDays: number) {
    const d = parseDateLocal(pianoData);
    d.setDate(d.getDate() + deltaDays);
    setPianoData(fmtISODate(d));
  }

  return (
    <section>
      <div className="week-picker no-print">
        <button className="btn ghost small" onClick={() => shiftWeek(-7)}>← Settimana precedente</button>
        <div className="week-range">{fmtDateShort(days[0])} — {fmtDateShort(days[6])}</div>
        <button className="btn ghost small" onClick={() => shiftWeek(7)}>Settimana successiva →</button>
        {!isCurrentWeek && (
          <button className="btn small" onClick={() => setPianoData(todayISO())}>Torna a questa settimana</button>
        )}
        <div className="field" style={{ marginLeft: 'auto' }}>
          <label>Oppure scegli un giorno qualsiasi</label>
          <input type="date" value={pianoData} onChange={(e) => setPianoData(e.target.value)} />
        </div>
        <button className="btn red" onClick={handlePrint}>Stampa / Salva PDF</button>
      </div>
      <div className="card no-print" style={{ fontSize: 13, color: 'var(--inchiostro-soft)' }}>
        Suggerimento: dopo aver premuto &quot;Stampa / Salva PDF&quot;, scegli &quot;Salva come PDF&quot; nella finestra di stampa (o &quot;Salva su file&quot; da telefono). Il PDF risultante puoi condividerlo direttamente nel gruppo WhatsApp dei genitori.
      </div>

      <div className="piano-preview">
        <div className="card">
          <FoglioSettimanale days={days} trainings={trainings} matches={matches} roster={roster} settings={settings} locatables={locatables} />
        </div>
      </div>

      <div id="stampa-piano">
        <div className="foglio">
          <FoglioSettimanale days={days} trainings={trainings} matches={matches} roster={roster} settings={settings} locatables={locatables} />
        </div>
      </div>
    </section>
  );
}
