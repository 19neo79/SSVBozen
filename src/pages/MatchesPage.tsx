import { Fragment, useEffect, useRef, useState } from 'react';
import { useUi } from '../contexts/UiContext';
import { useRoster } from '../hooks/useRoster';
import { useVenues } from '../hooks/useVenues';
import { useAvversari } from '../hooks/useAvversari';
import { useAvversarioVenues } from '../hooks/useAvversarioVenues';
import {
  useAddMatch,
  useAddMatchesBulk,
  useDeleteMatch,
  useMatches,
  useUpdateMatch,
} from '../hooks/useMatches';
import { TimeSingleInput } from '../components/ui/TimeInputs';
import { MatchCardTop, bordoEsito } from '../components/MatchCardTop';
import { PlayerChecks, SelectAllButton } from '../components/ui/PlayerChecks';
import { AttendanceRow, type AttendanceState } from '../components/ui/AttendanceRow';
import { isoToItalian, normalizeDateInput } from '../lib/dates';
import { downloadCSV, detectDelimiter, normalizeHeader, parseCSVLine, readCsvFile } from '../lib/csv';
import { resolveLocation } from '../lib/location';
import { isEligibleForCategoria } from '../lib/categoria';
import { erroreSet, hasRisultato, setVinti } from '../lib/risultato';
import type { CasaTrasferta, Categoria, Match, SetParziale } from '../types/database';

const MAX_SET = 5;
const SET_PER_VINCERE = 3;

// Un set è bloccato se nei set precedenti una squadra ha già vinto la partita.
function setBloccati(sets: { noi: string; loro: string }[]): boolean[] {
  let noi = 0;
  let loro = 0;
  return sets.map((s) => {
    const bloccato = noi >= SET_PER_VINCERE || loro >= SET_PER_VINCERE;
    if (!bloccato && /^\d{1,2}$/.test(s.noi.trim()) && /^\d{1,2}$/.test(s.loro.trim())) {
      if (Number(s.noi) > Number(s.loro)) noi++;
      else if (Number(s.loro) > Number(s.noi)) loro++;
    }
    return bloccato;
  });
}

const MATCH_HEADER_MAP: Record<string, string> = {
  data: 'data',
  orario: 'orario', ora: 'orario',
  casatrasferta: 'casa_trasferta', casaotrasferta: 'casa_trasferta', trasferta: 'casa_trasferta',
  categoria: 'categoria', under: 'categoria', squadra: 'categoria',
  avversario: 'avversario', squadraavversaria: 'avversario',
  palestra: 'venue_name', luogo: 'venue_name', luogopalestra: 'venue_name', palestraluogo: 'venue_name', sede: 'venue_name',
  ngara: 'numero_gara_fipav', ngarafipav: 'numero_gara_fipav', numerogarafipav: 'numero_gara_fipav', numerogara: 'numero_gara_fipav', garafipav: 'numero_gara_fipav',
};

