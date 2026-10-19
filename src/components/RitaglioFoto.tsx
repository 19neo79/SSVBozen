import { useEffect, useRef, useState } from 'react';
import { limitaRitaglio, ritaglioCentrale, trovaViso, type Ritaglio } from '../lib/fotoAtleti';

const ZOOM_MAX = 6;

type StatoViso = 'cerco' | 'trovato' | 'non-trovato' | 'errore';

/** Ritaglio quadrato da trascinare e ingrandire, proposto in automatico sul viso. */
export function RitaglioFoto({ img, onConferma, onAnnulla }: { img: ImageBitmap; onConferma: (r: Ritaglio) => void; onAnnulla: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [r, setR] = useState<Ritaglio>(() => ritaglioCentrale(img.width, img.height));
  const [viso, setViso] = useState<Ritaglio | null>(null);
  const [stato, setStato] = useState<StatoViso>('cerco');
  const toccato = useRef(false);
  const trascina = useRef<{ x: number; y: number } | null>(null);
  const minLato = Math.min(img.width, img.height);
  const zoom = minLato / r.lato;

  useEffect(() => {
    let attivo = true;
    trovaViso(img)
      .then((v) => {
        if (!attivo) return;
        setViso(v);
        setStato(v ? 'trovato' : 'non-trovato');
        if (v && !toccato.current) setR(v);
      })
      .catch(() => { if (attivo) setStato('errore'); });
    return () => { attivo = false; };
  }, [img]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const S = c.width;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(img, r.x, r.y, r.lato, r.lato, 0, 0, S, S);
  }, [img, r]);

  function aggiorna(nuovo: Ritaglio) {
    toccato.current = true;
    setR(limitaRitaglio(nuovo, img.width, img.height));
  }

  function impostaZoom(z: number) {
    const lato = minLato / Math.min(ZOOM_MAX, Math.max(1, z));
    const cx = r.x + r.lato / 2;
    const cy = r.y + r.lato / 2;
    aggiorna({ lato, x: cx - lato / 2, y: cy - lato / 2 });
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    trascina.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!trascina.current) return;
    const lato = e.currentTarget.getBoundingClientRect().width;
    const fattore = r.lato / lato;
    const dx = (e.clientX - trascina.current.x) * fattore;
    const dy = (e.clientY - trascina.current.y) * fattore;
    trascina.current = { x: e.clientX, y: e.clientY };
    aggiorna({ ...r, x: r.x - dx, y: r.y - dy });
  }

  return (
    <div className="settings-modal open ritaglio-overlay" role="dialog" aria-modal="true" aria-labelledby="titolo-ritaglio">
      <div className="ritaglio-box">
        <h3 id="titolo-ritaglio">Inquadra il viso</h3>
        <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
          {stato === 'cerco' && 'Cerco il viso nella foto… (la prima volta può richiedere fino a mezzo minuto; intanto puoi inquadrare a mano).'}
          {stato === 'trovato' && 'Viso trovato: correggi l\'inquadratura se serve.'}
          {stato === 'non-trovato' && 'Viso non trovato: trascina la foto e usa lo zoom per inquadrarlo.'}
          {stato === 'errore' && 'Riconoscimento non disponibile: inquadra il viso a mano.'}
          {' '}Trascina per spostare, usa lo zoom per ingrandire.
        </div>
        <div className="ritaglio-area">
          <canvas
            ref={canvasRef}
            width={600}
            height={600}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => { trascina.current = null; }}
            onPointerCancel={() => { trascina.current = null; }}
            onWheel={(e) => impostaZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
          />
          <div className="ritaglio-cerchio" aria-hidden="true" />
        </div>
        <div className="row" style={{ alignItems: 'center', gap: 10, marginTop: 12 }}>
          <label htmlFor="zoom-ritaglio" style={{ fontSize: 12.5, fontWeight: 600 }}>Zoom</label>
          <input
            id="zoom-ritaglio"
            type="range"
            min={1}
            max={ZOOM_MAX}
            step={0.01}
            value={zoom}
            onChange={(e) => impostaZoom(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          {viso && <button type="button" className="btn ghost small" onClick={() => aggiorna(viso)}>Centra sul viso</button>}
        </div>
        <div className="settings-actions">
          <button type="button" className="btn ghost" onClick={onAnnulla}>Annulla</button>
          <button type="button" className="btn" onClick={() => onConferma(r)}>Usa questo ritaglio</button>
        </div>
      </div>
    </div>
  );
}
