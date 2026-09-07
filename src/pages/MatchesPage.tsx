import { useEffect, useRef, useState } from 'react';
import { useUi } from '../contexts/UiContext';
import { useRoster } from '../hooks/useRoster';
import { useVenues } from '../hooks/useVenues';
import { useAvversari } from '../hooks/useAvversari';
import {
  useAddMatch,
  useAddMatchesBulk,
  useDeleteMatch,
  useMatches,
  useUpdateMatch,
} from '../hooks/useMatches';
import { TimeSingleInput } from '../components/ui/TimeInputs';
import { PlayerChecks, SelectAllButton } from '../components/ui/PlayerChecks';
import { AttendanceRow } from '../components/ui/AttendanceRow';
import { fmtDate, isoToItalian, normalizeDateInput } from '../lib/dates';
import { downloadCSV, detectDelimiter, normalizeHeader, parseCSVLine, readCsvFile } from '../lib/csv';
import { resolveLocation } from '../lib/location';
import { isEligibleForCategoria } from '../lib/categoria';
import type { CasaTrasferta, Categoria, Match } from '../types/database';

const MATCH_HEADER_MAP: Record<string, string> = {
  data: 'data',
  orario: 'orario', ora: 'orario',
  casatrasferta: 'casa_trasferta', casaotrasferta: 'casa_trasferta', trasferta: 'casa_trasferta',
  categoria: 'categoria', under: 'categoria', squadra: 'categoria',
  avversario: 'avversario', squadraavversaria: 'avversario',
  palestra: 'venue_name', luogo: 'venue_name', luogopalestra: 'venue_name', sede: 'venue_name',
};

function normalizeCasaTrasferta(str: string): CasaTrasferta {
  return (str || '').trim().toLowerCase().startsWith('c') ? 'Casa' : 'Trasferta';
}
function normalizeCategoria(str: string): Categoria {
  const m = (str || '').match(/1[45]/);
  return m ? (('U' + m[0]) as Categoria) : 'U14';
}

