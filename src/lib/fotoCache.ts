/**
 * Link firmati alle foto degli atleti, ricordati sul dispositivo per 24 ore.
 * Finché il link resta lo stesso il browser tiene la foto in memoria e non la riscarica a ogni apertura.
 */
export const DURATA_URL_SEC = 24 * 60 * 60;
const MARGINE_MS = 60 * 60 * 1000;
const CHIAVE = 'ssv-foto-url';

export interface VoceUrl {
  url: string;
  scade: number;
}
export type CacheUrl = Record<string, VoceUrl>;

/** Link già pronti (validi ancora per più di un'ora) e percorsi per cui chiederne uno nuovo. */
export function dividiPercorsi(cache: CacheUrl, percorsi: string[], ora: number): { pronti: Record<string, string>; daChiedere: string[] } {
  const pronti: Record<string, string> = {};
  const daChiedere: string[] = [];
  for (const p of percorsi) {
    const v = cache[p];
    if (v && v.scade - ora > MARGINE_MS) pronti[p] = v.url;
    else daChiedere.push(p);
  }
  return { pronti, daChiedere };
}

export function aggiornaCache(cache: CacheUrl, nuovi: { path: string; url: string }[], ora: number): CacheUrl {
  const tenuti = Object.fromEntries(Object.entries(cache).filter(([, v]) => v.scade > ora));
  for (const n of nuovi) tenuti[n.path] = { url: n.url, scade: ora + DURATA_URL_SEC * 1000 };
  return tenuti;
}

export function leggiCache(): CacheUrl {
  try {
    return JSON.parse(localStorage.getItem(CHIAVE) || '{}') as CacheUrl;
  } catch {
    return {};
  }
}

export function scriviCache(cache: CacheUrl) {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(cache));
  } catch {
    // Spazio pieno o navigazione privata: si richiederanno i link la prossima volta.
  }
}

/** All'uscita dall'app i link non restano sul dispositivo. */
export function svuotaCache() {
  try {
    localStorage.removeItem(CHIAVE);
  } catch {
    // niente da fare
  }
}
