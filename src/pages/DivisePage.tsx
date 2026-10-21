import { useMemo, useState } from 'react';
import { useUi } from '../contexts/UiContext';
import { useAggiornaDivise, useDivise, useEliminaDivise } from '../hooks/useDivise';
import { useRoster } from '../hooks/useRoster';
import { BloccoDivise } from '../components/BloccoDivise';
import { EsportaDivise } from '../components/EsportaDivise';
import { FormDivisa } from '../components/FormDivisa';
import {
  COLONNE_RIEPILOGO,
  GRUPPI_DIVISA,
  TAGLIE,
  etichettaGruppo,
  nomeGiocatore,
  normalizzaNome,
  numeriDoppi,
  ordinaDivise,
  riepilogo,
  rosaSenzaDivisa,
  selezioneVisibile,
  type CellaRiepilogo,
  type ColonnaRiepilogo,
} from '../lib/divise';
import type { Divisa, GruppoDivisa, TagliaDivisa } from '../types/database';

type FiltroGruppo = 'tutti' | GruppoDivisa | 'nessuno';
interface Filtri {
  gruppo: FiltroGruppo;
  taglia: 'tutte' | TagliaDivisa;
  tipo: 'tutte' | 'normali' | 'libero';
  stato: 'tutte' | 'assegnate' | 'libere';
  pantaloncino: 'tutte' | 'con' | 'senza';
  testo: string;
}
const FILTRI_INIZIALI: Filtri = { gruppo: 'tutti', taglia: 'tutte', tipo: 'tutte', stato: 'tutte', pantaloncino: 'tutte', testo: '' };

export type Aperto = { tipo: 'divisa'; divisa: Divisa | null } | { tipo: 'blocco' } | { tipo: 'esporta' } | null;

const titoloColonna = (c: ColonnaRiepilogo) => (c === 'nessuno' ? 'Da assegnare' : c === 'totale' ? 'Totale' : c);

function Cella({ c }: { c: CellaRiepilogo }) {
  if (!c.totale) return <span className="divise-zero">–</span>;
  return (
    <>
      {c.totale}
      {c.libero > 0 && <span className="divise-lib"> · {c.libero} lib.</span>}
      {c.totale > c.pantaloncini && <span className="divise-senza-pant"> · {c.totale - c.pantaloncini} senza pant.</span>}
    </>
  );
}

