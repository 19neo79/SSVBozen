import { supabase } from './supabase';

const LATO = 512;

/** Ritaglia al centro un quadrato, lo riduce a 512px e lo comprime in JPEG (circa 50–100 KB). */
export async function preparaFoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const lato = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = LATO;
  canvas.height = LATO;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, (bitmap.width - lato) / 2, (bitmap.height - lato) / 2, lato, lato, 0, 0, LATO, LATO);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Conversione non riuscita'))), 'image/jpeg', 0.85);
  });
}

/** Carica la foto con un nome nuovo ogni volta, così i link vecchi non mostrano la foto precedente. */
export async function caricaFoto(atletaId: string, foto: Blob): Promise<string> {
  const path = `${atletaId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('foto-atleti').upload(path, foto, { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

export async function eliminaFoto(path: string) {
  await supabase.storage.from('foto-atleti').remove([path]);
}

export async function impostaFotoAtleta(atletaId: string, path: string | null) {
  const { error } = await supabase.from('roster').update({ foto_path: path }).eq('id', atletaId);
  if (error) throw error;
}
