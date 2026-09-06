import { useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUi } from '../contexts/UiContext';
import { useDeletePlayer, useRoster, useSavePlayer, useUpsertManyPlayers } from '../hooks/useRoster';
import type { RosterPlayer } from '../types/database';
import { CategoriaTag } from '../components/ui/CategoriaTag';
import { fmtDateShort, isoToItalian, normalizeDateInput } from '../lib/dates';
import {
  csvEscape,
  downloadCSV,
  detectDelimiter,
  normalizeHeader,
  parseCSVLine,
  readCsvFile,
} from '../lib/csv';

const RUOLI = ['Palleggiatore', 'Opposto', 'Schiacciatore', 'Centrale', 'Libero', 'Universale'];

const CSV_HEADER_MAP: Record<string, string> = {
  nome: 'nome',
  cognome: 'cognome',
  numero: 'numero', nmaglia: 'numero', numeromaglia: 'numero', maglia: 'numero', n: 'numero',
  datadinascita: 'data_nascita', dinascita: 'data_nascita', nascita: 'data_nascita', datanascita: 'data_nascita',
  codicefiscale: 'codice_fiscale', cf: 'codice_fiscale', codfisc: 'codice_fiscale',
  ruolo: 'ruolo',
  telefono: 'telefono_papa', telefonogenitore: 'telefono_papa', contatto: 'telefono_papa',
  cellulareatleta: 'telefono_atleta', telefonoatleta: 'telefono_atleta', cellulare: 'telefono_atleta',
  nomepapa: 'nome_papa', padre: 'nome_papa',
  telefonopapa: 'telefono_papa', cellularepapa: 'telefono_papa', telpapa: 'telefono_papa',
  nomemamma: 'nome_mamma', madre: 'nome_mamma',
  telefonomamma: 'telefono_mamma', cellularemamma: 'telefono_mamma', telmamma: 'telefono_mamma',
  certificato: 'certificato', scadenzacertificato: 'certificato', scadenzacertificatomedico: 'certificato', certificatomedico: 'certificato',
};

const emptyForm = {
  nome: '', cognome: '', numero: '', data_nascita: '', codice_fiscale: '', ruolo: '',
  telefono_atleta: '', nome_papa: '', telefono_papa: '', nome_mamma: '', telefono_mamma: '', certificato: '',
};

function certStatus(p: RosterPlayer, today: Date, soon: Date): { label: string; warn: boolean } {
  if (!p.certificato) return { label: '—', warn: false };
  const label = fmtDateShort(p.certificato);
  const cd = new Date(p.certificato + 'T00:00:00');
  if (cd < today) return { label: `Scaduto — ${label}`, warn: true };
  if (cd < soon) return { label: `In scadenza — ${label}`, warn: true };
  return { label, warn: false };
}

