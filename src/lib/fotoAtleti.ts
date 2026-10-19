import type { FaceDetector } from '@mediapipe/tasks-vision';
import { supabase } from './supabase';

/** Quadrato da ritagliare, in pixel dell'immagine originale. */
export interface Ritaglio {
  x: number;
  y: number;
  lato: number;
}

const LATO_VOLTO = 512;
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

/** Crea le due versioni: viso quadrato per elenco e miniature, foto intera ridotta per la scheda. */
export async function creaFoto(img: ImageBitmap, r: Ritaglio): Promise<{ volto: Blob; intera: Blob }> {
  const cv = document.createElement('canvas');
  cv.width = LATO_VOLTO;
  cv.height = LATO_VOLTO;
  cv.getContext('2d')!.drawImage(img, r.x, r.y, r.lato, r.lato, 0, 0, LATO_VOLTO, LATO_VOLTO);
  const scala = Math.min(1, LATO_MAX_INTERA / Math.max(img.width, img.height));
  const ci = document.createElement('canvas');
  ci.width = Math.round(img.width * scala);
  ci.height = Math.round(img.height * scala);
  ci.getContext('2d')!.drawImage(img, 0, 0, ci.width, ci.height);
  return { volto: await jpegLeggero(cv), intera: await jpegLeggero(ci) };
}

/** Carica con nomi nuovi ogni volta, così i link vecchi non mostrano la foto precedente. */
export async function caricaFoto(atletaId: string, foto: { volto: Blob; intera: Blob }): Promise<{ volto: string; intera: string }> {
  const t = Date.now();
  const volto = `${atletaId}/${t}-volto.jpg`;
  const intera = `${atletaId}/${t}-intera.jpg`;
  for (const [path, blob] of [[volto, foto.volto], [intera, foto.intera]] as const) {
    const { error } = await supabase.storage.from('foto-atleti').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw error;
  }
  return { volto, intera };
}

export async function eliminaFoto(paths: (string | null | undefined)[]) {
  const daTogliere = paths.filter((p): p is string => !!p);
  if (daTogliere.length) await supabase.storage.from('foto-atleti').remove(daTogliere);
}

export async function impostaFotoAtleta(atletaId: string, volto: string | null, intera: string | null) {
  const { error } = await supabase.from('roster').update({ foto_path: volto, foto_intera_path: intera }).eq('id', atletaId);
  if (error) throw error;
}
