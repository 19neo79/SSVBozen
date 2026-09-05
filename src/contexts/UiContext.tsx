import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface UiContextValue {
  showToast: (msg: string) => void;
  confirm: (message: string) => Promise<boolean>;
}

const UiContext = createContext<UiContextValue | undefined>(undefined);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2200);
  }, []);

  const confirm = useCallback((message: string) => {
    setConfirmMsg(message);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function handleConfirmResult(result: boolean) {
    setConfirmMsg(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  }

  return (
    <UiContext.Provider value={{ showToast, confirm }}>
      {children}
      <div className={`toast${toastMsg ? ' show' : ''}`}>{toastMsg}</div>
      {confirmMsg && (
        <div className="settings-modal open">
          <div className="settings-box" style={{ maxWidth: 380 }}>
            <p style={{ margin: '0 0 4px', lineHeight: 1.5 }}>{confirmMsg}</p>
            <div className="settings-actions">
              <button className="btn ghost" onClick={() => handleConfirmResult(false)}>
                Annulla
              </button>
              <button
                className="btn"
                style={{ background: 'var(--rosso-scuro)' }}
                onClick={() => handleConfirmResult(true)}
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </UiContext.Provider>
  );
}

export function useUi(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi deve essere usato dentro UiProvider');
  return ctx;
}
