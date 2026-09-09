import { useEffect, useRef, useState } from 'react';
import { useUi } from '../contexts/UiContext';
import { useRoster } from '../hooks/useRoster';
import { useVenues } from '../hooks/useVenues';
import {
  useAddTraining,
  useAddTrainingsBulk,
  useDeleteTraining,
  useTrainings,
  useUpdateTraining,
} from '../hooks/useTrainings';
import { useRecurringDefaults, useSaveRecurringDefaults } from '../hooks/useRecurringDefaults';
import { TimeRangeInput } from '../components/ui/TimeInputs';
import { PlayerChecks, SelectAllButton } from '../components/ui/PlayerChecks';
import { AttendanceRow } from '../components/ui/AttendanceRow';
import { WeekPicker } from '../components/ui/WeekPicker';
import { fmtDate, fmtDateShort, fmtISODate, parseDateLocal, todayISO, weekRangeFor } from '../lib/dates';
import { resolveLocation } from '../lib/location';
import type { Giorno, Training } from '../types/database';

const GIORNI: { key: Giorno; label: string; dayIndex: number }[] = [
  { key: 'lun', label: 'Lunedì', dayIndex: 0 },
  { key: 'mer', label: 'Mercoledì', dayIndex: 2 },
  { key: 'ven', label: 'Venerdì', dayIndex: 4 },
];

interface DayState {
  attivo: boolean;
  orario: string;
  venueSel: string; // venue id, '__custom__', or ''
  custom: string;
  convocati: string[];
  convocatiOpen: boolean;
}

function emptyDay(): DayState {
  return { attivo: true, orario: '18:00–19:30', venueSel: '', custom: '', convocati: [], convocatiOpen: false };
}

