import { useState } from 'react';
import { useUi } from '../contexts/UiContext';
import { useCreaDivise } from '../hooks/useDivise';
import { GRUPPI_DIVISA, TAGLIE, creaBlocco, erroreBlocco, etichettaGruppo, numeriGiaPresenti, type Blocco } from '../lib/divise';
import type { Divisa, GruppoDivisa, TagliaDivisa } from '../types/database';
import { useBloccaScroll } from './FormDivisa';

/** Crea più divise in un colpo: stessi gruppo, taglia e tipo, numeri in sequenza. */
export function BloccoDivise({ divise, onChiudi }: { divise: Divisa[]; onChiudi: () => void }) {
  useBloccaScroll();
  const { showToast } = useUi();
  const crea = useCreaDivise();
  const [gruppo, setGruppo] = useState<GruppoDivisa | ''>('');
  const [da, setDa] = useState('1');
  const [a, setA] = useState('14');
  const [taglia, setTaglia] = useState<TagliaDivisa>('M');
  const [libero, setLibero] = useState(false);
  const [pantaloncino, setPantaloncino] = useState(false);

  const blocco: Blocco = { gruppo: gruppo || null, da: da === '' ? NaN : Number(da), a: a === '' ? NaN : Number(a), taglia, libero, pantaloncino };
  const errore = erroreBlocco(blocco);
  const quante = errore ? 0 : blocco.a - blocco.da + 1;
  const giaPresenti = errore ? [] : numeriGiaPresenti(divise, blocco);

  async function creaDivise() {
    if (errore) return;
    try {
      await crea.mutateAsync(creaBlocco(blocco));
      showToast(`${quante} divise create`);
      onChiudi();
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  const soloCifre = (v: string) => v.replace(/\D/g, '').slice(0, 2);

  return (
    <div className="settings-modal open" role="dialog" aria-modal="true" aria-labelledby="titolo-blocco">
      <div className="modale-giocatore modale-divisa">
        <div className="modale-giocatore-testa">
          <h3 id="titolo-blocco">Aggiungi divise a blocchi</h3>
          <button type="button" className="modale-chiudi" aria-label="Chiudi" onClick={onChiudi}>✕</button>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="blocco-gruppo">Gruppo</label>
            <select id="blocco-gruppo" value={gruppo} onChange={(e) => setGruppo(e.target.value as GruppoDivisa | '')}>
              <option value="">Da assegnare</option>
              {GRUPPI_DIVISA.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="blocco-da">Dal numero</label>
            <input id="blocco-da" inputMode="numeric" style={{ width: 80 }} value={da} onChange={(e) => setDa(soloCifre(e.target.value))} />
          </div>
          <div className="field">
            <label htmlFor="blocco-a">Al numero</label>
            <input id="blocco-a" inputMode="numeric" style={{ width: 80 }} value={a} onChange={(e) => setA(soloCifre(e.target.value))} />
          </div>
          <div className="field">
            <label htmlFor="blocco-taglia">Taglia</label>
            <select id="blocco-taglia" value={taglia} onChange={(e) => setTaglia(e.target.value as TagliaDivisa)}>
              {TAGLIE.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <label className="chk" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={libero} onChange={(e) => setLibero(e.target.checked)} />
          Maglie da libero
        </label>
        <label className="chk" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={pantaloncino} onChange={(e) => setPantaloncino(e.target.checked)} />
          Con pantaloncino
        </label>
        <div className={errore ? 'divisa-avviso' : 'divisa-anteprima'}>
          {errore || `Creo ${quante} ${quante === 1 ? 'divisa' : 'divise'}: n. ${blocco.da}${quante > 1 ? `–${blocco.a}` : ''}, taglia ${taglia}, ${etichettaGruppo(blocco.gruppo)}${libero ? ', da libero' : ''}, ${pantaloncino ? 'con' : 'senza'} pantaloncino.`}
        </div>
        {giaPresenti.length > 0 && (
          <div className="divisa-avviso">
            ⚠ {giaPresenti.length === 1 ? `Il n. ${giaPresenti[0]} è già presente` : `${giaPresenti.length} numeri sono già presenti`} in {blocco.gruppo}
            {libero ? ' tra le maglie da libero' : ''}
            {giaPresenti.length > 1 && giaPresenti.length <= 10 ? ` (${giaPresenti.join(', ')})` : ''}. Puoi crearle lo stesso.
          </div>
        )}
        <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Poi puoi correggere una per una la taglia o assegnarle ai ragazzi.</div>
        <div className="settings-actions">
          <button type="button" className="btn ghost" onClick={onChiudi}>Annulla</button>
          <button type="button" className="btn" onClick={creaDivise} disabled={!!errore || crea.isPending}>{crea.isPending ? 'Creo…' : 'Crea'}</button>
        </div>
      </div>
    </div>
  );
}
