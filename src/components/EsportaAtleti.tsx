import { useEffect, useMemo, useState } from 'react';
import type { RosterPlayer } from '../types/database';
import { useUi } from '../contexts/UiContext';
import { PlayerChecks } from './ui/PlayerChecks';
import { playerCategory } from '../lib/categoria';
import { GRUPPI_DATI, scaricaExcelAtleti, testoWhatsAppAtleti, type GruppoDati } from '../lib/esportaAtleti';

export function EsportaAtleti({ players, iniziali, onClose }: { players: RosterPlayer[]; iniziali: string[]; onClose: () => void }) {
  const { showToast } = useUi();
  const [selezionati, setSelezionati] = useState<string[]>(iniziali);
  const [gruppi, setGruppi] = useState<Set<GruppoDati>>(() => new Set(GRUPPI_DATI.map((g) => g.id)));
  const [cerca, setCerca] = useState('');

  useEffect(() => {
    const prima = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prima; };
  }, []);

  const visibili = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    return q ? players.filter((p) => `${p.cognome} ${p.nome} ${p.nome} ${p.cognome}`.toLowerCase().includes(q)) : players;
  }, [players, cerca]);

  const atleti = useMemo(
    () => players.filter((p) => selezionati.includes(p.id)),
    [players, selezionati],
  );
  const testo = useMemo(() => testoWhatsAppAtleti(atleti, gruppi), [atleti, gruppi]);

  const giocaIn = (p: RosterPlayer) => (playerCategory(p.data_nascita) === 'U14' && !p.solo_u15 ? 'U14' : playerCategory(p.data_nascita) ? 'U15' : null);

  function toggleGruppo(id: GruppoDati) {
    const n = new Set(gruppi);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setGruppi(n);
  }

  async function copia() {
    try {
      await navigator.clipboard.writeText(testo);
      showToast(atleti.length === 1 ? 'Testo copiato: incollalo su WhatsApp' : `Dati di ${atleti.length} atleti copiati: incollali su WhatsApp`);
    } catch {
      showToast('Copia non riuscita: seleziona il testo nell\'anteprima e copialo a mano');
    }
  }

  async function excel() {
    try {
      await scaricaExcelAtleti(atleti, gruppi);
    } catch {
      showToast('Errore nella creazione del file Excel');
    }
  }

  return (
    <div className="settings-modal open" role="dialog" aria-modal="true" aria-labelledby="titolo-esporta">
      <div className="modale-giocatore">
        <div className="modale-giocatore-testa">
          <h3 id="titolo-esporta">Esporta dati atleti</h3>
          <button type="button" className="modale-chiudi" aria-label="Chiudi" onClick={onClose}>✕</button>
        </div>

        <div className="field" style={{ marginTop: 6 }}>
          <label>Atleti ({atleti.length} {atleti.length === 1 ? 'selezionato' : 'selezionati'})</label>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <input
              type="search"
              placeholder="Cerca per nome…"
              aria-label="Cerca atleta"
              style={{ flex: 1, minWidth: 160 }}
              value={cerca}
              onChange={(e) => setCerca(e.target.value)}
            />
            <button type="button" className="btn ghost small" onClick={() => setSelezionati(players.map((p) => p.id))}>Tutti</button>
            <button type="button" className="btn ghost small" onClick={() => setSelezionati([])}>Nessuno</button>
            <button type="button" className="btn ghost small" onClick={() => setSelezionati(players.filter((p) => giocaIn(p) === 'U14').map((p) => p.id))}>Solo U14</button>
            <button type="button" className="btn ghost small" onClick={() => setSelezionati(players.filter((p) => giocaIn(p) === 'U15').map((p) => p.id))}>Solo U15</button>
          </div>
          <div className="esporta-elenco">
            <PlayerChecks players={visibili} selected={selezionati} onChange={setSelezionati} emptyMessage="Nessun atleta corrisponde alla ricerca." />
          </div>
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>Dati da includere (nome e cognome ci sono sempre)</label>
          <div className="row" style={{ gap: 8 }}>
            {GRUPPI_DATI.map((g) => (
              <label className="chk" key={g.id}>
                <input type="checkbox" checked={gruppi.has(g.id)} onChange={() => toggleGruppo(g.id)} />
                {g.label}
              </label>
            ))}
          </div>
        </div>

        <div className="settings-actions" style={{ marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>Chiudi</button>
          <button className="btn ghost" disabled={atleti.length === 0} onClick={excel}>Scarica Excel</button>
          <button className="btn" disabled={atleti.length === 0} onClick={copia}>Copia per WhatsApp</button>
        </div>

        {atleti.length > 0 && (
          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="anteprima-whatsapp">Anteprima del testo</label>
            <textarea id="anteprima-whatsapp" readOnly rows={Math.min(14, testo.split('\n').length + 1)} style={{ width: '100%', fontSize: 13.5, fontFamily: 'inherit', lineHeight: 1.5 }} value={testo} />
          </div>
        )}
      </div>
    </div>
  );
}
