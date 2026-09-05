/**
 * Legge un file CSV gestendo codifiche diverse da UTF-8. Excel/Numbers su alcune
 * configurazioni esportano CSV in Windows-1252/Latin-1: decodificando quei byte
 * come UTF-8 le lettere accentate (es. "à" in "papà") diventano caratteri
 * corrotti e le intestazioni non vengono più riconosciute. Se la decodifica
 * UTF-8 produce caratteri non validi, si riprova con Windows-1252.
 */
export async function readCsvFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  if (!utf8.includes('�')) return utf8;
  try {
    return new TextDecoder('windows-1252', { fatal: false }).decode(buffer);
  } catch {
    return utf8;
  }
}

export function normalizeHeader(h: string): string {
  return (h || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function detectDelimiter(line: string): string {
  return line.split(';').length > line.split(',').length ? ';' : ',';
}

export function parseCSVLine(line: string, delim: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delim) {
        result.push(cur);
        cur = '';
      } else cur += ch;
    }
  }
  result.push(cur);
  return result;
}

export function csvEscape(val: unknown): string {
  const s = val === null || val === undefined ? '' : String(val);
  if (/[;"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function downloadCSV(filename: string, headers: string[], rows: unknown[][]): void {
  const lines = [headers.join(';')].concat(rows.map((r) => r.map(csvEscape).join(';')));
  const csv = lines.join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ParsedCSV {
  fieldMap: (string | null)[];
  dataLines: string[];
  delim: string;
}

/** Legge le righe del CSV e mappa le intestazioni secondo headerMap (chiave normalizzata -> campo). */
export function parseCSVWithHeaderMap(text: string, headerMap: Record<string, string>): ParsedCSV | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;
  const delim = detectDelimiter(lines[0]);
  const headers = parseCSVLine(lines[0], delim).map(normalizeHeader);
  const fieldMap = headers.map((h) => headerMap[h] || null);
  return { fieldMap, dataLines: lines.slice(1), delim };
}

export function rowToRecord(row: string, delim: string, fieldMap: (string | null)[]): Record<string, string> {
  const cols = parseCSVLine(row, delim);
  const rec: Record<string, string> = {};
  fieldMap.forEach((field, idx) => {
    if (field) rec[field] = (cols[idx] || '').trim();
  });
  return rec;
}