function normalizeCasaTrasferta(str: string): CasaTrasferta {
  return (str || '').trim().toLowerCase().startsWith('c') ? 'Casa' : 'Trasferta';
}
function normalizeCategoria(str: string): Categoria {
  const m = (str || '').match(/1[45]/);
  return m ? (('U' + m[0]) as Categoria) : 'U14';
}
/** Confronto tollerante a maiuscole/minuscole e a spazi doppi/accidentali. */
function normalizeVenueName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export default function MatchesPage() {
  const { showToast, confirm } = useUi();
  const { data: roster = [] } = useRoster();
  const { data: venues = [] } = useVenues();
  const { data: avversarioVenueLinks = [] } = useAvversarioVenues();
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
  const [amichevole, setAmichevole] = useState(false);
  const [numeroGaraFipav, setNumeroGaraFipav] = useState('');
  const [convocati, setConvocati] = useState<string[]>(roster.map((p) => p.id));
  const [editingConvocatiId, setEditingConvocatiId] = useState<string | null>(null);
  const [editingConvocatiSelection, setEditingConvocatiSelection] = useState<string[]>([]);
  const [editingDetailsId, setEditingDetailsId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    data: '', orario: '', casaTrasferta: 'Casa' as CasaTrasferta, categoria: 'U14' as Categoria,
    avvSel: '', avvCustom: '', venueSel: '', venueCustom: '', amichevole: false, numeroGaraFipav: '',
  });
  const [editingRisultatoId, setEditingRisultatoId] = useState<string | null>(null);
  const [risultatoForm, setRisultatoForm] = useState<{ sets: { noi: string; loro: string }[]; noi: string; loro: string }>({
    sets: [], noi: '', loro: '',
  });

  useEffect(() => {
    setConvocati(roster.filter((p) => isEligibleForCategoria(p.data_nascita, categoria, p.solo_u15)).map((p) => p.id));
  }, [roster.length, categoria]); // eslint-disable-line react-hooks/exhaustive-deps

  const eligibleRoster = roster.filter((p) => isEligibleForCategoria(p.data_nascita, categoria, p.solo_u15));
  const opponent = avversari.find((o) => o.id === avvSel) || null;
  const filteredOpponents = avversari.filter((o) => o.categoria === categoria).sort((a, b) => a.nome.localeCompare(b.nome));
  const opponentVenueIds = new Set(avversarioVenueLinks.filter((l) => l.avversario_id === opponent?.id).map((l) => l.venue_id));
  const opponentVenues = opponent ? venues.filter((v) => opponentVenueIds.has(v.id)) : [];
  const usaCampoAvversario = casaTrasferta === 'Trasferta' && opponentVenues.length > 0;

  const editOpponent = avversari.find((o) => o.id === editForm.avvSel) || null;
  const editFilteredOpponents = avversari.filter((o) => o.categoria === editForm.categoria).sort((a, b) => a.nome.localeCompare(b.nome));
  const editOpponentVenueIds = new Set(avversarioVenueLinks.filter((l) => l.avversario_id === editOpponent?.id).map((l) => l.venue_id));
  const editOpponentVenues = editOpponent ? venues.filter((v) => editOpponentVenueIds.has(v.id)) : [];
  const editUsaCampoAvversario = editForm.casaTrasferta === 'Trasferta' && editOpponentVenues.length > 0;

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
        venue_id, luogo_custom, convocati, presenze: [], amichevole,
        numero_gara_fipav: numeroGaraFipav.trim() || null,
      });
      setOrario('10:00');
      setAvvSel('');
      setAvvCustom('');
      setVenueSel('');
      setVenueCustom('');
      setAmichevole(false);
      setNumeroGaraFipav('');
      showToast('Partita aggiunta');
    } catch {
      showToast('Errore nel salvataggio della partita');
    }
  }

  async function setAttendanceState(m: Match, playerId: string, state: AttendanceState) {
    const presenze = new Set(m.presenze || []);
    const assentiConfermati = new Set(m.assenti_confermati || []);
    const ritardi = new Set(m.ritardi || []);
    const motivi = { ...(m.motivi_assenza || {}) };

    presenze.delete(playerId);
    assentiConfermati.delete(playerId);

    if (state === 'presente') {
      presenze.add(playerId);
      delete motivi[playerId];
    } else if (state === 'assente') {
      assentiConfermati.add(playerId);
      ritardi.delete(playerId);
    } else {
      ritardi.delete(playerId);
      delete motivi[playerId];
    }

    const data: Partial<Match> = {
      presenze: Array.from(presenze),
      assenti_confermati: Array.from(assentiConfermati),
      ritardi: Array.from(ritardi),
      motivi_assenza: motivi,
    };
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

  function openEditDetails(m: Match) {
    setEditingConvocatiId(null);
    setEditingRisultatoId(null);
    setEditingDetailsId(m.id);
    setEditForm({
      data: m.data,
      orario: m.orario,
      casaTrasferta: m.casa_trasferta,
      categoria: m.categoria,
      avvSel: m.avversario_id || '__custom__',
      avvCustom: m.avversario_id ? '' : m.avversario,
      venueSel: m.venue_id || (m.luogo_custom ? '__custom__' : ''),
      venueCustom: m.luogo_custom || '',
      amichevole: m.amichevole,
      numeroGaraFipav: m.numero_gara_fipav || '',
    });
  }

  function closeEditDetails() {
    setEditingDetailsId(null);
  }

  async function saveEditDetails(m: Match) {
    let avversarioNome: string;
    let avversarioId: string | null = null;
    if (editOpponent) { avversarioNome = editOpponent.nome; avversarioId = editOpponent.id; }
    else { avversarioNome = editForm.avvCustom.trim(); }

    let venue_id: string | null = null;
    let luogo_custom: string | null = null;
    if (editUsaCampoAvversario) {
      venue_id = editOpponentVenues.length === 1 ? editOpponentVenues[0].id : (editForm.venueSel || null);
    } else {
      venue_id = editForm.venueSel && editForm.venueSel !== '__custom__' ? editForm.venueSel : null;
      luogo_custom = editForm.venueSel === '__custom__' ? editForm.venueCustom.trim() : null;
    }

    if (!editForm.data || !editForm.orario || !avversarioNome || (!venue_id && !luogo_custom)) {
      showToast('Compila tutti i campi della partita');
      return;
    }

    try {
      await updateMatch.mutateAsync({
        id: m.id,
        data: {
          data: editForm.data, orario: editForm.orario, casa_trasferta: editForm.casaTrasferta, categoria: editForm.categoria,
          avversario: avversarioNome, avversario_id: avversarioId, venue_id, luogo_custom, amichevole: editForm.amichevole,
          numero_gara_fipav: editForm.numeroGaraFipav.trim() || null,
        },
      });
      closeEditDetails();
      showToast('Partita aggiornata');
    } catch {
      showToast('Errore nel salvataggio delle modifiche');
    }
  }

  function openEditRisultato(m: Match) {
    setEditingConvocatiId(null);
    setEditingDetailsId(null);
    setEditingRisultatoId(m.id);
    const sets = (m.parziali || []).map((s) => ({ noi: String(s.noi), loro: String(s.loro) }));
    while (sets.length < MAX_SET) sets.push({ noi: '', loro: '' });
    setRisultatoForm({
      sets,
      noi: m.risultato_noi != null ? String(m.risultato_noi) : '',
      loro: m.risultato_loro != null ? String(m.risultato_loro) : '',
    });
  }

  function closeEditRisultato() {
    setEditingRisultatoId(null);
  }

  const risultatoBloccati = setBloccati(risultatoForm.sets);

  function aggiornaSet(i: number, campo: 'noi' | 'loro', valore: string) {
    const sets = risultatoForm.sets.map((x, j) => (j === i ? { ...x, [campo]: valore } : x));
    const bloccati = setBloccati(sets);
    setRisultatoForm({ ...risultatoForm, sets: sets.map((x, j) => (bloccati[j] ? { noi: '', loro: '' } : x)) });
  }

  const risultatoCompilati = risultatoForm.sets.filter((s) => s.noi.trim() !== '' || s.loro.trim() !== '');
  const risultatoParziali: SetParziale[] = risultatoCompilati.map((s) => ({ noi: Number(s.noi), loro: Number(s.loro) }));
  const risultatoDaParziali = risultatoParziali.length > 0 ? setVinti(risultatoParziali) : null;

  async function saveRisultato(m: Match) {
    const isPunteggio = (v: string) => /^\d{1,2}$/.test(v.trim());
    if (risultatoCompilati.some((s) => !isPunteggio(s.noi) || !isPunteggio(s.loro))) {
      showToast('Ogni set deve avere entrambi i punteggi');
      return;
    }
    const ultimoCompilato = risultatoForm.sets.map((x) => x.noi.trim() !== '' || x.loro.trim() !== '').lastIndexOf(true);
    if (risultatoForm.sets.slice(0, ultimoCompilato + 1).some((x) => x.noi.trim() === '' && x.loro.trim() === '')) {
      showToast('Compila i set in ordine, senza lasciarne vuoti in mezzo');
      return;
    }
    // Il messaggio mostra il set nell'ordine in cui è stato inserito (casa-ospite).
    const errore = risultatoParziali
      .map((x, i) => erroreSet(m.casa_trasferta === 'Trasferta' ? { noi: x.loro, loro: x.noi } : x, i + 1))
      .find(Boolean);
    if (errore) {
      showToast(errore.charAt(0).toUpperCase() + errore.slice(1));
      return;
    }
    let risultato_noi: number | null = null;
    let risultato_loro: number | null = null;
    if (risultatoDaParziali) {
      risultato_noi = risultatoDaParziali.noi;
      risultato_loro = risultatoDaParziali.loro;
    } else if (risultatoForm.noi.trim() !== '' || risultatoForm.loro.trim() !== '') {
      if (!/^\d$/.test(risultatoForm.noi.trim()) || !/^\d$/.test(risultatoForm.loro.trim())) {
        showToast('Inserisci i set vinti da entrambe le squadre');
        return;
      }
      const n = Number(risultatoForm.noi);
      const l = Number(risultatoForm.loro);
      if (n > SET_PER_VINCERE || l > SET_PER_VINCERE || (n === SET_PER_VINCERE && l === SET_PER_VINCERE)) {
        showToast('Al meglio dei 5 set: al massimo 3 set vinti, e una sola squadra può arrivarci');
        return;
      }
      risultato_noi = Number(risultatoForm.noi);
      risultato_loro = Number(risultatoForm.loro);
    }
    try {
      await updateMatch.mutateAsync({ id: m.id, data: { risultato_noi, risultato_loro, parziali: risultatoParziali } });
      closeEditRisultato();
      showToast(risultato_noi == null ? 'Risultato cancellato' : 'Risultato salvato');
    } catch {
      showToast('Errore nel salvataggio del risultato');
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
    setEditingDetailsId(null);
    setEditingRisultatoId(null);
    setEditingConvocatiId(m.id);
    setEditingConvocatiSelection(m.convocati || []);
  }

  function closeEditConvocati() {
    setEditingConvocatiId(null);
    setEditingConvocatiSelection([]);
  }

  async function saveEditConvocati(m: Match) {
    const presenze = (m.presenze || []).filter((id) => editingConvocatiSelection.includes(id));
    const assenti_confermati = (m.assenti_confermati || []).filter((id) => editingConvocatiSelection.includes(id));
    try {
      await updateMatch.mutateAsync({ id: m.id, data: { convocati: editingConvocatiSelection, presenze, assenti_confermati } });
      closeEditConvocati();
      showToast('Convocati aggiornati');
    } catch {
      showToast('Errore nel salvataggio dei convocati');
    }
  }

  function downloadTemplate() {
    const headers = ['Data', 'Orario', 'Casa/Trasferta', 'Categoria', 'Avversario', 'Palestra/Luogo', 'N. Gara FIPAV'];
    const example = ['21/09/2026', '10:00', 'Casa', 'U14', 'Volley Team San Giacomo', 'Palestra Firmian', '123456'];
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
    const headers = ['Data', 'Orario', 'Casa/Trasferta', 'Categoria', 'Avversario', 'Palestra/Luogo', 'N. Gara FIPAV'];
    const rows = matches.map((m) => [
      isoToItalian(m.data), m.orario || '', m.casa_trasferta || '', m.categoria || '', m.avversario || '',
      resolveLocation(m.venue_id, m.luogo_custom, venues).label, m.numero_gara_fipav || '',
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

      const categoriaRec = normalizeCategoria(rec.categoria);
      const avvMatch = avversari.find(
        (o) => o.categoria === categoriaRec && o.nome.trim().toLowerCase() === avversarioNome.trim().toLowerCase(),
      );

      let venue_id: string | null = null;
      let luogo_custom: string | null = null;
      if (rec.venue_name) {
        const v = venues.find((v) => normalizeVenueName(v.nome) === normalizeVenueName(rec.venue_name));
        if (v) venue_id = v.id;
        else luogo_custom = rec.venue_name;
      }
      rows.push({
        data: dataIso, orario: rec.orario || '',
        casa_trasferta: normalizeCasaTrasferta(rec.casa_trasferta),
        categoria: categoriaRec,
        avversario: avvMatch?.nome || avversarioNome, avversario_id: avvMatch?.id || null,
        venue_id, luogo_custom, convocati: [], presenze: [],
        numero_gara_fipav: rec.numero_gara_fipav || null,
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
        <h3>Nuova partita</h3>
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
          <div className="field"><label>N. Gara FIPAV</label><input style={{ width: 130 }} value={numeroGaraFipav} onChange={(e) => setNumeroGaraFipav(e.target.value)} /></div>
          <label className="chk" style={{ alignSelf: 'flex-end', marginBottom: 2 }}>
            <input type="checkbox" checked={amichevole} onChange={(e) => setAmichevole(e.target.checked)} />
            Amichevole
          </label>
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
                {venues.filter((v) => !avversarioVenueLinks.some((l) => l.venue_id === v.id)).map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
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
              .sort((a, b) => (a.numero ?? 99) - (b.numero ?? 99) || a.cognome.localeCompare(b.cognome));
            const loc = resolveLocation(m.venue_id, m.luogo_custom, venues);
            const isEditingConvocati = editingConvocatiId === m.id;
            const isEditingDetails = editingDetailsId === m.id;
            const isEditingRisultato = editingRisultatoId === m.id;
            const giocata = hasRisultato(m) && !isEditingDetails && !isEditingConvocati && !isEditingRisultato;
            // Nel modulo del risultato i punti si inseriscono come sul referto: prima la squadra di casa.
            const inCasa = m.casa_trasferta !== 'Trasferta';
            const colonne: ('noi' | 'loro')[] = inCasa ? ['noi', 'loro'] : ['loro', 'noi'];
            return (
              <div
                className={`event match card-esito${giocata ? ' giocata' : ''}`}
                key={m.id}
                style={giocata ? { background: bordoEsito(m), borderColor: bordoEsito(m) } : { borderLeftColor: bordoEsito(m) }}
              >
                <div className="event-main">
                  {isEditingDetails ? (
                    <div className="field" style={{ marginTop: 4 }}>
                      <div className="row">
                        <div className="field"><label>Data</label><input type="date" value={editForm.data} onChange={(e) => setEditForm({ ...editForm, data: e.target.value })} /></div>
                        <div className="field">
                          <label>Orario</label>
                          <TimeSingleInput value={editForm.orario} onChange={(v) => setEditForm({ ...editForm, orario: v })} />
                        </div>
                        <div className="field">
                          <label>Casa / Trasferta</label>
                          <select value={editForm.casaTrasferta} onChange={(e) => setEditForm({ ...editForm, casaTrasferta: e.target.value as CasaTrasferta })}>
                            <option value="Casa">Casa</option>
                            <option value="Trasferta">Trasferta</option>
                          </select>
                        </div>
                        <div className="field">
                          <label>Categoria</label>
                          <select value={editForm.categoria} onChange={(e) => setEditForm({ ...editForm, categoria: e.target.value as Categoria, avvSel: '' })}>
                            <option value="U14">Under 14</option>
                            <option value="U15">Under 15</option>
                          </select>
                        </div>
                        <div className="field"><label>N. Gara FIPAV</label><input style={{ width: 130 }} value={editForm.numeroGaraFipav} onChange={(e) => setEditForm({ ...editForm, numeroGaraFipav: e.target.value })} /></div>
                        <label className="chk" style={{ alignSelf: 'flex-end', marginBottom: 2 }}>
                          <input type="checkbox" checked={editForm.amichevole} onChange={(e) => setEditForm({ ...editForm, amichevole: e.target.checked })} />
                          Amichevole
                        </label>
                      </div>
                      <div className="row" style={{ marginTop: 12 }}>
                        <div className="field" style={{ flex: 1, minWidth: 200 }}>
                          <label>Avversario</label>
                          <select style={{ width: '100%' }} value={editForm.avvSel} onChange={(e) => setEditForm({ ...editForm, avvSel: e.target.value })}>
                            <option value="">— scegli avversario —</option>
                            {editFilteredOpponents.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                            <option value="__custom__">Altro (inserisci manualmente)</option>
                          </select>
                        </div>
                        {editForm.avvSel === '__custom__' && (
                          <div className="field" style={{ flex: 1, minWidth: 200 }}>
                            <label>Nome avversario</label>
                            <input style={{ width: '100%' }} value={editForm.avvCustom} onChange={(e) => setEditForm({ ...editForm, avvCustom: e.target.value })} />
                          </div>
                        )}
                      </div>
                      <div className="row" style={{ marginTop: 12 }}>
                        <div className="field" style={{ flex: 1, minWidth: 200 }}>
                          <label>{editUsaCampoAvversario ? 'Campo avversario' : 'Luogo / Palestra'}</label>
                          {editUsaCampoAvversario ? (
                            editOpponentVenues.length === 1 ? (
                              <select style={{ width: '100%' }} value={editOpponentVenues[0].id} disabled>
                                <option value={editOpponentVenues[0].id}>{editOpponentVenues[0].nome}</option>
                              </select>
                            ) : (
                              <select style={{ width: '100%' }} value={editForm.venueSel} onChange={(e) => setEditForm({ ...editForm, venueSel: e.target.value })}>
                                <option value="">— scegli campo —</option>
                                {editOpponentVenues.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                              </select>
                            )
                          ) : (
                            <select style={{ width: '100%' }} value={editForm.venueSel} onChange={(e) => setEditForm({ ...editForm, venueSel: e.target.value })}>
                              <option value="">— scegli palestra —</option>
                              {venues.filter((v) => !avversarioVenueLinks.some((l) => l.venue_id === v.id)).map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                              <option value="__custom__">Altro (inserisci manualmente)</option>
                            </select>
                          )}
                        </div>
                      </div>
                      {!editUsaCampoAvversario && editForm.venueSel === '__custom__' && (
                        <div className="row" style={{ marginTop: 8 }}>
                          <div className="field" style={{ flex: 1, minWidth: 200 }}>
                            <label>Nome luogo</label>
                            <input style={{ width: '100%' }} value={editForm.venueCustom} onChange={(e) => setEditForm({ ...editForm, venueCustom: e.target.value })} />
                          </div>
                        </div>
                      )}
                      <div className="settings-actions">
                        <button className="btn ghost" onClick={closeEditDetails}>Annulla</button>
                        <button className="btn" onClick={() => saveEditDetails(m)}>Salva modifiche</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <MatchCardTop m={m} loc={loc} numeroGara={m.numero_gara_fipav} amichevole={m.amichevole} nascondiRisultato={!giocata} />
                    </>
                  )}
                  {isEditingDetails ? null : isEditingRisultato ? (
                    <div className="field" style={{ marginTop: 10 }}>
                      <label>Risultato</label>
                      <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
                        Inserisci i punteggi dei set giocati (lascia vuoti quelli non giocati): il risultato finale si calcola da solo.
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 64px auto 64px', gap: '6px 8px', alignItems: 'center', justifyContent: 'start' }}>
                        <span />
                        <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'center' }}>{inCasa ? 'SSV' : 'Avv.'}</span>
                        <span />
                        <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap' }}>{inCasa ? 'Avv.' : 'SSV'}</span>
                        {risultatoForm.sets.map((s, i) => (
                          <Fragment key={i}>
                            <span className="muted" style={{ fontSize: 13, opacity: risultatoBloccati[i] ? 0.4 : 1 }}>Set {i + 1}</span>
                            {colonne.map((lato, k) => (
                              <Fragment key={lato}>
                                {k === 1 && <span>–</span>}
                                <input inputMode="numeric" style={{ width: 64, textAlign: 'center' }} value={s[lato]} disabled={risultatoBloccati[i]}
                                  aria-label={`Set ${i + 1}, punti ${lato === 'noi' ? 'SSV' : m.avversario}`}
                                  onChange={(e) => aggiornaSet(i, lato, e.target.value)} />
                              </Fragment>
                            ))}
                          </Fragment>
                        ))}
                      </div>
                      {risultatoDaParziali ? (
                        <div style={{ marginTop: 10, fontWeight: 700 }}>
                          Risultato finale: {inCasa
                            ? `SSV ${risultatoDaParziali.noi} – ${risultatoDaParziali.loro} ${m.avversario}`
                            : `${m.avversario} ${risultatoDaParziali.loro} – ${risultatoDaParziali.noi} SSV`}
                        </div>
                      ) : (
                        <div style={{ marginTop: 12 }}>
                          <div className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>Non hai i parziali? Inserisci solo i set vinti:</div>
                          <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13 }}>{inCasa ? 'SSV' : m.avversario}</span>
                            {colonne.map((lato, k) => (
                              <Fragment key={lato}>
                                {k === 1 && <span>–</span>}
                                <input inputMode="numeric" style={{ width: 52, textAlign: 'center' }} value={risultatoForm[lato]}
                                  aria-label={`Set vinti ${lato === 'noi' ? 'SSV' : m.avversario}`}
                                  onChange={(e) => setRisultatoForm({ ...risultatoForm, [lato]: e.target.value })} />
                              </Fragment>
                            ))}
                            <span style={{ fontSize: 13 }}>{inCasa ? m.avversario : 'SSV'}</span>
                          </div>
                        </div>
                      )}
                      <div className="settings-actions">
                        <button className="btn ghost" onClick={closeEditRisultato}>Annulla</button>
                        {hasRisultato(m) && (
                          <button className="btn ghost" onClick={() => setRisultatoForm({ sets: risultatoForm.sets.map(() => ({ noi: '', loro: '' })), noi: '', loro: '' })}>Svuota</button>
                        )}
                        <button className="btn" onClick={() => saveRisultato(m)}>Salva risultato</button>
                      </div>
                    </div>
                  ) : isEditingConvocati ? (
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
                    <div className="match-pannello">
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
                              state={presenze.includes(p.id) ? 'presente' : (m.assenti_confermati || []).includes(p.id) ? 'assente' : 'unset'}
                              ritardo={(m.ritardi || []).includes(p.id)}
                              motivo={(m.motivi_assenza || {})[p.id]}
                              onSetState={(state) => setAttendanceState(m, p.id, state)}
                              onToggleRitardo={(checked) => toggleRitardo(m, p.id, checked)}
                              onSetMotivo={(motivo) => setMotivoAssenza(m, p.id, motivo)}
                            />
                          ))}
                        </div>
                      )}
                      <div className="event-actions match-azioni">
                        <button className="btn ghost small" onClick={() => openEditRisultato(m)}>Risultato</button>
                        <button className="btn ghost small" onClick={() => openEditDetails(m)}>Modifica</button>
                        <button className="btn ghost small" onClick={() => openEditConvocati(m)}>Modifica convocati</button>
                        <button className="btn small" style={{ background: 'var(--rosso-scuro)' }} onClick={() => handleDelete(m.id)}>Elimina</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
