import type { Divisa, GruppoDivisa, RosterPlayer } from '../types/database';
import { isoToItalian, todayISO } from './dates';
import { COLONNE_RIEPILOGO, GRUPPI_DIVISA, dataConsegna, dataOraConsegna, etichettaGruppo, nomeGiocatore, ordinaDivise, riepilogo } from './divise';

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
  const scelte = filtraPerGruppi(d, gruppi);
  const pantaloncini = (l: Divisa[]) => l.filter((x) => x.pantaloncino).length;
  const righe = [`*Divise SSV Bozen Maschile* · ${isoToItalian(todayISO())}`, `Maglie ${scelte.length} · Pantaloncini ${pantaloncini(scelte)}`];
  for (const g of ORDINE) {
    if (!gruppi.has(g)) continue;
    const delGruppo = ordinaDivise(d.filter((x) => x.gruppo === g));
    righe.push('', `*${etichettaGruppo(g)}* (${delGruppo.length} maglie, ${pantaloncini(delGruppo)} pantaloncini)`);
    if (!delGruppo.length) righe.push('nessuna divisa');
    for (const x of delGruppo) {
      const parti = [String(x.numero), x.taglia];
      if (x.libero) parti.push('LIBERO');
      parti.push(giocatoreTesto(x, rosa) || 'libera');
      if (x.giocatore_nome && x.consegnata_il) parti.push(`consegnata ${dataConsegna(x.consegnata_il).slice(0, 5)}`);
      if (!x.pantaloncino) parti.push('senza pantaloncino');
      righe.push(parti.join(' · ') + (x.note?.trim() ? ` — ${x.note.trim()}` : ''));
    }
  }
  return righe.join('\n');
}

export async function scaricaExcelDivise(d: Divisa[], rosa: RosterPlayer[], gruppi: Set<GruppoDivisa | null>) {
  const XLSX = await import('xlsx');
  const scelte = ordinaDivise(filtraPerGruppi(d, gruppi));

  const intestazione = ['Gruppo', 'Numero', 'Taglia', 'Libero', 'Pantaloncino', 'Giocatore', 'In rosa', 'Consegnata il', 'Note'];
  const elenco = scelte.map((x) => {
    const { nome, fuoriRosa } = nomeGiocatore(x, rosa);
    return [etichettaGruppo(x.gruppo), x.numero, x.taglia, x.libero ? 'Sì' : 'No', x.pantaloncino ? 'Sì' : 'No', nome || '', x.roster_id ? (fuoriRosa ? 'No' : 'Sì') : '', x.consegnata_il ? dataOraConsegna(x.consegnata_il).replace(' alle ', ' ') : '', x.note || ''];
  });
  const foglioDivise = XLSX.utils.aoa_to_sheet([intestazione, ...elenco]);
  foglioDivise['!cols'] = intestazione.map((t, i) => ({ wch: Math.max(t.length + 2, ...elenco.map((r) => String(r[i]).length + 2), 8) }));

  const righeRiepilogo = righeRiepilogoExcel(d, gruppi);
  const foglioRiepilogo = XLSX.utils.aoa_to_sheet(righeRiepilogo);
  foglioRiepilogo['!cols'] = righeRiepilogo[0].map((t) => ({ wch: Math.max(String(t).length + 2, 8) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, foglioDivise, 'Divise');
  XLSX.utils.book_append_sheet(wb, foglioRiepilogo, 'Riepilogo');
  XLSX.writeFile(wb, nomeFileDivise(gruppi));
}

/** Foglio Riepilogo: taglie × gruppi scelti (più il totale): maglie, di cui da libero, e pantaloncini. */
export function righeRiepilogoExcel(d: Divisa[], gruppi: Set<GruppoDivisa | null>): (string | number)[][] {
  const r = riepilogo(filtraPerGruppi(d, gruppi));
  const colonne = COLONNE_RIEPILOGO.filter((c) => c === 'totale' || gruppi.has(c === 'nessuno' ? null : c));
  const titolo = (c: (typeof COLONNE_RIEPILOGO)[number]) => (c === 'nessuno' ? 'Da assegnare' : c === 'totale' ? 'Totale' : c);
  const riga = (nome: string, celle: typeof r.totali) => [nome, ...colonne.flatMap((c) => [celle[c].totale, celle[c].libero, celle[c].pantaloncini])];
  const testa = ['Taglia', ...colonne.flatMap((c) => [`${titolo(c)} maglie`, 'di cui libero', `${titolo(c)} pantaloncini`])];
  return [testa, ...r.righe.map((x) => riga(x.taglia, x.celle)), riga('Totale', r.totali)];
}

export function nomeFileDivise(gruppi: Set<GruppoDivisa | null>): string {
  const nome = gruppi.size === ORDINE.length ? 'Tutte' : ORDINE.filter((g) => gruppi.has(g)).map((g) => etichettaGruppo(g).replace(/\s+/g, '_')).join('_');
  return `Divise_${nome}_${todayISO()}.xlsx`;
}
