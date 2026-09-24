export type Sesso = 'M' | 'F';

export interface Comune {
  cc: string;
  prov: string;
  nome: string;
  attivo: boolean;
  label: string;
}

const MONTH_LETTERS = 'ABCDEHLMPRST';
const VOWELS = 'AEIOU';

const ODD_VALUES: Record<string, number> = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

function evenValue(ch: string): number {
  return /[0-9]/.test(ch) ? Number(ch) : ch.charCodeAt(0) - 65;
}

function onlyLetters(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

function split(letters: string): { consonants: string; vowels: string } {
  let consonants = '';
  let vowels = '';
  for (const ch of letters) {
    if (VOWELS.includes(ch)) vowels += ch;
    else consonants += ch;
  }
  return { consonants, vowels };
}

function surnameCode(cognome: string): string {
  const { consonants, vowels } = split(onlyLetters(cognome));
  return (consonants + vowels + 'XXX').slice(0, 3);
}

function nameCode(nome: string): string {
  const { consonants, vowels } = split(onlyLetters(nome));
  if (consonants.length >= 4) return consonants[0] + consonants[2] + consonants[3];
  return (consonants + vowels + 'XXX').slice(0, 3);
}

function checkChar(fifteen: string): string {
  let sum = 0;
  for (let i = 0; i < fifteen.length; i++) {
    const ch = fifteen[i];
    sum += i % 2 === 0 ? ODD_VALUES[ch] : evenValue(ch);
  }
  return String.fromCharCode(65 + (sum % 26));
}

export interface CfInput {
  nome: string;
  cognome: string;
  dataNascita: string;
  sesso: Sesso;
  codiceCatastale: string;
}

/** Codice fiscale calcolato, oppure null se i dati non sono sufficienti/validi. */
export function calcolaCodiceFiscale(input: CfInput): string | null {
  const { nome, cognome, dataNascita, sesso, codiceCatastale } = input;
  if (!onlyLetters(nome) || !onlyLetters(cognome)) return null;
  if (!/^[A-Z]\d{3}$/.test(codiceCatastale)) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataNascita);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;

  const dayCode = String(sesso === 'F' ? day + 40 : day).padStart(2, '0');
  const body =
    surnameCode(cognome) +
    nameCode(nome) +
    String(year).slice(-2) +
    MONTH_LETTERS[month - 1] +
    dayCode +
    codiceCatastale;
  return body + checkChar(body);
}

let comuniCache: Comune[] | null = null;

/** Elenco di comuni italiani (anche soppressi) e stati esteri con codice catastale. Caricato solo al bisogno. */
export async function caricaComuni(): Promise<Comune[]> {
  if (comuniCache) return comuniCache;
  const mod = await import('codice-fiscale-js/src/lista-comuni.js');
  const rows = mod.COMUNI as [string, string, string, number][];
  comuniCache = rows.map(([cc, prov, nome, attivo]) => {
    const estero = prov === 'EE';
    const suffix = estero ? ' (Estero)' : ` (${prov})`;
    return {
      cc,
      prov,
      nome,
      attivo: attivo === 1,
      label: attivo === 1 ? `${nome}${suffix}` : `${nome}${suffix} · soppresso [${cc}]`,
    };
  });
  return comuniCache;
}

/** Suggerimenti per l'autocompletamento: prima i nomi che iniziano con il testo, poi quelli che lo contengono. */
export function cercaComuni(comuni: Comune[], query: string, limit = 40): Comune[] {
  const q = onlyLetters(query) ? query.trim().toUpperCase() : '';
  if (q.length < 2) return [];
  const starts: Comune[] = [];
  const contains: Comune[] = [];
  for (const c of comuni) {
    if (c.nome.startsWith(q)) starts.push(c);
    else if (c.nome.includes(q)) contains.push(c);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
