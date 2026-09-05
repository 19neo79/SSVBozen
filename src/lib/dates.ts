export function todayISO(): string {
  return fmtISODate(new Date());
}

export function parseDateLocal(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function fmtISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = parseDateLocal(iso);
  const s = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtDateShort(iso: string): string {
  if (!iso) return '';
  const d = parseDateLocal(iso);
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

export function dayLabelShort(iso: string): string {
  const d = parseDateLocal(iso);
  const s = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Restituisce le 7 date ISO (lun..dom) della settimana che contiene dateStr. */
export function weekRangeFor(dateStr: string): string[] {
  const d = parseDateLocal(dateStr);
  const day = d.getDay(); // 0=dom..6=sab
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    days.push(fmtISODate(dd));
  }
  return days;
}

export function isoToItalian(iso: string | null | undefined): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

const MESI_IT: Record<string, number> = {
  gen: 1, gennaio: 1, feb: 2, febbraio: 2, mar: 3, marzo: 3, apr: 4, aprile: 4,
  mag: 5, maggio: 5, giu: 6, giugno: 6, lug: 7, luglio: 7, ago: 8, agosto: 8,
  set: 9, settembre: 9, ott: 10, ottobre: 10, nov: 11, novembre: 11, dic: 12, dicembre: 12,
};

/** Normalizza date in vari formati (gg/mm/aaaa, seriale Excel, mese in lettere...) a ISO aaaa-mm-gg. */
export function normalizeDateInput(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  let str = raw.toString().trim();
  if (!str) return '';
  str = str.replace(/[T ]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?Z?$/, '').trim();

  let m = str.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;

  m = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;

  m = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/);
  if (m) {
    const yy = parseInt(m[3], 10);
    const yyyy = yy <= 50 ? 2000 + yy : 1900 + yy;
    return `${yyyy}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  m = str.match(/^(\d{1,2})[\s/\-.]+([a-zàèéìòù]+)[\s/\-.]+(\d{2,4})$/i);
  if (m) {
    const mese = MESI_IT[m[2].toLowerCase()];
    if (mese) {
      const yyyy =
        m[3].length === 2
          ? parseInt(m[3], 10) <= 50
            ? 2000 + parseInt(m[3], 10)
            : 1900 + parseInt(m[3], 10)
          : parseInt(m[3], 10);
      return `${yyyy}-${String(mese).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
  }

  if (/^\d{4,6}$/.test(str)) {
    const serial = parseInt(str, 10);
    const epoch = Date.UTC(1899, 11, 30);
    const d = new Date(epoch + serial * 86400000);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getUTCFullYear();
      if (yyyy > 1900 && yyyy < 2100) {
        return `${yyyy}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      }
    }
  }

  return '';
}
