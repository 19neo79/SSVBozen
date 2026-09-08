import { useRef, useState } from 'react';
import { useUi } from '../contexts/UiContext';
import { useDeleteVenue, useSaveVenue, useUpsertManyVenues, useVenues } from '../hooks/useVenues';
import { useAvversari } from '../hooks/useAvversari';
import type { Venue } from '../types/database';
import { mapsUrlForVenue } from '../lib/location';
import { detectDelimiter, normalizeHeader, parseCSVLine, downloadCSV, readCsvFile } from '../lib/csv';

const VENUE_HEADER_MAP: Record<string, string> = {
  nome: 'nome', nomepalestra: 'nome',
  indirizzo: 'indirizzo', via: 'indirizzo', indirizzocompleto: 'indirizzo',
  cap: 'cap', codicepostale: 'cap',
  citta: 'citta',
  provincia: 'provincia', prov: 'provincia',
};

const emptyForm = { nome: '', indirizzo: '', cap: '', citta: '', provincia: '' };

export default function VenuesPage() {
  const { showToast, confirm } = useUi();
  const { data: venues = [] } = useVenues();
  const { data: avversari = [] } = useAvversari();
  const saveVenue = useSaveVenue();
  const deleteVenue = useDeleteVenue();
  const upsertMany = useUpsertManyVenues();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  function openForm(v?: Venue) {
    if (v) {
      setEditingId(v.id);
      setForm({ nome: v.nome, indirizzo: v.indirizzo || '', cap: v.cap || '', citta: v.citta || '', provincia: v.provincia || '' });
    } else {
      setEditingId(null);
      setForm(emptyForm);
    }
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  async function handleSave() {
    if (!form.nome.trim()) { showToast('Inserisci almeno il nome della palestra'); return; }
    const data = {
      nome: form.nome.trim(),
      indirizzo: form.indirizzo.trim() || null,
      cap: form.cap.trim() || null,
      citta: form.citta.trim() || null,
      provincia: form.provincia.trim().toUpperCase() || null,
    };
    try {
      await saveVenue.mutateAsync({ id: editingId, data });
      closeForm();
      showToast('Palestra salvata');
    } catch {
      showToast('Errore nel salvataggio');
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm('Eliminare questa palestra? Gli allenamenti/partite che la usano mostreranno solo il nome salvato.');
    if (!ok) return;
    try {
      await deleteVenue.mutateAsync(id);
      showToast('Palestra eliminata');
    } catch {
      showToast('Errore nella cancellazione');
    }
  }

  function downloadTemplate() {
    const headers = ['Nome palestra', 'Indirizzo', 'CAP', 'Città', 'Provincia'];
    const example = ['Palestra Firmian', 'Via Palermo 54', '39100', 'Bolzano', 'BZ'];
    const csv = headers.join(';') + '\n' + example.join(';');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'modello_palestre.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    const ownVenues = venues.filter((v) => !v.avversario_id);
    if (ownVenues.length === 0) { showToast('Nessuna palestra da esportare'); return; }
    const headers = ['Nome palestra', 'Indirizzo', 'CAP', 'Città', 'Provincia'];
    const rows = ownVenues.map((v) => [v.nome || '', v.indirizzo || '', v.cap || '', v.citta || '', v.provincia || '']);
    downloadCSV('palestre_export.csv', headers, rows);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readCsvFile(file);
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) { showToast('Il file CSV sembra vuoto'); e.target.value = ''; return; }
    const delim = detectDelimiter(lines[0]);
    const headers = parseCSVLine(lines[0], delim).map(normalizeHeader);
    const fieldMap = headers.map((h) => VENUE_HEADER_MAP[h] || null);
    if (!fieldMap.includes('nome')) { showToast('Il CSV deve avere almeno la colonna Nome palestra'); e.target.value = ''; return; }

    const rows: Partial<Venue>[] = [];
    let added = 0, updated = 0, skipped = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i], delim);
      const rec: Record<string, string> = {};
      fieldMap.forEach((field, idx) => { if (field) rec[field] = (cols[idx] || '').trim(); });
      if (!rec.nome) { skipped++; continue; }
      const data: Partial<Venue> = {
        nome: rec.nome, indirizzo: rec.indirizzo || null, cap: rec.cap || null,
        citta: rec.citta || null, provincia: (rec.provincia || '').toUpperCase() || null,
      };
      const existing = venues.find((v) => !v.avversario_id && v.nome.trim().toLowerCase() === rec.nome.trim().toLowerCase());
      if (existing) { rows.push({ id: existing.id, ...data }); updated++; }
      else { rows.push(data); added++; }
    }
    try {
      await upsertMany.mutateAsync(rows);
      const skippedMsg = skipped ? `, ${skipped} righe saltate` : '';
      showToast(`Import completato: ${added} aggiunte, ${updated} aggiornate${skippedMsg}`);
    } catch {
      showToast('Errore durante l\'importazione');
    }
    e.target.value = '';
  }

  const avversarioNome = (id: string | null) => (id ? avversari.find((o) => o.id === id)?.nome || null : null);
  const sorted = [...venues].sort((a, b) => {
    if (!a.avversario_id !== !b.avversario_id) return a.avversario_id ? 1 : -1;
    const an = avversarioNome(a.avversario_id) || '';
    const bn = avversarioNome(b.avversario_id) || '';
    if (an !== bn) return an.localeCompare(bn);
    return a.nome.localeCompare(b.nome);
  });

  return (
    <section>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost small" onClick={downloadTemplate}>Scarica modello CSV</button>
          <button className="btn ghost small" onClick={() => fileInputRef.current?.click()}>Importa da CSV</button>
          <button className="btn ghost small" onClick={exportCSV}>Esporta CSV (backup)</button>
          <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
        </div>
        <button className="btn" onClick={() => openForm()}>+ Aggiungi palestra</button>
      </div>

      {formOpen && (
        <div className="card">
          <h3>{editingId ? 'Modifica palestra' : 'Nuova palestra'}</h3>
          <div className="row">
            <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Nome palestra</label><input style={{ width: '100%' }} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <div className="field" style={{ flex: 2, minWidth: 220 }}><label>Indirizzo</label><input style={{ width: '100%' }} placeholder="Via, numero civico" value={form.indirizzo} onChange={(e) => setForm({ ...form, indirizzo: e.target.value })} /></div>
            <div className="field"><label>CAP</label><input style={{ width: 100 }} value={form.cap} onChange={(e) => setForm({ ...form, cap: e.target.value })} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <div className="field"><label>Città</label><input style={{ width: 200 }} value={form.citta} onChange={(e) => setForm({ ...form, citta: e.target.value })} /></div>
            <div className="field"><label>Provincia</label><input style={{ width: 70, textTransform: 'uppercase' }} maxLength={2} value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} /></div>
          </div>
          <div className="settings-actions">
            <button className="btn ghost" onClick={closeForm}>Annulla</button>
            <button className="btn" onClick={handleSave}>Salva</button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="empty">Nessuna palestra inserita — aggiungine una con il pulsante qui sopra.</div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead><tr><th>Nome</th><th>Indirizzo</th><th>Città</th><th>Avversario</th><th></th></tr></thead>
            <tbody>
              {sorted.map((v) => (
                <tr key={v.id}>
                  <td>{v.nome}</td>
                  <td className="muted">{v.indirizzo || '—'}</td>
                  <td className="muted">{[v.cap, v.citta, v.provincia].filter(Boolean).join(' ') || '—'}</td>
                  <td className="muted">{avversarioNome(v.avversario_id) || '—'}</td>
                  <td>
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                      <a href={mapsUrlForVenue(v)} target="_blank" rel="noopener noreferrer" className="btn ghost small">Maps</a>
                      <button className="btn ghost small" onClick={() => openForm(v)}>Modifica</button>
                      <button className="btn small" style={{ background: 'var(--rosso-scuro)' }} onClick={() => handleDelete(v.id)}>Elimina</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
