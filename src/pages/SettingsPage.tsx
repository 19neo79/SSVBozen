import { useEffect, useState } from 'react';
import { useUi } from '../contexts/UiContext';
import { useSettings, useUpdateSettings } from '../hooks/useSettings';
import { supabase } from '../lib/supabase';

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
  const { showToast } = useUi();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  const [clubName, setClubName] = useState('');
  const [pendingLogo, setPendingLogo] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

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

  return (
    <section>
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