export default function TrainingsPage() {
  const { showToast, confirm } = useUi();
  const { data: roster = [] } = useRoster();
  const { data: venues = [] } = useVenues();
  const { data: trainings = [] } = useTrainings();
  const { data: recurringDefaults } = useRecurringDefaults();
  const saveDefaults = useSaveRecurringDefaults();
  const addTraining = useAddTraining();
  const addBulk = useAddTrainingsBulk();
  const updateTraining = useUpdateTraining();
  const deleteTraining = useDeleteTraining();

  const [week, setWeek] = useState(todayISO());
  const [days, setDays] = useState<Record<Giorno, DayState>>({
    lun: emptyDay(), mer: emptyDay(), ven: emptyDay(),
  });
  const [singleDate, setSingleDate] = useState('');
  const [singleOrario, setSingleOrario] = useState('18:00–19:30');
  const [singleVenueSel, setSingleVenueSel] = useState('');
  const [singleCustom, setSingleCustom] = useState('');
  const [singleConvocati, setSingleConvocati] = useState<string[]>([]);
  const [singleConvocatiOpen, setSingleConvocatiOpen] = useState(false);
  const [editingConvocatiId, setEditingConvocatiId] = useState<string | null>(null);
  const [editingConvocatiSelection, setEditingConvocatiSelection] = useState<string[]>([]);
  const [openAttendanceIds, setOpenAttendanceIds] = useState<Set<string>>(new Set());
  const [openProgrammati, setOpenProgrammati] = useState(false);
  const [openInCorso, setOpenInCorso] = useState(false);
  const [openPassati, setOpenPassati] = useState(false);
  const [openPassatiWeeks, setOpenPassatiWeeks] = useState<Set<string>>(new Set());
  const programmatiInitialized = useRef(false);
  const inCorsoInitialized = useRef(false);

  useEffect(() => {
    const allIds = roster.map((p) => p.id);
    setDays((prev) => ({
      lun: { ...prev.lun, convocati: allIds },
      mer: { ...prev.mer, convocati: allIds },
      ven: { ...prev.ven, convocati: allIds },
    }));
    setSingleConvocati(allIds);
  }, [roster.length]);

  useEffect(() => {
    if (!recurringDefaults) return;
    setDays((prev) => {
      const next = { ...prev };
      (Object.keys(next) as Giorno[]).forEach((g) => {
        const d = recurringDefaults[g];
        if (d) {
          next[g] = {
            ...next[g],
            orario: d.orario || next[g].orario,
            venueSel: d.venue_id || (d.palestra_custom ? '__custom__' : ''),
            custom: d.palestra_custom || '',
          };
        }
      });
      return next;
    });
  }, [recurringDefaults]);

  const weekDays = weekRangeFor(week);
  const dayMap: Record<Giorno, string> = { lun: weekDays[0], mer: weekDays[2], ven: weekDays[4] };
  const isCurrentWeek = weekDays.includes(todayISO());

  function shiftWeek(deltaDays: number) {
    const d = parseDateLocal(week);
    d.setDate(d.getDate() + deltaDays);
    setWeek(fmtISODate(d));
  }

  function setDay(g: Giorno, patch: Partial<DayState>) {
    setDays((prev) => ({ ...prev, [g]: { ...prev[g], ...patch } }));
  }

  async function handleGenerate() {
    if (!week) { showToast('Scegli la settimana'); return; }
    const existing = new Set(trainings.map((t) => `${t.data}|${t.orario}|${t.venue_id || ''}|${(t.palestra_custom || '').toLowerCase()}`));
    const rows: Partial<Training>[] = [];
    const newDefaults: { giorno: Giorno; orario: string | null; venue_id: string | null; palestra_custom: string | null }[] = [];
    let skipped = 0, incomplete = 0;

    for (const { key } of GIORNI) {
      const d = days[key];
      if (!d.attivo) continue;
      const venue_id = d.venueSel && d.venueSel !== '__custom__' ? d.venueSel : null;
      const palestra_custom = d.venueSel === '__custom__' ? d.custom.trim() : null;
      if (!d.orario || (!venue_id && !palestra_custom)) { incomplete++; continue; }
      const dataStr = dayMap[key];
      const k = `${dataStr}|${d.orario}|${venue_id || ''}|${(palestra_custom || '').toLowerCase()}`;
      if (existing.has(k)) { skipped++; }
      else {
        rows.push({ data: dataStr, orario: d.orario, venue_id, palestra_custom, convocati: d.convocati, presenze: [] });
        existing.add(k);
      }
      newDefaults.push({ giorno: key, orario: d.orario, venue_id, palestra_custom });
    }

    if (rows.length === 0 && skipped === 0) {
      showToast(incomplete > 0 ? 'Compila orario e palestra per almeno un giorno' : 'Nessun allenamento da generare');
      return;
    }

    try {
      if (rows.length) await addBulk.mutateAsync(rows);
      if (newDefaults.length) await saveDefaults.mutateAsync(newDefaults);
      let msg = `${rows.length} allenamenti generati`;
      if (skipped) msg += ` (${skipped} già esistenti, saltati)`;
      if (incomplete) msg += ` — ${incomplete} giorno/i incompleto/i ignorato/i`;
      showToast(msg);
    } catch {
      showToast('Errore nella generazione degli allenamenti');
    }
  }

  async function handleAddSingle() {
    const venue_id = singleVenueSel && singleVenueSel !== '__custom__' ? singleVenueSel : null;
    const palestra_custom = singleVenueSel === '__custom__' ? singleCustom.trim() : null;
    if (!singleDate || !singleOrario || (!venue_id && !palestra_custom)) {
      showToast('Compila data, orario e palestra');
      return;
    }
    try {
      await addTraining.mutateAsync({ data: singleDate, orario: singleOrario, venue_id, palestra_custom, convocati: singleConvocati, presenze: [] });
      setSingleOrario('18:00–19:30');
      setSingleVenueSel('');
      setSingleCustom('');
      showToast('Allenamento aggiunto');
    } catch {
      showToast('Errore nel salvataggio');
    }
  }

  async function togglePresenza(t: Training, playerId: string, checked: boolean) {
    const presenze = checked ? [...(t.presenze || []), playerId] : (t.presenze || []).filter((id) => id !== playerId);
    const data: Partial<Training> = { presenze };
    if (!checked) {
      data.ritardi = (t.ritardi || []).filter((id) => id !== playerId);
    } else {
      const motivi = { ...(t.motivi_assenza || {}) };
      delete motivi[playerId];
      data.motivi_assenza = motivi;
    }
    try {
      await updateTraining.mutateAsync({ id: t.id, data });
    } catch {
      showToast('Errore nel salvataggio della presenza');
    }
  }

  async function toggleRitardo(t: Training, playerId: string, checked: boolean) {
    const ritardi = checked ? [...(t.ritardi || []), playerId] : (t.ritardi || []).filter((id) => id !== playerId);
    try {
      await updateTraining.mutateAsync({ id: t.id, data: { ritardi } });
    } catch {
      showToast('Errore nel salvataggio del ritardo');
    }
  }

  async function setMotivoAssenza(t: Training, playerId: string, motivo: string) {
    const motivi = { ...(t.motivi_assenza || {}) };
    if (motivo) motivi[playerId] = motivo;
    else delete motivi[playerId];
    try {
      await updateTraining.mutateAsync({ id: t.id, data: { motivi_assenza: motivi } });
    } catch {
      showToast('Errore nel salvataggio del motivo assenza');
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm('Eliminare questo allenamento?');
    if (!ok) return;
    try {
      await deleteTraining.mutateAsync(id);
      showToast('Allenamento eliminato');
    } catch {
      showToast('Errore nella cancellazione');
    }
  }

  function toggleAttendanceOpen(id: string) {
    setOpenAttendanceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openEditConvocati(t: Training) {
    setEditingConvocatiId(t.id);
    setEditingConvocatiSelection(t.convocati || []);
  }

  function closeEditConvocati() {
    setEditingConvocatiId(null);
    setEditingConvocatiSelection([]);
  }

  async function saveEditConvocati(t: Training) {
    const presenze = (t.presenze || []).filter((id) => editingConvocatiSelection.includes(id));
    try {
      await updateTraining.mutateAsync({ id: t.id, data: { convocati: editingConvocatiSelection, presenze } });
      closeEditConvocati();
      showToast('Convocati aggiornati');
    } catch {
      showToast('Errore nel salvataggio dei convocati');
    }
  }

  const today = todayISO();
  const currentWeek = weekRangeFor(today);
  const weekStart = currentWeek[0];
  const weekEnd = currentWeek[6];
  const passatiList = trainings.filter((t) => t.data < weekStart).sort((a, b) => b.data.localeCompare(a.data));
  const inCorsoList = trainings
    .filter((t) => t.data >= weekStart && t.data <= weekEnd)
    .sort((a, b) => {
      const aPast = a.data < today ? 1 : 0;
      const bPast = b.data < today ? 1 : 0;
      if (aPast !== bPast) return aPast - bPast;
      return a.data.localeCompare(b.data);
    });
  const programmatiList = trainings.filter((t) => t.data > weekEnd).sort((a, b) => a.data.localeCompare(b.data));

  const passatiPerSettimana = (() => {
    const map = new Map<string, Training[]>();
    for (const t of passatiList) {
      const wk = weekRangeFor(t.data)[0];
      if (!map.has(wk)) map.set(wk, []);
      map.get(wk)!.push(t);
    }
    return Array.from(map.entries())
      .map(([wk, list]) => [wk, [...list].sort((a, b) => a.data.localeCompare(b.data))] as [string, Training[]])
      .sort((a, b) => b[0].localeCompare(a[0]));
  })();

  function togglePassatiWeek(weekStartKey: string) {
    setOpenPassatiWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekStartKey)) next.delete(weekStartKey);
      else next.add(weekStartKey);
      return next;
    });
  }

  useEffect(() => {
    if (programmatiInitialized.current || trainings.length === 0) return;
    programmatiInitialized.current = true;
    setOpenProgrammati(programmatiList.length > 0);
  }, [trainings.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (inCorsoInitialized.current || trainings.length === 0) return;
    inCorsoInitialized.current = true;
    setOpenInCorso(inCorsoList.length > 0);
  }, [trainings.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function renderTraining(t: Training) {
    const presenze = t.presenze || [];
    const convocati = t.convocati || [];
    const convocatiPlayers = convocati
      .map((id) => roster.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .sort((a, b) => (a.numero ?? 99) - (b.numero ?? 99));
    const loc = resolveLocation(t.venue_id, t.palestra_custom, venues);
    const isEditingConvocati = editingConvocatiId === t.id;
    const isAttendanceOpen = openAttendanceIds.has(t.id);
    const isSvolto = t.data >= weekStart && t.data <= weekEnd && t.data < today;
    return (
      <div className="event" key={t.id}>
        <div className="event-main">
          <div className="event-date">
            {fmtDate(t.data)}
            {isSvolto && <span className="tag-svolto">Svolto</span>}
          </div>
          <div className="event-detail">
            {t.orario} · {loc.mapsUrl ? <a href={loc.mapsUrl} target="_blank" rel="noopener noreferrer">{loc.label}</a> : loc.label}
          </div>
          {isEditingConvocati ? (
            <div className="field" style={{ marginTop: 10 }}>
              <div className="row" style={{ alignItems: 'center', gap: 10 }}>
                <label style={{ margin: 0 }}>Convocati</label>
                <SelectAllButton players={roster} selected={editingConvocatiSelection} onChange={setEditingConvocatiSelection} />
              </div>
              <PlayerChecks players={roster} selected={editingConvocatiSelection} onChange={setEditingConvocatiSelection} />
              <div className="settings-actions">
                <button className="btn ghost" onClick={closeEditConvocati}>Annulla</button>
                <button className="btn" onClick={() => saveEditConvocati(t)}>Salva convocati</button>
              </div>
            </div>
          ) : (
            <>
              <div className="event-conv">Convocati: {convocati.length} · Presenti: {presenze.length} / {convocati.length}</div>
              <button type="button" className="btn ghost small" style={{ marginTop: 6 }} onClick={() => toggleAttendanceOpen(t.id)}>
                {isAttendanceOpen ? 'Nascondi convocati' : 'Convocati'}
              </button>
              {isAttendanceOpen && (
                convocatiPlayers.length === 0 ? (
                  <div className="attendance-list"><span className="muted">Nessun convocato — imposta prima i convocati.</span></div>
                ) : (
                  <div className="attendance-list">
                    {convocatiPlayers.map((p) => (
                      <AttendanceRow
                        key={p.id}
                        player={p}
                        presente={presenze.includes(p.id)}
                        ritardo={(t.ritardi || []).includes(p.id)}
                        motivo={(t.motivi_assenza || {})[p.id]}
                        onTogglePresente={(checked) => togglePresenza(t, p.id, checked)}
                        onToggleRitardo={(checked) => toggleRitardo(t, p.id, checked)}
                        onSetMotivo={(motivo) => setMotivoAssenza(t, p.id, motivo)}
                      />
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>
        {!isEditingConvocati && (
          <div className="event-actions">
            <button className="btn ghost small" onClick={() => openEditConvocati(t)}>Modifica convocati</button>
            <button className="btn small" style={{ background: 'var(--rosso-scuro)' }} onClick={() => handleDelete(t.id)}>Elimina</button>
          </div>
        )}
      </div>
    );
  }

  function renderSection(
    title: string,
    list: Training[],
    open: boolean,
    onToggle: () => void,
    emptyText: string,
  ) {
    return (
      <div className="card">
        <button type="button" className="section-toggle" onClick={onToggle} aria-expanded={open}>
          <span className="section-toggle-title">
            {title} <span className="section-badge">{list.length}</span>
          </span>
          <span className={`section-chevron${open ? ' open' : ''}`}>›</span>
        </button>
        {open && (
          <div className="event-list">
            {list.length === 0 ? <div className="empty">{emptyText}</div> : list.map(renderTraining)}
          </div>
        )}
      </div>
    );
  }

  function renderPassatiSection() {
    return (
      <div className="card">
        <button type="button" className="section-toggle" onClick={() => setOpenPassati((v) => !v)} aria-expanded={openPassati}>
          <span className="section-toggle-title">
            Allenamenti passati <span className="section-badge">{passatiList.length}</span>
          </span>
          <span className={`section-chevron${openPassati ? ' open' : ''}`}>›</span>
        </button>
        {openPassati && (
          <div className="event-list">
            {passatiPerSettimana.length === 0 ? (
              <div className="empty">Nessun allenamento passato.</div>
            ) : (
              passatiPerSettimana.map(([weekStartKey, list]) => {
                const weekEndKey = weekRangeFor(weekStartKey)[6];
                const isOpen = openPassatiWeeks.has(weekStartKey);
                return (
                  <div className="week-subsection" key={weekStartKey}>
                    <button
                      type="button"
                      className="section-toggle"
                      onClick={() => togglePassatiWeek(weekStartKey)}
                      aria-expanded={isOpen}
                    >
                      <span className="section-toggle-title">
                        {fmtDateShort(weekStartKey)} – {fmtDateShort(weekEndKey)} <span className="section-badge">{list.length}</span>
                      </span>
                      <span className={`section-chevron${isOpen ? ' open' : ''}`}>›</span>
                    </button>
                    {isOpen && <div className="event-list">{list.map(renderTraining)}</div>}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <section>
      <div className="card">
          <h3>Genera allenamenti della settimana</h3>
          <div style={{ marginBottom: 12 }}>
            <WeekPicker
              rangeStart={weekDays[0]}
              rangeEnd={weekDays[6]}
              value={week}
              isCurrentWeek={isCurrentWeek}
              onShift={shiftWeek}
              onReset={() => setWeek(todayISO())}
              onPick={setWeek}
            />
          </div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            Genera sempre lunedì, mercoledì e venerdì della settimana scelta. Deseleziona un giorno per saltarlo (es. festivo).
          </div>

          {GIORNI.map(({ key, label }) => {
            const d = days[key];
            return (
              <div className="card" style={{ background: 'var(--panna)', borderStyle: 'dashed', marginTop: 10 }} key={key}>
                <div className="row">
                  <label className="chk" style={{ background: '#fff' }}>
                    <input type="checkbox" checked={d.attivo} onChange={(e) => setDay(key, { attivo: e.target.checked })} />
                    <b>{label}</b>
                  </label>
                  <div className="field">
                    <label>Orario</label>
                    <TimeRangeInput value={d.orario} onChange={(v) => setDay(key, { orario: v })} />
                  </div>
                  <div className="field">
                    <label>Palestra</label>
                    <select style={{ width: 200 }} value={d.venueSel} onChange={(e) => setDay(key, { venueSel: e.target.value })} disabled={!d.attivo}>
                      <option value="">— scegli palestra —</option>
                      {venues.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                      <option value="__custom__">Altro (inserisci manualmente)</option>
                    </select>
                  </div>
                  {d.venueSel === '__custom__' && (
                    <div className="field">
                      <label>Nome palestra</label>
                      <input style={{ width: 180 }} value={d.custom} onChange={(e) => setDay(key, { custom: e.target.value })} disabled={!d.attivo} />
                    </div>
                  )}
                </div>
                <div className="field" style={{ marginTop: 10 }}>
                  <div className="row" style={{ alignItems: 'center', gap: 10 }}>
                    <button type="button" className="btn ghost small" onClick={() => setDay(key, { convocatiOpen: !d.convocatiOpen })}>
                      {d.convocatiOpen ? 'Nascondi convocati' : `Convocati (${d.convocati.length})`}
                    </button>
                    {d.convocatiOpen && (
                      <SelectAllButton players={roster} selected={d.convocati} onChange={(ids) => setDay(key, { convocati: ids })} />
                    )}
                  </div>
                  {d.convocatiOpen && (
                    <PlayerChecks players={roster} selected={d.convocati} onChange={(ids) => setDay(key, { convocati: ids })} />
                  )}
                </div>
              </div>
            );
          })}

          <div className="settings-actions">
            <button className="btn" onClick={handleGenerate}>Genera allenamenti di questa settimana</button>
          </div>
        </div>

        <div className="card">
          <h3>Nuova sessione di allenamento</h3>
          <div className="row">
            <div className="field"><label>Data</label><input type="date" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} /></div>
            <div className="field">
              <label>Orario</label>
              <TimeRangeInput value={singleOrario} onChange={setSingleOrario} />
            </div>
            <div className="field">
              <label>Palestra</label>
              <select style={{ width: 200 }} value={singleVenueSel} onChange={(e) => setSingleVenueSel(e.target.value)}>
                <option value="">— scegli palestra —</option>
                {venues.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                <option value="__custom__">Altro (inserisci manualmente)</option>
              </select>
            </div>
            {singleVenueSel === '__custom__' && (
              <div className="field"><label>Nome palestra</label><input style={{ width: 180 }} value={singleCustom} onChange={(e) => setSingleCustom(e.target.value)} /></div>
            )}
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <div className="row" style={{ alignItems: 'center', gap: 10 }}>
              <button type="button" className="btn ghost small" onClick={() => setSingleConvocatiOpen((v) => !v)}>
                {singleConvocatiOpen ? 'Nascondi convocati' : `Convocati (${singleConvocati.length})`}
              </button>
              {singleConvocatiOpen && (
                <SelectAllButton players={roster} selected={singleConvocati} onChange={setSingleConvocati} />
              )}
            </div>
            {singleConvocatiOpen && (
              <PlayerChecks players={roster} selected={singleConvocati} onChange={setSingleConvocati} />
            )}
          </div>
          <div className="settings-actions">
            <button className="btn" onClick={handleAddSingle}>Aggiungi allenamento</button>
          </div>
        </div>

      {renderSection('Allenamenti programmati', programmatiList, openProgrammati, () => setOpenProgrammati((v) => !v), 'Nessun allenamento programmato oltre questa settimana.')}
      {renderSection('Allenamenti in corso', inCorsoList, openInCorso, () => setOpenInCorso((v) => !v), 'Nessun allenamento questa settimana.')}
      {renderPassatiSection()}
    </section>
  );
}
