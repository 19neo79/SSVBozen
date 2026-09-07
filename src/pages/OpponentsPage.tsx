import { useState } from 'react';
import { useUi } from '../contexts/UiContext';
import { useAvversari, useDeleteAvversario, useSaveAvversario } from '../hooks/useAvversari';
import { useDeleteVenue, useSaveVenue, useVenues } from '../hooks/useVenues';
import { mapsUrlForVenue } from '../lib/location';
import type { Avversario, Categoria, Venue } from '../types/database';

const emptyOpponentForm = {
  nome: '', categoria: 'U14' as Categoria,
  responsabile: '', telefono_responsabile: '', email_responsabile: '',
};
const emptyVenueForm = { nome: '', indirizzo: '', cap: '', citta: '', provincia: '' };

export default function OpponentsPage() {
  const { showToast, confirm } = useUi();
  const { data: avversari = [] } = useAvversari();
  const { data: venues = [] } = useVenues();
  const saveAvversario = useSaveAvversario();
  const deleteAvversario = useDeleteAvversario();
  const saveVenue = useSaveVenue();
  const deleteVenue = useDeleteVenue();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyOpponentForm);

  const [managingFor, setManagingFor] = useState<string | null>(null);
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);
  const [venueForm, setVenueForm] = useState(emptyVenueForm);

  function opponentVenues(opponentId: string): Venue[] {
    return venues.filter((v) => v.avversario_id === opponentId);
  }

  function openForm(o?: Avversario) {
    setManagingFor(null);
    if (o) {
      setEditingId(o.id);
      setForm({
        nome: o.nome, categoria: o.categoria,
        responsabile: o.responsabile || '', telefono_responsabile: o.telefono_responsabile || '', email_responsabile: o.email_responsabile || '',
      });
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
      await saveAvversario.mutateAsync({
        id: editingId,
        nome: form.nome.trim(),
        categoria: form.categoria,
        responsabile: form.responsabile.trim() || null,
        telefono_responsabile: form.telefono_responsabile.trim() || null,
        email_responsabile: form.email_responsabile.trim() || null,
      });
      closeForm();
      showToast('Avversario salvato');
    } catch {
      showToast('Errore nel salvataggio');
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm('Eliminare questo avversario e tutte le sue palestre? Le partite che lo usano mostreranno solo il nome salvato.');
    if (!ok) return;
    try {
      await deleteAvversario.mutateAsync(id);
      showToast('Avversario eliminato');
    } catch {
      showToast('Errore nella cancellazione');
    }
  }

  function manageVenues(opponentId: string) {
    setFormOpen(false);
    setManagingFor(opponentId);
    setEditingVenueId(null);
    setVenueForm(emptyVenueForm);
  }

  function closeVenueManager() {
    setManagingFor(null);
    setEditingVenueId(null);
  }

  function editVenue(v: Venue) {
    setEditingVenueId(v.id);
    setVenueForm({ nome: v.nome, indirizzo: v.indirizzo || '', cap: v.cap || '', citta: v.citta || '', provincia: v.provincia || '' });
  }

  async function handleSaveVenue() {
    if (!managingFor) return;
    if (!venueForm.nome.trim()) { showToast('Inserisci il nome della palestra'); return; }
    const data = {
      nome: venueForm.nome.trim(),
      indirizzo: venueForm.indirizzo.trim() || null,
      cap: venueForm.cap.trim() || null,
      citta: venueForm.citta.trim() || null,
      provincia: venueForm.provincia.trim().toUpperCase() || null,
      avversario_id: managingFor,
    };
    try {
      await saveVenue.mutateAsync({ id: editingVenueId, data });
      setEditingVenueId(null);
      setVenueForm(emptyVenueForm);
      showToast('Palestra salvata');
    } catch {
      showToast('Errore nel salvataggio della palestra');
    }
  }

  async function handleDeleteVenue(id: string) {
    const ok = await confirm('Eliminare questa palestra?');
    if (!ok) return;
    try {
      await deleteVenue.mutateAsync(id);
      if (editingVenueId === id) { setEditingVenueId(null); setVenueForm(emptyVenueForm); }
      showToast('Palestra eliminata');
    } catch {
      showToast('Errore nella cancellazione');
    }
  }

  const sorted = [...avversari].sort((a, b) =>
    a.categoria === b.categoria ? a.nome.localeCompare(b.nome) : a.categoria.localeCompare(b.categoria)
  );
  const managing = avversari.find((o) => o.id === managingFor);
  const managingVenuesList = managingFor ? opponentVenues(managingFor) : [];

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
          <div className="row" style={{ marginTop: 12 }}>
            <div className="field"><label>Referente</label><input style={{ width: 180 }} value={form.responsabile} onChange={(e) => setForm({ ...form, responsabile: e.target.value })} /></div>
            <div className="field"><label>Cellulare</label><input style={{ width: 160 }} value={form.telefono_responsabile} onChange={(e) => setForm({ ...form, telefono_responsabile: e.target.value })} /></div>
            <div className="field"><label>Email</label><input type="email" style={{ width: 220 }} value={form.email_responsabile} onChange={(e) => setForm({ ...form, email_responsabile: e.target.value })} /></div>
          </div>
          <div className="settings-actions">
            <button className="btn ghost" onClick={closeForm}>Annulla</button>
            <button className="btn" onClick={handleSave}>Salva</button>
          </div>
        </div>
      )}

      {managing && (
        <div className="card">
          <h3>Palestre — {managing.nome}</h3>
          {managingVenuesList.length === 0 ? (
            <div className="empty">Nessuna palestra inserita per questo avversario.</div>
          ) : (
            <div className="event-list">
              {managingVenuesList.map((v) => (
                <div className="event" key={v.id}>
                  <div className="event-main">
                    <div className="event-date">{v.nome}</div>
                    <div className="event-detail">
                      {[v.indirizzo, v.cap, v.citta, v.provincia].filter(Boolean).join(', ') || <span className="muted">nessun indirizzo</span>}
                    </div>
                  </div>
                  <div className="event-actions">
                    <a className="btn ghost small" href={mapsUrlForVenue(v)} target="_blank" rel="noopener noreferrer">Apri in Maps</a>
                    <button className="btn ghost small" onClick={() => editVenue(v)}>Modifica</button>
                    <button className="btn small" style={{ background: 'var(--rosso-scuro)' }} onClick={() => handleDeleteVenue(v.id)}>Elimina</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <div className="field"><label>Nome palestra</label><input style={{ width: 180 }} value={venueForm.nome} onChange={(e) => setVenueForm({ ...venueForm, nome: e.target.value })} /></div>
            <div className="field"><label>Indirizzo</label><input style={{ width: 200 }} value={venueForm.indirizzo} onChange={(e) => setVenueForm({ ...venueForm, indirizzo: e.target.value })} /></div>
            <div className="field"><label>CAP</label><input style={{ width: 90 }} value={venueForm.cap} onChange={(e) => setVenueForm({ ...venueForm, cap: e.target.value })} /></div>
            <div className="field"><label>Città</label><input style={{ width: 150 }} value={venueForm.citta} onChange={(e) => setVenueForm({ ...venueForm, citta: e.target.value })} /></div>
            <div className="field"><label>Provincia</label><input style={{ width: 80 }} maxLength={2} value={venueForm.provincia} onChange={(e) => setVenueForm({ ...venueForm, provincia: e.target.value })} /></div>
          </div>
          <div className="settings-actions">
            <button className="btn ghost" onClick={closeVenueManager}>Chiudi</button>
            <button className="btn" onClick={handleSaveVenue}>{editingVenueId ? 'Aggiorna palestra' : '+ Aggiungi palestra'}</button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="empty">Nessun avversario inserito — aggiungine uno con il pulsante qui sopra.</div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead><tr><th>Nome</th><th>Categoria</th><th>Referente</th><th>Palestre</th><th></th></tr></thead>
            <tbody>
              {sorted.map((o) => {
                const ownVenues = opponentVenues(o.id);
                const hasReferente = o.responsabile || o.telefono_responsabile || o.email_responsabile;
                return (
                  <tr key={o.id}>
                    <td>{o.nome}</td>
                    <td style={{ textAlign: 'center' }}>{o.categoria}</td>
                    <td>
                      {hasReferente ? (
                        <>
                          {o.responsabile && <div>{o.responsabile}</div>}
                          <div className="muted" style={{ fontSize: 12.5 }}>
                            {o.telefono_responsabile && <a href={`tel:${o.telefono_responsabile}`}>{o.telefono_responsabile}</a>}
                            {o.telefono_responsabile && o.email_responsabile && ' · '}
                            {o.email_responsabile && <a href={`mailto:${o.email_responsabile}`}>{o.email_responsabile}</a>}
                          </div>
                        </>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td>{ownVenues.length === 0 ? <span className="muted">nessuna inserita</span> : ownVenues.map((v) => v.nome).join(', ')}</td>
                    <td>
                      <div className="row" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        <button className="btn ghost small" onClick={() => manageVenues(o.id)}>Palestre</button>
                        <button className="btn ghost small" onClick={() => openForm(o)}>Modifica</button>
                        <button className="btn small" style={{ background: 'var(--rosso-scuro)' }} onClick={() => handleDelete(o.id)}>Elimina</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
