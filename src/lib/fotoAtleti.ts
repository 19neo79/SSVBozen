import type { FaceDetector } from '@mediapipe/tasks-vision';
import { supabase } from './supabase';

/** Quadrato da ritagliare, in pixel dell'immagine originale. */
export interface Ritaglio {
  x: number;
  y: number;
  lato: number;
}

const LATO_VOLTO = 512;
// Nell'elenco la foto è grande 48 px: 128 px bastano anche per gli schermi ad alta densità.
const LATO_MINI = 128;
const LATO_MAX_INTERA = 1280;
const MAX_BYTE = 900 * 1024;
// Motore wasm dal CDN (stessa versione del pacchetto npm), modello del viso servito dall'app.
const WASM_MEDIAPIPE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const MODELLO_VISO = '/modelli/blaze_face_short_range.tflite';

export function apriImmagine(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

export function limitaRitaglio(r: Ritaglio, w: number, h: number): Ritaglio {
  const lato = Math.max(64, Math.min(r.lato, w, h));
  return {
    lato,
    x: Math.min(Math.max(0, r.x), w - lato),
    y: Math.min(Math.max(0, r.y), h - lato),
  };
}

/** Quadrato più grande possibile al centro: usato se il viso non viene trovato. */
export function ritaglioCentrale(w: number, h: number): Ritaglio {
  const lato = Math.min(w, h);
  return { lato, x: (w - lato) / 2, y: (h - lato) / 2 };
}

let detector: Promise<FaceDetector> | null = null;

function caricaDetector(): Promise<FaceDetector> {
  if (!detector) {
    detector = (async () => {
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(WASM_MEDIAPIPE);
      return FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODELLO_VISO },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.5,
      });
    })().catch((e) => {
      detector = null;
      throw e;
    });
  }
  return detector;
}

/**
 * Cerca il viso più grande e propone un quadrato che lo contiene con capelli e un accenno di spalle.
 * Tutto avviene nel browser: la foto non viene inviata a nessun servizio.
 */
export async function trovaViso(img: ImageBitmap): Promise<Ritaglio | null> {
  const fd = await caricaDetector();
  // Le foto della macchina possono essere enormi: per cercare il viso basta una versione ridotta.
  const scala = Math.min(1, 1024 / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scala);
  canvas.height = Math.round(img.height * scala);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const { detections } = fd.detect(canvas);
  const box = detections
    .map((d) => d.boundingBox)
    .filter((b): b is NonNullable<typeof b> => !!b)
    .sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!box) return null;
  const cx = (box.originX + box.width / 2) / scala;
  const cy = (box.originY + box.height / 2) / scala;
  const lato = (Math.max(box.width, box.height) / scala) * 2.4;
  return limitaRitaglio({ lato, x: cx - lato / 2, y: cy - lato * 0.45 }, img.width, img.height);
}

function toBlob(canvas: HTMLCanvasElement, qualita: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Conversione non riuscita'))), 'image/jpeg', qualita);
  });
}

async function jpegLeggero(canvas: HTMLCanvasElement): Promise<Blob> {
  for (const q of [0.85, 0.75, 0.65]) {
    const b = await toBlob(canvas, q);
    if (b.size <= MAX_BYTE) return b;
  }
  return toBlob(canvas, 0.55);
}

export interface FotoPreparate {
  volto: Blob;
  busto: Blob;
  intera: Blob;
  mini: Blob;
}

/** Quadrato a mezzo busto: stesso centro orizzontale del viso, testa in alto, corpo fino al petto. */
export function ritaglioBusto(volto: Ritaglio, w: number, h: number): Ritaglio {
  const lato = volto.lato * 1.65;
  return limitaRitaglio({ lato, x: volto.x + volto.lato / 2 - lato / 2, y: volto.y - volto.lato * 0.15 }, w, h);
}

function quadrato(img: CanvasImageSource, r: Ritaglio, lato = LATO_VOLTO): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = lato;
  c.height = lato;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, r.x, r.y, r.lato, r.lato, 0, 0, lato, lato);
  return c;
}

/** Miniatura per l'elenco, dal ritaglio sul viso (pesa circa 5 KB). */
export function creaMiniatura(img: CanvasImageSource, r: Ritaglio): Promise<Blob> {
  return toBlob(quadrato(img, r, LATO_MINI), 0.8);
}

/** Quattro versioni: miniatura (elenco), viso (modifica), mezzo busto (scheda), foto intera ridotta (ingrandimento). */
export async function creaFoto(img: ImageBitmap, r: Ritaglio): Promise<FotoPreparate> {
  const cv = quadrato(img, r);
  const cb = quadrato(img, ritaglioBusto(r, img.width, img.height));
  const scala = Math.min(1, LATO_MAX_INTERA / Math.max(img.width, img.height));
  const ci = document.createElement('canvas');
  ci.width = Math.round(img.width * scala);
  ci.height = Math.round(img.height * scala);
  ci.getContext('2d')!.drawImage(img, 0, 0, ci.width, ci.height);
  return { volto: await jpegLeggero(cv), busto: await jpegLeggero(cb), intera: await jpegLeggero(ci), mini: await creaMiniatura(img, r) };
}

/** Carica con nomi nuovi ogni volta, così i link vecchi non mostrano la foto precedente. */
export interface PercorsiFoto {
  volto: string;
  busto: string;
  intera: string;
  mini: string;
}

export async function caricaFoto(atletaId: string, foto: FotoPreparate): Promise<PercorsiFoto> {
  const t = Date.now();
  const percorsi: PercorsiFoto = {
    volto: `${atletaId}/${t}-volto.jpg`,
    busto: `${atletaId}/${t}-busto.jpg`,
    intera: `${atletaId}/${t}-intera.jpg`,
    mini: `${atletaId}/${t}-mini.jpg`,
  };
  for (const k of ['volto', 'busto', 'intera', 'mini'] as const) {
    // Ogni caricamento ha un nome nuovo e il file non cambia più: il browser può tenerlo a lungo.
    const { error } = await supabase.storage.from('foto-atleti').upload(percorsi[k], foto[k], { contentType: 'image/jpeg', cacheControl: '31536000' });
    if (error) throw error;
  }
  return percorsi;
}

export async function eliminaFoto(paths: (string | null | undefined)[]) {
  const daTogliere = paths.filter((p): p is string => !!p);
  if (daTogliere.length) await supabase.storage.from('foto-atleti').remove(daTogliere);
}

export async function impostaFotoAtleta(atletaId: string, p: PercorsiFoto | null) {
  const { error } = await supabase
    .from('roster')
    .update({ foto_path: p?.volto ?? null, foto_busto_path: p?.busto ?? null, foto_intera_path: p?.intera ?? null, foto_mini_path: p?.mini ?? null })
    .eq('id', atletaId);
  if (error) throw error;
}
