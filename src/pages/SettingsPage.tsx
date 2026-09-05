import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUi } from '../contexts/UiContext';
import { useAuth } from '../contexts/AuthContext';
import { useSettings, useUpdateSettings } from '../hooks/useSettings';
import { useProfiles, useUpdateProfileRole } from '../hooks/useProfiles';
import { supabase } from '../lib/supabase';
import type { Ruolo } from '../types/database';

const emptyNewUser = { nome: '', email: '', password: '', ruolo: 'allenatore' as Ruolo };

function resizeImageToDataUrl(file: File, maxSize = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('canvas non disponibile')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function SettingsPage() {
  const { showToast, confirm } = useUi();
  const { session } = useAuth();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const { data: profiles = [] } = useProfiles();
  const updateRole = useUpdateProfileRole();
  const qc = useQueryClient();

  const [clubName, setClubName] = useState('');
  const [pendingLogo, setPendingLogo] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const [newUserFormOpen, setNewUserFormOpen] = useState(false);
  const [newUser, setNewUser] = useState(emptyNewUser);
  const [creatingUser, setCreatingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (settings) setClubName(settings.club_name || '');
  }, [settings]);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setPendingLogo(dataUrl);
    } catch {
      showToast('Impossibile leggere l\'immagine');
    }
  }

  async function handleSave() {
    try {
      const data: { club_name: string; logo_url?: string } = { club_name: clubName.trim() || 'SSV Bozen Volley' };
      if (pendingLogo) data.logo_url = pendingLogo;
      await updateSettings.mutateAsync(data);
      setPendingLogo(null);

      if (newPassword) {
        if (newPassword.length < 6) {
          showToast('La password deve avere almeno 6 caratteri — non modificata');
        } else {
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          if (error) showToast('Errore nel cambio password: ' + error.message);
          setNewPassword('');
        }
      }
      showToast('Impostazioni salvate');
    } catch {
      showToast('Errore nel salvataggio delle impostazioni');
    }
  }

  async function handleRoleChange(id: string, nome: string | null, ruolo: Ruolo) {
    const ok = await confirm(
      `Cambiare il ruolo di ${nome || 'questo utente'} in "${ruolo === 'admin' ? 'Admin' : 'Allenatore'}"?`
    );
    if (!ok) return;
    try {
      await updateRole.mutateAsync({ id, ruolo });
      showToast('Ruolo aggiornato');
    } catch {
      showToast('Errore nell\'aggiornamento del ruolo');
    }
  }

  async function handleCreateUser() {
    if (!newUser.email.trim() || !newUser.email.includes('@')) {
      showToast('Inserisci un\'email valida');
      return;
    }
    if (newUser.password.length < 6) {
      showToast('La password deve avere almeno 6 caratteri');
      return;
    }
    setCreatingUser(true);
    try {
      const res = await fetch('/.netlify/functions/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(newUser),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Errore sconosciuto');
      await qc.invalidateQueries({ queryKey: ['profiles'] });
      setNewUser(emptyNewUser);
      setNewUserFormOpen(false);
      showToast('Utente creato');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Errore nella creazione dell\'utente');
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleDeleteUser(id: string, nome: string | null, email: string | null) {
    const ok = await confirm(
      `Eliminare definitivamente l'utente ${nome || email || 'selezionato'}? Non potrà più accedere all'app. L'azione non è reversibile.`
    );
    if (!ok) return;
    setDeletingUserId(id);
    try {
      const res = await fetch('/.netlify/functions/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Errore sconosciuto');
      await qc.invalidateQueries({ queryKey: ['profiles'] });
      showToast('Utente eliminato');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Errore nell\'eliminazione dell\'utente');
    } finally {
      setDeletingUserId(null);
    }
  }

  return (
    <section>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>Utenti e ruoli</h3>
          <button className="btn small" onClick={() => setNewUserFormOpen((v) => !v)}>
            {newUserFormOpen ? 'Annulla' : '+ Nuovo utente'}
          </button>
        </div>

        {newUserFormOpen && (
          <div className="card" style={{ background: 'var(--panna)', borderStyle: 'dashed' }}>
            <div className="row">
              <div className="field"><label>Nome</label><input value={newUser.nome} onChange={(e) => setNewUser({ ...newUser, nome: e.target.value })} /></div>
              <div className="field"><label>Email</label><input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></div>
              <div className="field"><label>Password iniziale</label><input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /></div>
              <div className="field">
                <label>Ruolo</label>
                <select value={newUser.ruolo} onChange={(e) => setNewUser({ ...newUser, ruolo: e.target.value as Ruolo })}>
                  <option value="allenatore">Allenatore</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
              Comunica tu stesso email e password al nuovo utente — potrà cambiarla da Impostazioni dopo il primo accesso.
            </div>
            <div className="settings-actions">
              <button className="btn" onClick={handleCreateUser} disabled={creatingUser}>
                {creatingUser ? 'Creazione…' : 'Crea utente'}
              </button>
            </div>
          </div>
        )}

        {profiles.length === 0 ? (
          <div className="empty">Nessun utente trovato.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Nome</th><th>Email</th><th>Ruolo</th><th></th></tr></thead>
              <tbody>
                {profiles.map((p) => {
                  const isSelf = p.id === session?.user.id;
                  return (
                    <tr key={p.id}>
                      <td>{p.nome || '—'}</td>
                      <td className="muted">{p.email || '—'}</td>
                      <td>
                        <select
                          value={p.ruolo}
                          disabled={isSelf}
                          onChange={(e) => handleRoleChange(p.id, p.nome, e.target.value as Ruolo)}
                        >
                          <option value="allenatore">Allenatore</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td>
                        {!isSelf && (
                          <button
                            className="btn small"
                            style={{ background: 'var(--rosso-scuro)' }}
                            disabled={deletingUserId === p.id}
                            onClick={() => handleDeleteUser(p.id, p.nome, p.email)}
                          >
                            {deletingUserId === p.id ? 'Elimina…' : 'Elimina'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>
          Non puoi cambiare il tuo stesso ruolo — chiedi a un altro admin se serve.
        </div>
      </div>

      <div className="card">
        <h3>Impostazioni società</h3>
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Nome società</label>
          <input value={clubName} onChange={(e) => setClubName(e.target.value)} style={{ width: '100%', maxWidth: 360 }} />
        </div>
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Logo (immagine)</label>
          <input type="file" accept="image/*" onChange={handleLogoChange} />
          {(pendingLogo || settings?.logo_url) && (
            <img
              src={pendingLogo || settings?.logo_url || ''}
              alt="Anteprima logo"
              style={{ height: 56, width: 56, objectFit: 'contain', marginTop: 8, background: '#fff', border: '1px solid var(--linea)', borderRadius: 6, padding: 4 }}
            />
          )}
        </div>
        <div className="field">
          <label>Cambia la tua password di accesso (lascia vuoto per non modificarla)</label>
          <input type="password" placeholder="Nuova password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ width: '100%', maxWidth: 280 }} />
        </div>
        <div className="settings-actions">
          <button className="btn" onClick={handleSave}>Salva</button>
        </div>
      </div>
    </section>
  );
}
