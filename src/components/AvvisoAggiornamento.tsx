import { useEffect, useState } from 'react';
import { EVENTO_NUOVA_VERSIONE, applicaAggiornamento } from '../lib/aggiornamenti';

export function AvvisoAggiornamento() {
  const [visibile, setVisibile] = useState(false);

  useEffect(() => {
    const mostra = () => setVisibile(true);
    window.addEventListener(EVENTO_NUOVA_VERSIONE, mostra);
    return () => window.removeEventListener(EVENTO_NUOVA_VERSIONE, mostra);
  }, []);

  if (!visibile) return null;
  return (
    <div className="avviso-aggiornamento no-print" role="status">
      <span>È disponibile una nuova versione dell'app.</span>
      <button className="btn small" onClick={applicaAggiornamento}>Aggiorna</button>
      <button className="btn ghost small" onClick={() => setVisibile(false)}>Dopo</button>
    </div>
  );
}
