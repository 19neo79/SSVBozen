import type { RosterPlayer } from '../types/database';
import { isoToItalian, todayISO } from './dates';
import { playerCategory } from './categoria';
import { indirizzoCompleto } from './indirizzi';

export type GruppoDati = 'anagrafica' | 'codiceFiscale' | 'residenza' | 'contattiAtleta' | 'genitori' | 'certificato' | 'squadra';

export const GRUPPI_DATI: { id: GruppoDati; label: string }[] = [
  { id: 'anagrafica', label: 'Data e luogo di nascita' },
  { id: 'codiceFiscale', label: 'Codice fiscale' },
  { id: 'residenza', label: 'Residenza' },
  { id: 'contattiAtleta', label: 'Cellulare atleta' },
  { id: 'genitori', label: 'Genitori e telefoni' },
  { id: 'certificato', label: 'Certificato medico' },
  { id: 'squadra', label: 'Categoria, maglia e ruolo' },
];

export function categoriaAtleta(p: RosterPlayer): string {
  const c = playerCategory(p.data_nascita);
  if (c === 'U14' && p.solo_u15) return 'U14 (gioca in U15)';
  return c || '';
}

const sesso = (s: string | null) => (s === 'M' ? 'Maschio' : s === 'F' ? 'Femmina' : '');

/** Colonne per l'Excel, nell'ordine in cui compaiono; vuote se il gruppo non è scelto. */
function colonne(gruppi: Set<GruppoDati>): { titolo: string; valore: (p: RosterPlayer) => string | number }[] {
  const c: { titolo: string; valore: (p: RosterPlayer) => string | number }[] = [
    { titolo: 'Cognome', valore: (p) => p.cognome },
    { titolo: 'Nome', valore: (p) => p.nome },
  ];
  if (gruppi.has('squadra')) {
    c.push({ titolo: 'Categoria', valore: categoriaAtleta });
    c.push({ titolo: 'N. maglia', valore: (p) => p.numero ?? '' });
    c.push({ titolo: 'Ruolo', valore: (p) => p.ruolo || '' });
  }
  if (gruppi.has('anagrafica')) {
    c.push({ titolo: 'Data di nascita', valore: (p) => isoToItalian(p.data_nascita) });
    c.push({ titolo: 'Luogo di nascita', valore: (p) => p.luogo_nascita || '' });
    c.push({ titolo: 'Sesso', valore: (p) => sesso(p.sesso) });
  }
  if (gruppi.has('codiceFiscale')) c.push({ titolo: 'Codice fiscale', valore: (p) => p.codice_fiscale || '' });
  if (gruppi.has('residenza')) {
    c.push({ titolo: 'Via', valore: (p) => p.indirizzo_via || '' });
    c.push({ titolo: 'Civico', valore: (p) => p.indirizzo_civico || '' });
    c.push({ titolo: 'CAP', valore: (p) => p.indirizzo_cap || '' });
    c.push({ titolo: 'Comune', valore: (p) => p.indirizzo_comune || '' });
  }
  if (gruppi.has('contattiAtleta')) c.push({ titolo: 'Cellulare atleta', valore: (p) => p.telefono_atleta || '' });
  if (gruppi.has('genitori')) {
    c.push({ titolo: 'Nome papà', valore: (p) => p.nome_papa || '' });
    c.push({ titolo: 'Telefono papà', valore: (p) => p.telefono_papa || '' });
    c.push({ titolo: 'Nome mamma', valore: (p) => p.nome_mamma || '' });
    c.push({ titolo: 'Telefono mamma', valore: (p) => p.telefono_mamma || '' });
  }
  if (gruppi.has('certificato')) c.push({ titolo: 'Scadenza certificato medico', valore: (p) => isoToItalian(p.certificato) });
  return c;
}

export async function scaricaExcelAtleti(atleti: RosterPlayer[], gruppi: Set<GruppoDati>) {
  const XLSX = await import('xlsx');
  const cols = colonne(gruppi);
  const righe = [cols.map((c) => c.titolo), ...atleti.map((p) => cols.map((c) => c.valore(p)))];
  const foglio = XLSX.utils.aoa_to_sheet(righe);
  foglio['!cols'] = cols.map((c) => ({ wch: Math.max(c.titolo.length + 2, ...atleti.map((p) => String(c.valore(p)).length + 2), 10) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, foglio, 'Atleti');
  const nome = atleti.length === 1 ? `${atleti[0].cognome}_${atleti[0].nome}`.replace(/[^\w]+/g, '_') : `${atleti.length}_atleti`;
  XLSX.writeFile(wb, `Dati_${nome}_${todayISO()}.xlsx`);
}

/** Testo pronto per WhatsApp: nome in grassetto (*...*), una riga per dato, solo i dati presenti. */
export function testoWhatsAppAtleti(atleti: RosterPlayer[], gruppi: Set<GruppoDati>): string {
  return atleti
    .map((p) => {
      const righe = [`*${p.cognome} ${p.nome}*`];
      if (gruppi.has('squadra')) {
        const sq = [categoriaAtleta(p), p.numero != null ? `maglia ${p.numero}` : '', p.ruolo || ''].filter(Boolean).join(' · ');
        if (sq) righe.push(sq);
      }
      if (gruppi.has('anagrafica') && (p.data_nascita || p.luogo_nascita)) {
        const nato = p.sesso === 'F' ? 'Nata' : 'Nato';
        righe.push([`${nato}${p.data_nascita ? ` il ${isoToItalian(p.data_nascita)}` : ''}`, p.luogo_nascita ? `a ${p.luogo_nascita}` : ''].filter(Boolean).join(' '));
      }
      if (gruppi.has('codiceFiscale') && p.codice_fiscale) righe.push(`CF: ${p.codice_fiscale}`);
      if (gruppi.has('residenza') && indirizzoCompleto(p)) righe.push(`Residenza: ${indirizzoCompleto(p)}`);
      if (gruppi.has('contattiAtleta') && p.telefono_atleta) righe.push(`Cellulare: ${p.telefono_atleta}`);
      if (gruppi.has('genitori')) {
        if (p.nome_papa || p.telefono_papa) righe.push(`Papà: ${[p.nome_papa, p.telefono_papa].filter(Boolean).join(' · ')}`);
        if (p.nome_mamma || p.telefono_mamma) righe.push(`Mamma: ${[p.nome_mamma, p.telefono_mamma].filter(Boolean).join(' · ')}`);
      }
      if (gruppi.has('certificato') && p.certificato) righe.push(`Certificato medico: scade il ${isoToItalian(p.certificato)}`);
      return righe.join('\n');
    })
    .join('\n\n');
}