export default function DivisePage() {
  const { showToast, confirm } = useUi();
  const { data: divise = [], isLoading, isError, refetch } = useDivise();
  const { data: rosa = [] } = useRoster();
  const aggiorna = useAggiornaDivise();
  const elimina = useEliminaDivise();

  const [filtri, setFiltri] = useState<Filtri>(FILTRI_INIZIALI);
  const [selezione, setSelezione] = useState<Set<string>>(new Set());
  const [aperto, setAperto] = useState<Aperto>(null);
  const [mostraSenza, setMostraSenza] = useState(false);

  const r = useMemo(() => riepilogo(divise), [divise]);
  const doppi = useMemo(() => numeriDoppi(divise), [divise]);
  const senzaDivisa = useMemo(() => rosaSenzaDivisa(rosa, divise), [rosa, divise]);

  const visibili = useMemo(() => {
    const testo = normalizzaNome(filtri.testo);
    return ordinaDivise(
      divise.filter((x) => {
        if (filtri.gruppo !== 'tutti' && (x.gruppo ?? 'nessuno') !== filtri.gruppo) return false;
        if (filtri.taglia !== 'tutte' && x.taglia !== filtri.taglia) return false;
        if (filtri.tipo !== 'tutte' && x.libero !== (filtri.tipo === 'libero')) return false;
        if (filtri.stato !== 'tutte' && !!x.giocatore_nome !== (filtri.stato === 'assegnate')) return false;
        if (filtri.pantaloncino !== 'tutte' && x.pantaloncino !== (filtri.pantaloncino === 'con')) return false;
        if (!testo) return true;
        if (/^\d+$/.test(testo) && x.numero === Number(testo)) return true;
        const nome = nomeGiocatore(x, rosa).nome;
        return !!nome && normalizzaNome(nome).includes(testo);
      }),
    );
  }, [divise, rosa, filtri]);

  // Solo le selezionate ancora visibili: cambiando filtro non si agisce su divise che non si vedono più.
  const selezionate = selezioneVisibile(selezione, visibili);
  const tutteVisibiliSelezionate = visibili.length > 0 && visibili.every((x) => selezione.has(x.id));

  function cambiaSelezione(id: string) {
    setSelezione((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function selezionaVisibili() {
    setSelezione(tutteVisibiliSelezionate ? new Set() : new Set(visibili.map((x) => x.id)));
  }

  async function spostaIn(valore: string) {
    if (!valore) return;
    const gruppo = valore === 'nessuno' ? null : (valore as GruppoDivisa);
    try {
      await aggiorna.mutateAsync({ ids: selezionate, data: { gruppo } });
      showToast(`${selezionate.length} divise spostate in ${etichettaGruppo(gruppo)}`);
      setSelezione(new Set());
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  async function segnaPantaloncino(pantaloncino: boolean) {
    try {
      await aggiorna.mutateAsync({ ids: selezionate, data: { pantaloncino } });
      showToast(`${selezionate.length} divise segnate ${pantaloncino ? 'con' : 'senza'} pantaloncino`);
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  async function togliGiocatore() {
    try {
      await aggiorna.mutateAsync({ ids: selezionate, data: { roster_id: null, giocatore_nome: null } });
      showToast('Giocatore tolto dalle divise selezionate');
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  async function eliminaSelezionate() {
    if (!(await confirm(`Eliminare ${selezionate.length === 1 ? 'la divisa selezionata' : `le ${selezionate.length} divise selezionate`}?`))) return;
    try {
      await elimina.mutateAsync(selezionate);
      showToast('Divise eliminate');
      setSelezione(new Set());
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  return (
    <section className="divise">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Divise</h2>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn ghost small" onClick={() => setAperto({ tipo: 'esporta' })}>Esporta</button>
          <button className="btn ghost small" onClick={() => setAperto({ tipo: 'blocco' })}>+ A blocchi</button>
          <button className="btn" onClick={() => setAperto({ tipo: 'divisa', divisa: null })}>+ Divisa</button>
        </div>
      </div>

      {!isError && (
      <div className="card divise-riepilogo">
        <div className="divise-tabella-wrap">
          <table className="divise-tabella">
            <thead>
              <tr>
                <th>Taglia</th>
                {COLONNE_RIEPILOGO.map((c) => <th key={c} className={c === 'totale' ? 'tot' : undefined}>{titoloColonna(c)}</th>)}
              </tr>
            </thead>
            <tbody>
              {r.righe.map((riga) => (
                <tr key={riga.taglia}>
                  <th>{riga.taglia}</th>
                  {COLONNE_RIEPILOGO.map((c) => <td key={c} className={c === 'totale' ? 'tot' : undefined}><Cella c={riga.celle[c]} /></td>)}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Totale</th>
                {COLONNE_RIEPILOGO.map((c) => <td key={c} className={c === 'totale' ? 'tot' : undefined}><Cella c={r.totali[c]} /></td>)}
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="divise-riepilogo-piede">
          <span>
            Maglie <strong>{r.totali.totale.totale}</strong> · Pantaloncini <strong>{r.totali.totale.pantaloncini}</strong>
            {r.totali.totale.totale > r.totali.totale.pantaloncini && <> · Senza pantaloncino <strong>{r.totali.totale.totale - r.totali.totale.pantaloncini}</strong></>}
            <br />
            Assegnate <strong>{r.assegnate}</strong> · Libere <strong>{r.libere}</strong>
          </span>
          <button type="button" className="btn ghost small" onClick={() => setMostraSenza((v) => !v)} disabled={!senzaDivisa.length}>
            Ragazzi della rosa senza divisa: {senzaDivisa.length}
          </button>
        </div>
        {mostraSenza && senzaDivisa.length > 0 && (
          <div className="divise-senza">{senzaDivisa.map((p) => `${p.nome} ${p.cognome}${p.taglia_divisa ? ` (${p.taglia_divisa})` : ''}`).join(' · ')}</div>
        )}
      </div>
      )}

      <div className="divise-filtri">
        <select aria-label="Gruppo" value={filtri.gruppo} onChange={(e) => setFiltri({ ...filtri, gruppo: e.target.value as FiltroGruppo })}>
          <option value="tutti">Tutti i gruppi</option>
          {GRUPPI_DIVISA.map((g) => <option key={g} value={g}>{g}</option>)}
          <option value="nessuno">Da assegnare</option>
        </select>
        <select aria-label="Taglia" value={filtri.taglia} onChange={(e) => setFiltri({ ...filtri, taglia: e.target.value as Filtri['taglia'] })}>
          <option value="tutte">Tutte le taglie</option>
          {TAGLIE.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select aria-label="Tipo" value={filtri.tipo} onChange={(e) => setFiltri({ ...filtri, tipo: e.target.value as Filtri['tipo'] })}>
          <option value="tutte">Normali e libero</option>
          <option value="normali">Solo normali</option>
          <option value="libero">Solo libero</option>
        </select>
        <select aria-label="Stato" value={filtri.stato} onChange={(e) => setFiltri({ ...filtri, stato: e.target.value as Filtri['stato'] })}>
          <option value="tutte">Assegnate e libere</option>
          <option value="assegnate">Solo assegnate</option>
          <option value="libere">Solo libere</option>
        </select>
        <select aria-label="Pantaloncino" value={filtri.pantaloncino} onChange={(e) => setFiltri({ ...filtri, pantaloncino: e.target.value as Filtri['pantaloncino'] })}>
          <option value="tutte">Con e senza pantaloncino</option>
          <option value="con">Solo con pantaloncino</option>
          <option value="senza">Solo senza pantaloncino</option>
        </select>
        <input type="search" placeholder="Cerca nome o numero…" value={filtri.testo} onChange={(e) => setFiltri({ ...filtri, testo: e.target.value })} />
      </div>

      {selezionate.length > 0 && (
        <div className="divise-barra">
          <strong>{selezionate.length} selezionate</strong>
          <select aria-label="Sposta in gruppo" value="" onChange={(e) => spostaIn(e.target.value)} disabled={aggiorna.isPending}>
            <option value="">Sposta in…</option>
            {GRUPPI_DIVISA.map((g) => <option key={g} value={g}>{g}</option>)}
            <option value="nessuno">Da assegnare</option>
          </select>
          <button type="button" className="btn ghost small" onClick={() => segnaPantaloncino(true)} disabled={aggiorna.isPending}>Con pantaloncino</button>
          <button type="button" className="btn ghost small" onClick={() => segnaPantaloncino(false)} disabled={aggiorna.isPending}>Senza pantaloncino</button>
          <button type="button" className="btn ghost small" onClick={togliGiocatore} disabled={aggiorna.isPending}>Togli giocatore</button>
          <button type="button" className="btn ghost small divise-elimina" onClick={eliminaSelezionate} disabled={elimina.isPending}>Elimina</button>
          <button type="button" className="btn ghost small" onClick={() => setSelezione(new Set())}>Deseleziona</button>
        </div>
      )}

      {isLoading ? (
        <div className="empty">Carico le divise…</div>
      ) : isError ? (
        <div className="empty divise-errore">
          Non riesco a caricare le divise: controlla la connessione. Le divise già inserite non sono andate perse.
          <div style={{ marginTop: 10 }}><button type="button" className="btn small" onClick={() => refetch()}>Riprova</button></div>
        </div>
      ) : !divise.length ? (
        <div className="empty">Nessuna divisa. Inizia con + A blocchi.</div>
      ) : (
        <>
          <div className="divise-elenco-testa">
            <label className="chk small">
              <input type="checkbox" checked={tutteVisibiliSelezionate} onChange={selezionaVisibili} />
              Seleziona tutte quelle filtrate ({visibili.length})
            </label>
          </div>
          {!visibili.length && <div className="empty">Nessuna divisa con questi filtri.</div>}
          <div className="divise-elenco">
            {visibili.map((x) => {
              const { nome, fuoriRosa } = nomeGiocatore(x, rosa);
              return (
                <div
                  key={x.id}
                  className={`divisa-riga${selezione.has(x.id) ? ' selezionata' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setAperto({ tipo: 'divisa', divisa: x })}
                  onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) setAperto({ tipo: 'divisa', divisa: x }); }}
                >
                  <input
                    type="checkbox"
                    aria-label={`Seleziona la divisa n. ${x.numero}`}
                    checked={selezione.has(x.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => cambiaSelezione(x.id)}
                  />
                  <span className={`divisa-numero${x.libero ? ' libero' : ''}`}>{x.numero}</span>
                  <span className="divisa-taglia">{x.taglia}</span>
                  <div className="divisa-info">
                    <div className="divisa-tag">
                      <span className={`divisa-gruppo${x.gruppo ? '' : ' nessuno'}`}>{etichettaGruppo(x.gruppo)}</span>
                      {x.libero && <span className="divisa-libero">Libero</span>}
                      {!x.pantaloncino && <span className="divisa-senza-pant">Senza pantaloncino</span>}
                      {doppi.has(x.id) && <span className="divisa-doppio" title="Numero già usato in questo gruppo">⚠ numero doppio</span>}
                    </div>
                    <div className={`divisa-giocatore${nome ? '' : ' libera'}`}>
                      {nome || 'Libera'}
                      {fuoriRosa && <span className="divisa-fuori"> · non più in rosa</span>}
                    </div>
                    {x.note && <div className="divisa-note">{x.note}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {aperto?.tipo === 'divisa' && <FormDivisa divisa={aperto.divisa} divise={divise} rosa={rosa} onChiudi={() => setAperto(null)} />}
      {aperto?.tipo === 'blocco' && <BloccoDivise divise={divise} onChiudi={() => setAperto(null)} />}
      {aperto?.tipo === 'esporta' && <EsportaDivise divise={divise} rosa={rosa} onChiudi={() => setAperto(null)} />}
    </section>
  );
}
