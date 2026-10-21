import type { Divisa, GruppoDivisa, RosterPlayer } from '../types/database';
import { isoToItalian, todayISO } from './dates';
import { COLONNE_RIEPILOGO, GRUPPI_DIVISA, etichettaGruppo, nomeGiocatore, ordinaDivise, riepilogo } from './divise';

/** Gruppi nell'ordine di stampa: U17, U14-15, U12-13, poi da assegnare. */
const ORDINE: (GruppoDivisa | null)[] = [...GRUPPI_DIVISA, null];

export function filtraPerGruppi(d: Divisa[], gruppi: Set<GruppoDivisa | null>): Divisa[] {
  return d.filter((x) => gruppi.has(x.gruppo));
}

function giocatoreTesto(x: Divisa, rosa: RosterPlayer[]): string {
  const { nome, fuoriRosa } = nomeGiocatore(x, rosa);
  if (!nome) return '';
  return fuoriRosa ? `${nome} (non più in rosa)` : nome;
}

/** Testo per WhatsApp: titolo in grassetto, un blocco per gruppo, una riga per divisa. */
export function testoWhatsAppDivise(d: Divisa[], rosa: RosterPlayer[], gruppi: Set<GruppoDivisa | null>): string {
  const righe = [`*Divise SSV Bozen Maschile* · ${isoToItalian(todayISO())}`];
  for (const g of ORDINE) {
    if (!gruppi.has(g)) continue;
    const delGruppo = ordinaDivise(d.filter((x) => x.gruppo === g));
    righe.push('', `*${etichettaGruppo(g)}* (${delGruppo.length})`);
    if (!delGruppo.length) righe.push('nessuna divisa');
    for (const x of delGruppo) {
      const parti = [String(x.numero), x.taglia];
      if (x.libero) parti.push('LIBERO');
      parti.push(giocatoreTesto(x, rosa) || 'libera');
      righe.push(parti.join(' · ') + (x.note?.trim() ? ` — ${x.note.trim()}` : ''));
    }
  }
  return righe.join('\n');
}

export async function scaricaExcelDivise(d: Divisa[], rosa: RosterPlayer[], gruppi: Set<GruppoDivisa | null>) {
  const XLSX = await import('xlsx');
  const scelte = ordinaDivise(filtraPerGruppi(d, gruppi));

  const intestazione = ['Gruppo', 'Numero', 'Taglia', 'Libero', 'Giocatore', 'In rosa', 'Note'];
  const elenco = scelte.map((x) => {
    const { nome, fuoriRosa } = nomeGiocatore(x, rosa);
    return [etichettaGruppo(x.gruppo), x.numero, x.taglia, x.libero ? 'Sì' : 'No', nome || '', x.roster_id ? (fuoriRosa ? 'No' : 'Sì') : '', x.note || ''];
  });
  const foglioDivise = XLSX.utils.aoa_to_sheet([intestazione, ...elenco]);
  foglioDivise['!cols'] = intestazione.map((t, i) => ({ wch: Math.max(t.length + 2, ...elenco.map((r) => String(r[i]).length + 2), 8) }));

  const r = riepilogo(scelte);
  const titoloCol = (c: (typeof COLONNE_RIEPILOGO)[number]) => (c === 'nessuno' ? 'Da assegnare' : c === 'totale' ? 'Totale' : c);
  const testa = ['Taglia', ...COLONNE_RIEPILOGO.flatMap((c) => [titoloCol(c), 'di cui libero'])];
  const riga = (nome: string, celle: (typeof r.totali)) => [nome, ...COLONNE_RIEPILOGO.flatMap((c) => [celle[c].totale, celle[c].libero])];
  const foglioRiepilogo = XLSX.utils.aoa_to_sheet([testa, ...r.righe.map((x) => riga(x.taglia, x.celle)), riga('Totale', r.totali)]);
  foglioRiepilogo['!cols'] = testa.map((t) => ({ wch: Math.max(t.length + 2, 8) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, foglioDivise, 'Divise');
  XLSX.utils.book_append_sheet(wb, foglioRiepilogo, 'Riepilogo');
  const nomeGruppi = gruppi.size === ORDINE.length ? 'Tutte' : ORDINE.filter((g) => gruppi.has(g)).map((g) => etichettaGruppo(g).replace(/\s+/g, '')).join('_');
  XLSX.writeFile(wb, `Divise_${nomeGruppi}_${todayISO()}.xlsx`);
}
