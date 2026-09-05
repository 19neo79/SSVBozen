import { useState } from 'react';
import { useUi } from '../contexts/UiContext';
import {
  useAvversari,
  useDeleteAvversario,
  useDeleteCampo,
  useSaveAvversario,
  useSaveCampo,
} from '../hooks/useAvversari';
import type { AvversarioConCampi, CampoAvversario, Categoria } from '../types/database';

const emptyOpponentForm = { nome: '', categoria: 'U14' as Categoria };
const emptyCampoForm = { nome: '', indirizzo: '', cap: '', citta: '', provincia: '' };

export default function OpponentsPage() {
  const { showToast, confirm } = useUi();
  const { data: avversari = [] } = useAvversari();
  const saveAvversario = useSaveAvversario();
  const deleteAvversario = useDeleteAvversario();
  const saveCampo = useSaveCampo();
  const deleteCampo = useDeleteCampo();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyOpponentForm);

  const [campiManagerFor, setCampiManagerFor] = useState<string | null>(null);
  const [editingCampoId, setEditingCampoId] = useState<string | null>(null);
  const [campoForm, setCampoForm] = useState(emptyCampoForm);

  function openForm(o?: AvversarioConCampi) {
    setCampiManagerFor(null);
    if (o) {
      setEditingId(o.id);
      setForm({ nome: o.nome, categoria: o.categoria });
    } else {
      setEditingId(null);
      setForm(emptyOpponentForm);
    }
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  async function handleSave() {
    if (!form.nome.trim()) { showToast('Inserisci il nome della squadra avversaria'); return; }
    try {
      await saveAvversario.mutateAsync({ id: editingId, nome: form.nome.trim(), categoria: form.categoria });
      closeForm();
      showToast('Avversario salvato');
    } catch {
      showToast('Errore nel salvataggio');
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm('Eliminare questo avversario e tutti i suoi campi da gioco? Le partite che lo usano mostreranno solo il nome salvato.');
    if (!ok) return;
    try {
      await deleteAvversario.mutateAsync(id);
      showToast('Avversario eliminato');
    } catch {
      showToast('Errore nella cancellazione');
    }
  }

  function manageCampi(opponentId: string) {
    setFormOpen(false);
    setCampiManagerFor(opponentId);
    setEditingCampoId(null);
    setCampoForm(emptyCampoForm);
  }

  function closeCampiManager() {
    setCampiManagerFor(null);
    setEditingCampoId(null);
  }

  function editCampo(c: CampoAvversario) {
    setEditingCampoId(c.id);
    setCampoForm({ nome: c.nome, indirizzo: c.indirizzo || '', cap: c.cap || '', citta: c.citta || '', provincia: c.provincia || '' });
  }

  async function handleSaveCampo() {
    if (!campiManagerFor) return;
    if (!campoForm.nome.trim()) { showToast('Inserisci il nome del campo'); return; }
    const data = {
      nome: campoForm.nome.trim(),
      indirizzo: campoForm.indirizzo.trim() || null,
      cap: campoForm.cap.trim() || null,
      citta: campoForm.citta.trim() || null,
      provincia: campoForm.provincia.trim() || null,
    };
    try {
      await saveCampo.mutateAsync({ id: editingCampoId, avversario_id: campiManagerFor, data });
      setEditingCampoId(null);
      setCampoForm(emptyCampoForm);
      showToast('Campo salvato');
    } catch {
      showToast('Errore nel salvataggio del campo');
    }
  }

  async function handleDeleteCampo(id: string) {
    const ok = await confirm('Eliminare questo campo da gioco?');
    if (!ok) return;
    try {
      await deleteCampo.mutateAsync(id);
      if (editingCampoId === id) { setEditingCampoId(null); setCampoForm(emptyCampoForm); }
      showToast('Campo eliminato');
    } catch {
      showToast('Errore nella cancellazione');
    }
  }

  const sorted = [...avversari].sort((a, b) =>
    a.categoria === b.categoria ? a.nome.localeCompare(b.nome) : a.categoria.localeCompare(b.categoria)
  );
  const managing = avversari.find((o) => o.id === campiManagerFor);

  return (
    <section>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>Avversari campionato</h3>
          <button className="btn" onClick={() => openForm()}>+ Aggiungi avversario</button>
        </div>
      </div>

      {formOpen && (
        <div className="card">
          <h3>{editingId ? 'Modifica avversario' : 'Nuovo avversario'}</h3>
          <div className="row">
            <div className="field"><label>Nome squadra</label><input style={{ width: 220 }} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="field">
              <label>Categoria</label>
              <select style={{ width: 130 }} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value as Categoria })}>
                <option value="U14">Under 14</option>
                <option value="U15">Under 15</option>
              </select>
            </div>
          </div>
          <div className="settings-actions">
            <button className="btn ghost" onClick={closeForm}>Annulla</button>
            <button className="btn" onClick={handleSave}>Salva</button>
          </div>
        </div>
      )}

      {managing && (
        <div className="card">
          <h3>Campi da gioco — {managing.nome}</h3>
          {(managing.campi || []).length === 0 ? (
            <div className="empty">Nessun campo inserito per questo avversario.</div>
          ) : (
            <div className="event-list">
              {managing.campi.map((c) => (
                <div className="event" key={c.id}>
                  <div className="event-main">
                    <div className="event-date">{c.nome}</div>
                    <div className="event-detail">
                      {[c.indirizzo, c.cap, c.citta, c.provincia].filter(Boolean).join(', ') || <span className="muted">nessun indirizzo</span>}
                    </div>
                  </div>
                  <div className="event-actions">
                    <button className="btn ghost small" onClick={() => editCampo(c)}>Modifica</button>
                    <button className="btn small" style={{ background: 'var(--rosso-scuro)' }} onClick={() => handleDeleteCampo(c.id)}>Elimina</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <div className="field"><label>Nome campo</label><input style={{ width: 160 }} value={campoForm.nome} onChange={(e) => setCampoForm({ ...campoForm, nome: e.target.value })} /></div>
            <div className="field"><label>Indirizzo</label><input style={{ width: 180 }} value={campoForm.indirizzo} onChange={(e) => setCampoForm({ ...campoForm, indirizzo: e.target.value })} /></div>
            <div className="field"><label>CAP</label><input style={{ width: 80 }} value={campoForm.cap} onChange={(e) => setCampoForm({ ...campoForm, cap: e.target.value })} /></div>
            <div className="field"><label>Città</label><input style={{ width: 140 }} value={campoForm.citta} onChange={(e) => setCampoForm({ ...campoForm, citta: e.target.value })} /></div>
            <div className="field"><label>Provincia</label><input style={{ width: 80 }} value={campoForm.provincia} onChange={(e) => setCampoForm({ ...campoForm, provincia: e.target.value })} /></div>
          </div>
          <div className="settings-actions">
            <button className="btn ghost" onClick={closeCampiManager}>Chiudi</button>
            <button className="btn" onClick={handleSaveCampo}>{editingCampoId ? 'Aggiorna campo' : '+ Aggiungi campo'}</button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="empty">Nessun avversario inserito — aggiungine uno con il pulsante qui sopra.</div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead><tr><th>Nome</th><th>Categoria</th><th>Campi da gioco</th><th></th></tr></thead>
            <tbody>
              {sorted.map((o) => (
                <tr key={o.id}>
                  <td>{o.nome}</td>
                  <td style={{ textAlign: 'center' }}>{o.categoria}</td>
                  <td>{(o.campi || []).length === 0 ? <span className="muted">nessuno inserito</span> : o.campi.map((c) => c.nome).join(', ')}</td>
                  <td>
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                      <button className="btn ghost small" onClick={() => manageCampi(o.id)}>Campi</button>
                      <button className="btn ghost small" onClick={() => openForm(o)}>Modifica</button>
                      <button className="btn small" style={{ background: 'var(--rosso-scuro)' }} onClick={() => handleDelete(o.id)}>Elimina</button>
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
