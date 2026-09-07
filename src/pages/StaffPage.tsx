import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUi } from '../contexts/UiContext';
import { useSettings, useUpdateSettings } from '../hooks/useSettings';

interface RuoloForm {
  label: string;
  nomeKey: 'coach_nome' | 'vice_coach_nome' | 'dirigente_nome';
  telKey: 'coach_telefono' | 'vice_coach_telefono' | 'dirigente_telefono';
  emailKey: 'coach_email' | 'vice_coach_email' | 'dirigente_email';
}

const RUOLI: RuoloForm[] = [
  { label: 'Coach', nomeKey: 'coach_nome', telKey: 'coach_telefono', emailKey: 'coach_email' },
  { label: 'Vice coach', nomeKey: 'vice_coach_nome', telKey: 'vice_coach_telefono', emailKey: 'vice_coach_email' },
  { label: 'Dirigente', nomeKey: 'dirigente_nome', telKey: 'dirigente_telefono', emailKey: 'dirigente_email' },
];

const emptyForm = {
  coach_nome: '', coach_telefono: '', coach_email: '',
  vice_coach_nome: '', vice_coach_telefono: '', vice_coach_email: '',
  dirigente_nome: '', dirigente_telefono: '', dirigente_email: '',
};

export default function StaffPage() {
  const { isAdmin } = useAuth();
  const { showToast } = useUi();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!settings) return;
    setForm({
      coach_nome: settings.coach_nome || '', coach_telefono: settings.coach_telefono || '', coach_email: settings.coach_email || '',
      vice_coach_nome: settings.vice_coach_nome || '', vice_coach_telefono: settings.vice_coach_telefono || '', vice_coach_email: settings.vice_coach_email || '',
      dirigente_nome: settings.dirigente_nome || '', dirigente_telefono: settings.dirigente_telefono || '', dirigente_email: settings.dirigente_email || '',
    });
  }, [settings]);

  async function handleSave() {
    try {
      await updateSettings.mutateAsync({
        coach_nome: form.coach_nome.trim() || null,
        coach_telefono: form.coach_telefono.trim() || null,
        coach_email: form.coach_email.trim() || null,
        vice_coach_nome: form.vice_coach_nome.trim() || null,
        vice_coach_telefono: form.vice_coach_telefono.trim() || null,
        vice_coach_email: form.vice_coach_email.trim() || null,
        dirigente_nome: form.dirigente_nome.trim() || null,
        dirigente_telefono: form.dirigente_telefono.trim() || null,
        dirigente_email: form.dirigente_email.trim() || null,
      });
      showToast('Staff tecnico salvato');
    } catch {
      showToast('Errore nel salvataggio');
    }
  }

  return (
    <section>
      <div className="card">
        <h3>Staff tecnico</h3>
        <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
          Mostrati nel piano settimanale (pagina pubblica, anteprima e stampa) così i genitori sanno chi contattare. Lascia vuoto un nome per non mostrare quel ruolo.
        </div>

        {!isAdmin ? (
          <div>
            {RUOLI.filter((r) => settings?.[r.nomeKey]).map((r) => (
              <div key={r.label} style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 700 }}>{r.label}</div>
                <div className="muted">{settings?.[r.nomeKey]}</div>
                {settings?.[r.telKey] && <div className="muted">{settings[r.telKey]}</div>}
                {settings?.[r.emailKey] && <div className="muted">{settings[r.emailKey]}</div>}
              </div>
            ))}
            {RUOLI.every((r) => !settings?.[r.nomeKey]) && <div className="empty">Nessun referente inserito.</div>}
          </div>
        ) : (
          <>
            {RUOLI.map((r) => (
              <div className="row" key={r.label} style={{ marginBottom: 14 }}>
                <div className="field">
                  <label>{r.label}</label>
                  <input style={{ width: 200 }} value={form[r.nomeKey]} onChange={(e) => setForm({ ...form, [r.nomeKey]: e.target.value })} />
                </div>
                <div className="field">
                  <label>Cellulare</label>
                  <input style={{ width: 160 }} value={form[r.telKey]} onChange={(e) => setForm({ ...form, [r.telKey]: e.target.value })} />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input type="email" style={{ width: 220 }} value={form[r.emailKey]} onChange={(e) => setForm({ ...form, [r.emailKey]: e.target.value })} />
                </div>
              </div>
            ))}
            <div className="settings-actions">
              <button className="btn" onClick={handleSave}>Salva</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
