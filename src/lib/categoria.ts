import type { Categoria } from '../types/database';

const U15_BIRTH_YEAR = 2012;
const U14_BIRTH_YEARS = [2013, 2014, 2015];

function birthYear(dataNascita: string | null): number | null {
  if (!dataNascita) return null;
  const year = parseInt(dataNascita.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

/**
 * Categoria anagrafica del giocatore: i nati 2012 sono U15, i nati 2013-2015
 * sono U14. Null se la data di nascita manca o cade fuori da queste annate.
 */
export function playerCategory(dataNascita: string | null): Categoria | null {
  const year = birthYear(dataNascita);
  if (year === U15_BIRTH_YEAR) return 'U15';
  if (year !== null && U14_BIRTH_YEARS.includes(year)) return 'U14';
  return null;
}

/**
 * Un U14 (2013-2015) può sempre giocare anche in U15, ma un nato 2012 non
 * può scendere in U14. Un giocatore senza data di nascita non viene bloccato.
 */
export function isEligibleForCategoria(dataNascita: string | null, categoria: Categoria): boolean {
  if (categoria === 'U15') return true;
  return birthYear(dataNascita) !== U15_BIRTH_YEAR;
}
