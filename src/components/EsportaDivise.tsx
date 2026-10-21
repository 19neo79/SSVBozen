import { useMemo, useState } from 'react';
import { useUi } from '../contexts/UiContext';
import { GRUPPI_DIVISA, etichettaGruppo } from '../lib/divise';
import { filtraPerGruppi, scaricaExcelDivise, testoWhatsAppDivise } from '../lib/esportaDivise';
import type { Divisa, GruppoDivisa, RosterPlayer } from '../types/database';
import { useBloccaScroll } from './FormDivisa';

const TUTTI: (GruppoDivisa | null)[] = [...GRUPPI_DIVISA, null];

/** Esporta le divise dei gruppi scelti in Excel o come testo per WhatsApp. */
export function EsportaDivise({ divise, rosa, onChiudi }: { divise: Divisa[]; rosa: RosterPlayer[]; onChiudi: () => void }) {
  useBloccaScroll();
  const { showToast } = useUi();
  const [gruppi, setGruppi] = useState<Set<GruppoDivisa | null>>(() => new Set(TUTTI));

  const quante = useMemo(() => filtraPerGruppi(divise, gruppi).length, [divise, gruppi]);
  const testo = useMemo(() => testoWhatsAppDivise(divise, rosa, gruppi), [divise, rosa, gruppi]);
  const nessunGruppo = gruppi.size === 0;

  function cambia(g: GruppoDivisa | null) {
    const n = new Set(gruppi);
    if (n.has(g)) n.delete(g);
    else n.add(g);
    setGruppi(n);
  }

  async function copia() {
    try {
      await navigator.clipboard.writeText(testo);
      showToast('Copiato: incollalo su WhatsApp');
    } catch {
      showToast('Copia non riuscita: seleziona il testo nell\'anteprima e copialo a mano');
    }
  }

  async function excel() {
    try {
      await scaricaExcelDivise(divise, rosa, gruppi);
    } catch {
      showToast('Errore nella creazione del file Excel');
    }
  }

  return (
    <div className="settings-modal open" role="dialog" aria-modal="true" aria-labelledby="titolo-esporta-divise">
      <div className="modale-giocatore modale-divisa">
        <div className="modale-giocatore-testa">
          <h3 id="titolo-esporta-divise">Esporta divise</h3>
          <button type="button" className="modale-chiudi" aria-label="Chiudi" onClick={onChiudi}>✕</button>
        </div>
        <div className="field">
          <label>Gruppi ({quante} {quante === 1 ? 'divisa' : 'divise'})</label>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            {TUTTI.map((g) => (
              <label className="chk" key={g ?? 'nessuno'}>
                <input type="checkbox" checked={gruppi.has(g)} onChange={() => cambia(g)} />
                {etichettaGruppo(g)}
              </label>
            ))}
            <button type="button" className="btn ghost small" onClick={() => setGruppi(new Set(TUTTI))}>Tutti</button>
            <button type="button" className="btn ghost small" onClick={() => setGruppi(new Set())}>Nessuno</button>
          </div>
        </div>

        <div className="settings-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn ghost" onClick={onChiudi}>Chiudi</button>
          <button type="button" className="btn ghost" disabled={nessunGruppo} onClick={excel}>Scarica Excel</button>
          <button type="button" className="btn" disabled={nessunGruppo} onClick={copia}>Copia per WhatsApp</button>
        </div>

        {!nessunGruppo && (
          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="anteprima-divise">Anteprima del testo</label>
            <textarea id="anteprima-divise" readOnly rows={Math.min(14, testo.split('\n').length + 1)} style={{ width: '100%', fontSize: 13.5, fontFamily: 'inherit', lineHeight: 1.5 }} value={testo} />
          </div>
        )}
      </div>
    </div>
  );
}
