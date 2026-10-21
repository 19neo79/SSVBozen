import { useEffect, useMemo, useState } from 'react';
import { useUi } from '../contexts/UiContext';
import { useEliminaDivise, useSalvaDivisa } from '../hooks/useDivise';
import { GRUPPI_DIVISA, TAGLIE, avvisoTaglia, divisaInConflitto, etichettaGruppo, nomeGiocatore, normalizzaNome } from '../lib/divise';
import type { Divisa, GruppoDivisa, RosterPlayer, TagliaDivisa } from '../types/database';

/** Blocca lo scroll della pagina sotto un popup, come nella Rosa. */
export function useBloccaScroll() {
  useEffect(() => {
    const prima = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prima; };
  }, []);
}

const nomeRosa = (p: RosterPlayer) => `${p.nome} ${p.cognome}`;

export function FormDivisa({ divisa, divise, rosa, onChiudi }: { divisa: Divisa | null; divise: Divisa[]; rosa: RosterPlayer[]; onChiudi: () => void }) {
  useBloccaScroll();
  const { showToast, confirm } = useUi();
  const salva = useSalvaDivisa();
  const elimina = useEliminaDivise();

  const [gruppo, setGruppo] = useState<GruppoDivisa | ''>(divisa?.gruppo ?? '');
  const [numero, setNumero] = useState(divisa ? String(divisa.numero) : '');
  const [taglia, setTaglia] = useState<TagliaDivisa>(divisa?.taglia ?? 'M');
  const [libero, setLibero] = useState(divisa?.libero ?? false);
  const [pantaloncino, setPantaloncino] = useState(divisa?.pantaloncino ?? false);
  const [giocatore, setGiocatore] = useState(() => (divisa ? nomeGiocatore(divisa, rosa).nome ?? '' : ''));
  const [note, setNote] = useState(divisa?.note ?? '');
  const [sposta, setSposta] = useState(false);

  // Il nome scritto corrisponde a un ragazzo della rosa? Allora la divisa resta collegata a lui.
  const ragazzo = useMemo(() => {
    const q = normalizzaNome(giocatore);
    return q ? rosa.find((p) => normalizzaNome(nomeRosa(p)) === q) : undefined;
  }, [giocatore, rosa]);
  // Un ragazzo uscito dalla rosa con lo stesso nome resta collegato al suo vecchio id.
  const rosterId = ragazzo?.id ?? (divisa?.roster_id && normalizzaNome(giocatore) === normalizzaNome(divisa.giocatore_nome || '') ? divisa.roster_id : null);
  const nomeSalvato = ragazzo ? nomeRosa(ragazzo) : giocatore.trim().replace(/\s+/g, ' ') || null;

  const conflitto = divisaInConflitto(divise, { id: divisa?.id ?? null, roster_id: rosterId, giocatore_nome: nomeSalvato, libero });
  useEffect(() => { setSposta(false); }, [conflitto?.id]);

  const n = Number(numero);
  const numeroValido = numero.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 99;
  const doppio = numeroValido && gruppo !== '' && divise.some((x) => x.id !== divisa?.id && x.gruppo === gruppo && x.numero === n && x.libero === libero);

  // Accanto a ogni ragazzo della rosa, le divise che ha già.
  const etichetteRosa = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of divise) {
      if (x.id === divisa?.id) continue;
      // Anche le divise con il nome scritto a mano, se corrisponde a un ragazzo della rosa.
      const id = x.roster_id ?? (x.giocatore_nome ? rosa.find((p) => normalizzaNome(nomeRosa(p)) === normalizzaNome(x.giocatore_nome!))?.id : undefined);
      if (!id) continue;
      const testo = x.libero ? `libero n. ${x.numero}` : `n. ${x.numero}`;
      m.set(id, m.has(id) ? `${m.get(id)} · ${testo}` : `ha già: ${testo}`);
    }
    return m;
  }, [divise, divisa?.id, rosa]);

  async function salvaDivisa() {
    if (!numeroValido) { showToast('Il numero va da 0 a 99'); return; }
    try {
      await salva.mutateAsync({
        id: divisa?.id ?? null,
        data: { gruppo: gruppo || null, numero: n, taglia, libero, pantaloncino, roster_id: nomeSalvato ? rosterId : null, giocatore_nome: nomeSalvato, note: note.trim() || null },
        liberaPrima: conflitto && sposta ? conflitto.id : undefined,
      });
      showToast(divisa ? 'Divisa salvata' : 'Divisa aggiunta');
      onChiudi();
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  async function eliminaDivisa() {
    if (!divisa || !(await confirm(`Eliminare la divisa n. ${divisa.numero}?`))) return;
    try {
      await elimina.mutateAsync([divisa.id]);
      showToast('Divisa eliminata');
      onChiudi();
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  return (
    <div className="settings-modal open" role="dialog" aria-modal="true" aria-labelledby="titolo-divisa">
      <div className="modale-giocatore modale-divisa">
        <div className="modale-giocatore-testa">
          <h3 id="titolo-divisa">{divisa ? `Divisa n. ${divisa.numero}` : 'Nuova divisa'}</h3>
          <button type="button" className="modale-chiudi" aria-label="Chiudi senza salvare" onClick={onChiudi}>✕</button>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="divisa-gruppo">Gruppo</label>
            <select id="divisa-gruppo" value={gruppo} onChange={(e) => setGruppo(e.target.value as GruppoDivisa | '')}>
              <option value="">Da assegnare</option>
              {GRUPPI_DIVISA.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="divisa-numero">Numero</label>
            <input id="divisa-numero" inputMode="numeric" style={{ width: 80 }} value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, '').slice(0, 2))} />
          </div>
          <div className="field">
            <label htmlFor="divisa-taglia">Taglia</label>
            <select id="divisa-taglia" value={taglia} onChange={(e) => setTaglia(e.target.value as TagliaDivisa)}>
              {TAGLIE.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <label className="chk" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={libero} onChange={(e) => setLibero(e.target.checked)} />
          Maglia da libero (colore diverso)
        </label>
        <label className="chk" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={pantaloncino} onChange={(e) => setPantaloncino(e.target.checked)} />
          Con pantaloncino
        </label>
        {doppio && <div className="divisa-avviso">⚠ In {gruppo} c'è già una maglia {libero ? 'da libero ' : ''}con il n. {n}. Puoi salvare lo stesso.</div>}

        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="divisa-giocatore">Giocatore</label>
          <input
            id="divisa-giocatore"
            list="divisa-rosa"
            placeholder="Scegli dalla rosa o scrivi il nome (vuoto = divisa libera)"
            value={giocatore}
            onChange={(e) => setGiocatore(e.target.value)}
          />
          <datalist id="divisa-rosa">
            {[...rosa].sort((a, b) => a.cognome.localeCompare(b.cognome, 'it')).map((p) => (
              <option key={p.id} value={nomeRosa(p)} label={[p.taglia_divisa ? `taglia ${p.taglia_divisa}` : '', etichetteRosa.get(p.id) || ''].filter(Boolean).join(' · ') || undefined} />
            ))}
          </datalist>
          {giocatore.trim() && (
            <span className="muted" style={{ fontSize: 12 }}>
              {ragazzo ? `Dalla rosa · taglia provata: ${ragazzo.taglia_divisa || 'non ancora'}` : rosterId ? 'Non più in rosa' : 'Nome scritto a mano (non in rosa)'}
            </span>
          )}
        </div>
        {ragazzo && avvisoTaglia(taglia, ragazzo.taglia_divisa) && (
          <div className="divisa-avviso">⚠ {avvisoTaglia(taglia, ragazzo.taglia_divisa)} Puoi salvare lo stesso.</div>
        )}
        {conflitto && (
          <div className="divisa-conflitto">
            <span>
              <strong>{nomeSalvato}</strong> ha già la n. {conflitto.numero}, taglia {conflitto.taglia}, {etichettaGruppo(conflitto.gruppo)}
              {libero ? ' (da libero)' : ''}. Ogni ragazzo può avere una divisa normale e una da libero.
            </span>
            {sposta ? (
              <span className="divisa-sposta-ok">✓ Al salvataggio la n. {conflitto.numero} torna libera.</span>
            ) : (
              <button type="button" className="btn small" onClick={() => setSposta(true)}>Sposta qui</button>
            )}
          </div>
        )}

        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="divisa-note">Note</label>
          <textarea id="divisa-note" rows={2} placeholder="Es. pantaloncino rovinato, da lavare…" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="settings-actions">
          {divisa && <button type="button" className="btn ghost divise-elimina" style={{ marginRight: 'auto' }} onClick={eliminaDivisa} disabled={elimina.isPending}>Elimina</button>}
          <button type="button" className="btn ghost" onClick={onChiudi}>Annulla</button>
          <button type="button" className="btn" onClick={salvaDivisa} disabled={salva.isPending || !numeroValido || (!!conflitto && !sposta)}>
            {salva.isPending ? 'Salvo…' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}