export default function RosterPage() {
  const { isAdmin } = useAuth();
  const { showToast, confirm } = useUi();
  const { data: roster = [] } = useRoster();
  const savePlayer = useSavePlayer();
  const deletePlayer = useDeletePlayer();
  const upsertMany = useUpsertManyPlayers();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [viewingId, setViewingId] = useState<string | null>(null);

  function openForm(p?: RosterPlayer) {
    if (p) {
      setEditingId(p.id);
      setForm({
        nome: p.nome || '', cognome: p.cognome || '', numero: p.numero != null ? String(p.numero) : '',
        data_nascita: p.data_nascita || '', codice_fiscale: p.codice_fiscale || '', ruolo: p.ruolo || '',
        telefono_atleta: p.telefono_atleta || '', nome_papa: p.nome_papa || '', telefono_papa: p.telefono_papa || '',
        nome_mamma: p.nome_mamma || '', telefono_mamma: p.telefono_mamma || '', certificato: p.certificato || '',
      });
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
    if (!form.nome.trim() || !form.cognome.trim()) {
      showToast('Inserisci almeno nome e cognome');
      return;
    }
    const data = {
      nome: form.nome.trim(),
      cognome: form.cognome.trim(),
      numero: form.numero ? parseInt(form.numero, 10) : null,
      data_nascita: form.data_nascita || null,
      codice_fiscale: form.codice_fiscale.trim().toUpperCase() || null,
      ruolo: form.ruolo || null,
      telefono_atleta: form.telefono_atleta.trim() || null,
      nome_papa: form.nome_papa.trim() || null,
      telefono_papa: form.telefono_papa.trim() || null,
      nome_mamma: form.nome_mamma.trim() || null,
      telefono_mamma: form.telefono_mamma.trim() || null,
      certificato: form.certificato || null,
    };
    try {
      await savePlayer.mutateAsync({ id: editingId, data });
      closeForm();
      showToast('Giocatore salvato');
    } catch {
      showToast('Errore nel salvataggio del giocatore');
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm('Eliminare questo giocatore dalla rosa?');
    if (!ok) return;
    try {
      await deletePlayer.mutateAsync(id);
      if (viewingId === id) setViewingId(null);
      showToast('Giocatore eliminato');
    } catch {
      showToast('Errore nella cancellazione');
    }
  }

  function openDetail(id: string) {
    setViewingId(id);
  }

  function closeDetail() {
    setViewingId(null);
  }

  function editFromDetail(p: RosterPlayer) {
    setViewingId(null);
    openForm(p);
  }

  function downloadTemplate() {
    const headers = ['Nome', 'Cognome', 'Numero maglia', 'Data di nascita', 'Codice Fiscale', 'Ruolo', 'Cellulare atleta', 'Nome papà', 'Telefono papà', 'Nome mamma', 'Telefono mamma', 'Scadenza certificato medico'];
    const example = ['Mario', 'Rossi', '7', '15/03/2011', 'RSSMRA11C15B563X', 'Schiacciatore', '+39 333 9998877', 'Luca', '+39 333 1234567', 'Anna', '+39 333 7654321', '10/01/2027'];
    const csv = headers.join(';') + '\n' + example.map(csvEscape).join(';');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'modello_giocatori.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    if (roster.length === 0) { showToast('Nessun giocatore da esportare'); return; }
    const headers = ['Nome', 'Cognome', 'Numero maglia', 'Data di nascita', 'Codice Fiscale', 'Ruolo', 'Cellulare atleta', 'Nome papà', 'Telefono papà', 'Nome mamma', 'Telefono mamma', 'Scadenza certificato medico'];
    const rows = roster.map((p) => [
      p.nome || '', p.cognome || '', p.numero ?? '', isoToItalian(p.data_nascita), p.codice_fiscale || '', p.ruolo || '',
      p.telefono_atleta || '', p.nome_papa || '', p.telefono_papa || '', p.nome_mamma || '', p.telefono_mamma || '',
      isoToItalian(p.certificato),
    ]);
    downloadCSV('rosa_export.csv', headers, rows);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readCsvFile(file);
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) { showToast('Il file CSV sembra vuoto'); e.target.value = ''; return; }
    const delim = detectDelimiter(lines[0]);
    const headers = parseCSVLine(lines[0], delim).map(normalizeHeader);
    const fieldMap = headers.map((h) => CSV_HEADER_MAP[h] || null);

    if (!fieldMap.includes('nome') || !fieldMap.includes('cognome')) {
      showToast('Il CSV deve avere almeno le colonne Nome e Cognome');
      e.target.value = '';
      return;
    }

    const rowsToUpsert: Partial<RosterPlayer>[] = [];
    let added = 0, updated = 0, skipped = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i], delim);
      const rec: Record<string, string> = {};
      fieldMap.forEach((field, idx) => { if (field) rec[field] = (cols[idx] || '').trim(); });
      const nome = rec.nome || '';
      const cognome = rec.cognome || '';
      if (!nome || !cognome) { skipped++; continue; }
      const numeroInt = rec.numero ? parseInt(rec.numero, 10) : NaN;
      const codiceFiscale = (rec.codice_fiscale || '').toUpperCase();
      const playerData: Partial<RosterPlayer> = {
        nome, cognome,
        numero: Number.isFinite(numeroInt) ? numeroInt : null,
        data_nascita: normalizeDateInput(rec.data_nascita) || null,
        codice_fiscale: codiceFiscale || null,
        ruolo: rec.ruolo || null,
        telefono_atleta: rec.telefono_atleta || null,
        nome_papa: rec.nome_papa || null,
        telefono_papa: rec.telefono_papa || null,
        nome_mamma: rec.nome_mamma || null,
        telefono_mamma: rec.telefono_mamma || null,
        certificato: normalizeDateInput(rec.certificato) || null,
      };
      const existing = codiceFiscale ? roster.find((p) => p.codice_fiscale && p.codice_fiscale === codiceFiscale) : null;
      if (existing) {
        rowsToUpsert.push({ id: existing.id, ...playerData });
        updated++;
      } else {
        rowsToUpsert.push(playerData);
        added++;
      }
    }
    try {
      await upsertMany.mutateAsync(rowsToUpsert);
      const skippedMsg = skipped ? `, ${skipped} righe saltate` : '';
      showToast(`Import completato: ${added} aggiunti, ${updated} aggiornati${skippedMsg}`);
    } catch {
      showToast('Errore durante l\'importazione');
    }
    e.target.value = '';
  }

  const players = [...roster].sort((a, b) => (a.numero ?? 99) - (b.numero ?? 99) || a.cognome.localeCompare(b.cognome));
  const today = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const viewingPlayer = players.find((p) => p.id === viewingId) || null;

  return (
    <section>
      {isAdmin && (
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost small" onClick={downloadTemplate}>Scarica modello CSV</button>
            <button className="btn ghost small" onClick={() => fileInputRef.current?.click()}>Importa da CSV</button>
            <button className="btn ghost small" onClick={exportCSV}>Esporta CSV (backup)</button>
            <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
          </div>
          <button className="btn" onClick={() => openForm()}>+ Aggiungi giocatore</button>
        </div>
      )}

      {!isAdmin && (
        <div className="card" style={{ fontSize: 13, color: 'var(--inchiostro-soft)' }}>
          Rosa in sola lettura. Per modificarla contatta un amministratore.
        </div>
      )}

      {formOpen && isAdmin && (
        <div className="card">
          <h3>{editingId ? 'Modifica giocatore' : 'Nuovo giocatore'}</h3>
          <div className="row">
            <div className="field"><label>Nome</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="field"><label>Cognome</label><input value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} /></div>
            <div className="field"><label>N. maglia</label><input type="number" min={0} max={99} style={{ width: 80 }} value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <div className="field"><label>Data di nascita</label><input type="date" value={form.data_nascita} onChange={(e) => setForm({ ...form, data_nascita: e.target.value })} /></div>
            <div className="field"><label>Codice fiscale</label><input style={{ width: 220, textTransform: 'uppercase' }} value={form.codice_fiscale} onChange={(e) => setForm({ ...form, codice_fiscale: e.target.value })} /></div>
            <div className="field">
              <label>Ruolo</label>
              <select style={{ width: 170 }} value={form.ruolo} onChange={(e) => setForm({ ...form, ruolo: e.target.value })}>
                <option value="">— nessuno —</option>
                {RUOLI.map((r) => <option key={r} value={r}>{r === 'Schiacciatore' ? 'Schiacciatore (banda)' : r}</option>)}
              </select>
            </div>
            <div className="field"><label>Cellulare atleta</label><input style={{ width: 150 }} value={form.telefono_atleta} onChange={(e) => setForm({ ...form, telefono_atleta: e.target.value })} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <div className="field"><label>Nome papà</label><input style={{ width: 150 }} value={form.nome_papa} onChange={(e) => setForm({ ...form, nome_papa: e.target.value })} /></div>
            <div className="field"><label>Telefono papà</label><input style={{ width: 150 }} value={form.telefono_papa} onChange={(e) => setForm({ ...form, telefono_papa: e.target.value })} /></div>
            <div className="field"><label>Nome mamma</label><input style={{ width: 150 }} value={form.nome_mamma} onChange={(e) => setForm({ ...form, nome_mamma: e.target.value })} /></div>
            <div className="field"><label>Telefono mamma</label><input style={{ width: 150 }} value={form.telefono_mamma} onChange={(e) => setForm({ ...form, telefono_mamma: e.target.value })} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <div className="field"><label>Scadenza certificato medico</label><input type="date" value={form.certificato} onChange={(e) => setForm({ ...form, certificato: e.target.value })} /></div>
          </div>
          <div className="settings-actions">
            <button className="btn ghost" onClick={closeForm}>Annulla</button>
            <button className="btn" onClick={handleSave}>Salva</button>
          </div>
        </div>
      )}

      {players.length === 0 ? (
        <div className="empty">Nessun giocatore in rosa.</div>
      ) : (
        <div className="roster-list">
          {players.map((p) => {
            const cert = certStatus(p, today, soon);
            return (
              <button className="roster-row" key={p.id} onClick={() => openDetail(p.id)}>
                <span className="num-badge">{p.numero ?? '–'}</span>
                <span className="roster-row-name">{p.cognome} {p.nome}</span>
                {cert.warn && <span className="cert-warn roster-row-cert">{cert.label}</span>}
                <CategoriaTag dataNascita={p.data_nascita} />
                <span className="roster-row-chevron">›</span>
              </button>
            );
          })}
        </div>
      )}

      {viewingPlayer && (
        <div className="settings-modal open" onClick={closeDetail}>
          <div className="settings-box" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="num-badge">{viewingPlayer.numero ?? '–'}</span>
                {viewingPlayer.cognome} {viewingPlayer.nome}
                <CategoriaTag dataNascita={viewingPlayer.data_nascita} />
              </h3>
            </div>
            <dl className="detail-list">
              <div><dt>Ruolo</dt><dd>{viewingPlayer.ruolo || '—'}</dd></div>
              <div><dt>Data di nascita</dt><dd>{viewingPlayer.data_nascita ? fmtDateShort(viewingPlayer.data_nascita) : '—'}</dd></div>
              <div><dt>Codice fiscale</dt><dd>{viewingPlayer.codice_fiscale || '—'}</dd></div>
              <div>
                <dt>Certificato medico</dt>
                <dd className={certStatus(viewingPlayer, today, soon).warn ? 'cert-warn' : ''}>
                  {certStatus(viewingPlayer, today, soon).label}
                </dd>
              </div>
              <div><dt>Cellulare atleta</dt><dd>{viewingPlayer.telefono_atleta || '—'}</dd></div>
              <div><dt>Papà</dt><dd>{viewingPlayer.nome_papa || viewingPlayer.telefono_papa ? `${viewingPlayer.nome_papa || ''}${viewingPlayer.nome_papa && viewingPlayer.telefono_papa ? ' · ' : ''}${viewingPlayer.telefono_papa || ''}` : '—'}</dd></div>
              <div><dt>Mamma</dt><dd>{viewingPlayer.nome_mamma || viewingPlayer.telefono_mamma ? `${viewingPlayer.nome_mamma || ''}${viewingPlayer.nome_mamma && viewingPlayer.telefono_mamma ? ' · ' : ''}${viewingPlayer.telefono_mamma || ''}` : '—'}</dd></div>
            </dl>
            <div className="detail-actions">
              <button className="btn ghost" onClick={closeDetail}>Chiudi</button>
              {isAdmin && (
                <>
                  <button className="btn ghost" onClick={() => editFromDetail(viewingPlayer)}>Modifica</button>
                  <button className="btn" style={{ background: 'var(--rosso-scuro)' }} onClick={() => handleDelete(viewingPlayer.id)}>Elimina</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