export default function MatchesPage() {
  const { showToast, confirm } = useUi();
  const { data: roster = [] } = useRoster();
  const { data: venues = [] } = useVenues();
  const { data: avversari = [] } = useAvversari();
  const { data: matches = [] } = useMatches();
  const addMatch = useAddMatch();
  const addBulk = useAddMatchesBulk();
  const updateMatch = useUpdateMatch();
  const deleteMatch = useDeleteMatch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState('');
  const [orario, setOrario] = useState('10:00');
  const [casaTrasferta, setCasaTrasferta] = useState<CasaTrasferta>('Casa');
  const [categoria, setCategoria] = useState<Categoria>('U14');
  const [avvSel, setAvvSel] = useState('');
  const [avvCustom, setAvvCustom] = useState('');
  const [venueSel, setVenueSel] = useState('');
  const [venueCustom, setVenueCustom] = useState('');
  const [convocati, setConvocati] = useState<string[]>(roster.map((p) => p.id));
  const [editingConvocatiId, setEditingConvocatiId] = useState<string | null>(null);
  const [editingConvocatiSelection, setEditingConvocatiSelection] = useState<string[]>([]);

  useEffect(() => {
    setConvocati(roster.filter((p) => isEligibleForCategoria(p.data_nascita, categoria, p.solo_u15)).map((p) => p.id));
  }, [roster.length, categoria]); // eslint-disable-line react-hooks/exhaustive-deps

  const eligibleRoster = roster.filter((p) => isEligibleForCategoria(p.data_nascita, categoria, p.solo_u15));
  const opponent = avversari.find((o) => o.id === avvSel) || null;
  const filteredOpponents = avversari.filter((o) => o.categoria === categoria).sort((a, b) => a.nome.localeCompare(b.nome));
  const opponentVenues = opponent ? venues.filter((v) => v.avversario_id === opponent.id) : [];
  const usaCampoAvversario = casaTrasferta === 'Trasferta' && opponentVenues.length > 0;

  async function handleAdd() {
    let avversarioNome: string;
    let avversarioId: string | null = null;
    if (opponent) { avversarioNome = opponent.nome; avversarioId = opponent.id; }
    else { avversarioNome = avvCustom.trim(); }

    let venue_id: string | null = null;
    let luogo_custom: string | null = null;
    if (usaCampoAvversario) {
      // Con una sola palestra dell'avversario il campo è precompilato e disabilitato
      // (non genera un vero onChange), quindi va preso da opponentVenues e non da venueSel.
      venue_id = opponentVenues.length === 1 ? opponentVenues[0].id : (venueSel || null);
    } else {
      venue_id = venueSel && venueSel !== '__custom__' ? venueSel : null;
      luogo_custom = venueSel === '__custom__' ? venueCustom.trim() : null;
    }

    if (!data || !orario || !avversarioNome || (!venue_id && !luogo_custom)) {
      showToast('Compila tutti i campi della partita');
      return;
    }

    try {
      await addMatch.mutateAsync({
        data, orario, casa_trasferta: casaTrasferta, categoria,
        avversario: avversarioNome, avversario_id: avversarioId,
        venue_id, luogo_custom, convocati, presenze: [],
      });
      setOrario('10:00');
      setAvvSel('');
      setAvvCustom('');
      setVenueSel('');
      setVenueCustom('');
      showToast('Partita aggiunta');
    } catch {
      showToast('Errore nel salvataggio della partita');
    }
  }

  async function togglePresenza(m: Match, playerId: string, checked: boolean) {
    const presenze = checked ? [...(m.presenze || []), playerId] : (m.presenze || []).filter((id) => id !== playerId);
    const data: Partial<Match> = { presenze };
    if (!checked) {
      data.ritardi = (m.ritardi || []).filter((id) => id !== playerId);
    } else {
      const motivi = { ...(m.motivi_assenza || {}) };
      delete motivi[playerId];
      data.motivi_assenza = motivi;
    }
    try {
      await updateMatch.mutateAsync({ id: m.id, data });
    } catch {
      showToast('Errore nel salvataggio della presenza');
    }
  }

  async function toggleRitardo(m: Match, playerId: string, checked: boolean) {
    const ritardi = checked ? [...(m.ritardi || []), playerId] : (m.ritardi || []).filter((id) => id !== playerId);
    try {
      await updateMatch.mutateAsync({ id: m.id, data: { ritardi } });
    } catch {
      showToast('Errore nel salvataggio del ritardo');
    }
  }

  async function setMotivoAssenza(m: Match, playerId: string, motivo: string) {
    const motivi = { ...(m.motivi_assenza || {}) };
    if (motivo) motivi[playerId] = motivo;
    else delete motivi[playerId];
    try {
      await updateMatch.mutateAsync({ id: m.id, data: { motivi_assenza: motivi } });
    } catch {
      showToast('Errore nel salvataggio del motivo assenza');
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm('Eliminare questa partita?');
    if (!ok) return;
    try {
      await deleteMatch.mutateAsync(id);
      showToast('Partita eliminata');
    } catch {
      showToast('Errore nella cancellazione');
    }
  }

  function openEditConvocati(m: Match) {
    setEditingConvocatiId(m.id);
    setEditingConvocatiSelection(m.convocati || []);
  }

  function closeEditConvocati() {
    setEditingConvocatiId(null);
    setEditingConvocatiSelection([]);
  }

  async function saveEditConvocati(m: Match) {
    const presenze = (m.presenze || []).filter((id) => editingConvocatiSelection.includes(id));
    try {
      await updateMatch.mutateAsync({ id: m.id, data: { convocati: editingConvocatiSelection, presenze } });
      closeEditConvocati();
      showToast('Convocati aggiornati');
    } catch {
      showToast('Errore nel salvataggio dei convocati');
    }
  }

  function downloadTemplate() {
    const headers = ['Data', 'Orario', 'Casa/Trasferta', 'Categoria', 'Avversario', 'Palestra/Luogo'];
    const example = ['21/09/2026', '10:00', 'Casa', 'U14', 'Volley Team San Giacomo', 'Palestra Firmian'];
    const csv = headers.join(';') + '\n' + example.join(';');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'modello_calendario_partite.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    if (matches.length === 0) { showToast('Nessuna partita da esportare'); return; }
    const headers = ['Data', 'Orario', 'Casa/Trasferta', 'Categoria', 'Avversario', 'Palestra/Luogo'];
    const rows = matches.map((m) => [
      isoToItalian(m.data), m.orario || '', m.casa_trasferta || '', m.categoria || '', m.avversario || '',
      resolveLocation(m.venue_id, m.luogo_custom, venues).label,
    ]);
    downloadCSV('calendario_partite_export.csv', headers, rows);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readCsvFile(file);
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) { showToast('Il file CSV sembra vuoto'); e.target.value = ''; return; }
    const delim = detectDelimiter(lines[0]);
    const headers = parseCSVLine(lines[0], delim).map(normalizeHeader);
    const fieldMap = headers.map((h) => MATCH_HEADER_MAP[h] || null);
    if (!fieldMap.includes('data') || !fieldMap.includes('avversario')) {
      showToast('Il CSV deve avere almeno le colonne Data e Avversario');
      e.target.value = '';
      return;
    }

    const rows: Partial<Match>[] = [];
    let added = 0, skipped = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i], delim);
      const rec: Record<string, string> = {};
      fieldMap.forEach((field, idx) => { if (field) rec[field] = (cols[idx] || '').trim(); });
      const dataIso = normalizeDateInput(rec.data);
      const avversarioNome = rec.avversario || '';
      if (!dataIso || !avversarioNome) { skipped++; continue; }

      let venue_id: string | null = null;
      let luogo_custom: string | null = null;
      if (rec.venue_name) {
        const v = venues.find((v) => v.nome.trim().toLowerCase() === rec.venue_name.trim().toLowerCase());
        if (v) venue_id = v.id;
        else luogo_custom = rec.venue_name;
      }
      rows.push({
        data: dataIso, orario: rec.orario || '',
        casa_trasferta: normalizeCasaTrasferta(rec.casa_trasferta),
        categoria: normalizeCategoria(rec.categoria),
        avversario: avversarioNome, venue_id, luogo_custom, convocati: [], presenze: [],
      });
      added++;
    }
    try {
      await addBulk.mutateAsync(rows);
      const skippedMsg = skipped ? `, ${skipped} righe saltate` : '';
      showToast(`Import completato: ${added} partite aggiunte${skippedMsg}. Ricorda di impostare i convocati per ciascuna.`);
    } catch {
      showToast('Errore durante l\'importazione');
    }
    e.target.value = '';
  }

  const sortedMatches = [...matches].sort((a, b) => a.data.localeCompare(b.data));
  const playerLabel = (id: string) => {
    const p = roster.find((x) => x.id === id);
    return p ? `${p.cognome} ${p.nome}` : '?';
  };

  return (
    <section>
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <button className="btn ghost small" onClick={downloadTemplate}>Scarica modello CSV</button>
        <button className="btn ghost small" onClick={() => fileInputRef.current?.click()}>Importa calendario da CSV</button>
        <button className="btn ghost small" onClick={exportCSV}>Esporta CSV (backup)</button>
        <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
      </div>

      <div className="card">
        <h3>Nuovo impegno di weekend</h3>
        <div className="row">
          <div className="field"><label>Data</label><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div className="field">
            <label>Orario</label>
            <TimeSingleInput value={orario} onChange={setOrario} />
          </div>
          <div className="field">
            <label>Casa / Trasferta</label>
            <select value={casaTrasferta} onChange={(e) => setCasaTrasferta(e.target.value as CasaTrasferta)}>
              <option value="Casa">Casa</option>
              <option value="Trasferta">Trasferta</option>
            </select>
          </div>
          <div className="field">
            <label>Categoria</label>
            <select value={categoria} onChange={(e) => { setCategoria(e.target.value as Categoria); setAvvSel(''); }}>
              <option value="U14">Under 14</option>
              <option value="U15">Under 15</option>
            </select>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <label>Avversario</label>
            <select style={{ width: '100%' }} value={avvSel} onChange={(e) => setAvvSel(e.target.value)}>
              <option value="">— scegli avversario —</option>
              {filteredOpponents.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              <option value="__custom__">Altro (inserisci manualmente)</option>
            </select>
          </div>
          {avvSel === '__custom__' && (
            <div className="field" style={{ flex: 1, minWidth: 200 }}>
              <label>Nome avversario</label>
              <input style={{ width: '100%' }} value={avvCustom} onChange={(e) => setAvvCustom(e.target.value)} />
            </div>
          )}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <label>{usaCampoAvversario ? 'Campo avversario' : 'Luogo / Palestra'}</label>
            {usaCampoAvversario ? (
              opponentVenues.length === 1 ? (
                <select style={{ width: '100%' }} value={opponentVenues[0].id} disabled>
                  <option value={opponentVenues[0].id}>{opponentVenues[0].nome}</option>
                </select>
              ) : (
                <select style={{ width: '100%' }} value={venueSel} onChange={(e) => setVenueSel(e.target.value)}>
                  <option value="">— scegli campo —</option>
                  {opponentVenues.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                </select>
              )
            ) : (
              <select style={{ width: '100%' }} value={venueSel} onChange={(e) => setVenueSel(e.target.value)}>
                <option value="">— scegli palestra —</option>
                {venues.filter((v) => !v.avversario_id).map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                <option value="__custom__">Altro (inserisci manualmente)</option>
              </select>
            )}
          </div>
        </div>
        {!usaCampoAvversario && venueSel === '__custom__' && (
          <div className="row" style={{ marginTop: 8 }}>
            <div className="field" style={{ flex: 1, minWidth: 200 }}>
              <label>Nome luogo</label>
              <input style={{ width: '100%' }} value={venueCustom} onChange={(e) => setVenueCustom(e.target.value)} />
            </div>
          </div>
        )}
        <div className="field" style={{ marginTop: 12 }}>
          <div className="row" style={{ alignItems: 'center', gap: 10 }}>
            <label style={{ margin: 0 }}>Convocati</label>
            <SelectAllButton players={eligibleRoster} selected={convocati} onChange={setConvocati} />
          </div>
          {categoria === 'U14' && (
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>
              Convocabili solo gli atleti U14 (nati 2013–2015) — i nati 2012 giocano solo in U15.
            </div>
          )}
          <PlayerChecks players={eligibleRoster} selected={convocati} onChange={setConvocati} />
        </div>
        <div className="settings-actions">
          <button className="btn red" onClick={handleAdd}>Aggiungi partita</button>
        </div>
      </div>

      <div className="event-list">
        {sortedMatches.length === 0 ? (
          <div className="empty">Nessuna partita inserita.</div>
        ) : (
          sortedMatches.map((m) => {
            const presenze = m.presenze || [];
            const convocatiPlayers = (m.convocati || [])
              .map((id) => roster.find((p) => p.id === id))
              .filter((p): p is NonNullable<typeof p> => !!p)
              .sort((a, b) => (a.numero ?? 99) - (b.numero ?? 99));
            const loc = resolveLocation(m.venue_id, m.luogo_custom, venues);
            const isEditingConvocati = editingConvocatiId === m.id;
            return (
              <div className="event match" key={m.id}>
                <div className="event-main">
                  <div className="event-date">{fmtDate(m.data)} — Under {(m.categoria || 'U14').slice(-2)}</div>
                  <div className="event-detail">
                    {m.orario} · {m.casa_trasferta} · vs {m.avversario} ·{' '}
                    {loc.mapsUrl ? <a href={loc.mapsUrl} target="_blank" rel="noopener noreferrer">{loc.label}</a> : loc.label}
                  </div>
                  {isEditingConvocati ? (
                    <div className="field" style={{ marginTop: 10 }}>
                      <div className="row" style={{ alignItems: 'center', gap: 10 }}>
                        <label style={{ margin: 0 }}>Convocati</label>
                        <SelectAllButton players={roster.filter((p) => isEligibleForCategoria(p.data_nascita, m.categoria, p.solo_u15))} selected={editingConvocatiSelection} onChange={setEditingConvocatiSelection} />
                      </div>
                      {m.categoria === 'U14' && (
                        <div className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>
                          Convocabili solo gli atleti U14 (nati 2013–2015) — i nati 2012 giocano solo in U15.
                        </div>
                      )}
                      <PlayerChecks players={roster.filter((p) => isEligibleForCategoria(p.data_nascita, m.categoria, p.solo_u15))} selected={editingConvocatiSelection} onChange={setEditingConvocatiSelection} />
                      <div className="settings-actions">
                        <button className="btn ghost" onClick={closeEditConvocati}>Annulla</button>
                        <button className="btn" onClick={() => saveEditConvocati(m)}>Salva convocati</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="event-conv">Convocati: {(m.convocati || []).length} — {(m.convocati || []).map(playerLabel).join(', ') || 'nessuno'}</div>
                      <div className="event-conv">Presenti: {presenze.length} / {(m.convocati || []).length}</div>
                      {convocatiPlayers.length === 0 ? (
                        <div className="attendance-list"><span className="muted">Nessun convocato — imposta prima i convocati.</span></div>
                      ) : (
                        <div className="attendance-list">
                          {convocatiPlayers.map((p) => (
                            <AttendanceRow
                              key={p.id}
                              player={p}
                              presente={presenze.includes(p.id)}
                              ritardo={(m.ritardi || []).includes(p.id)}
                              motivo={(m.motivi_assenza || {})[p.id]}
                              onTogglePresente={(checked) => togglePresenza(m, p.id, checked)}
                              onToggleRitardo={(checked) => toggleRitardo(m, p.id, checked)}
                              onSetMotivo={(motivo) => setMotivoAssenza(m, p.id, motivo)}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {!isEditingConvocati && (
                  <div className="event-actions">
                    <button className="btn ghost small" onClick={() => openEditConvocati(m)}>Modifica convocati</button>
                    <button className="btn small" style={{ background: 'var(--rosso-scuro)' }} onClick={() => handleDelete(m.id)}>Elimina</button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
