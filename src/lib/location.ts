export interface Locatable {
  id: string;
  nome: string;
  indirizzo?: string | null;
  cap?: string | null;
  citta?: string | null;
  provincia?: string | null;
}

export interface ResolvedLocation {
  label: string;
  mapsUrl: string | null;
}

export function mapsUrlForVenue(v: Locatable): string {
  const addr = [v.indirizzo, v.cap, v.citta, v.provincia].filter(Boolean).join(', ');
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr || v.nome);
}

export function mapsUrlForText(text: string): string {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(text);
}

/**
 * Risolve un venueId (che punta a venues O a campi_avversari) o un testo libero
 * in un'etichetta leggibile + link Maps. `locatables` deve contenere sia le palestre
 * sia i campi degli avversari (id univoci tra i due insiemi).
 */
export function resolveLocation(
  venueId: string | null | undefined,
  customText: string | null | undefined,
  locatables: Locatable[]
): ResolvedLocation {
  if (venueId) {
    const found = locatables.find((x) => x.id === venueId);
    if (found) return { label: found.nome, mapsUrl: mapsUrlForVenue(found) };
  }
  if (customText) return { label: customText, mapsUrl: mapsUrlForText(customText) };
  return { label: '—', mapsUrl: null };
}
