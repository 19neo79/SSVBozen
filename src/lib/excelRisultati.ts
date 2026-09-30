import { fmtDateShort, todayISO } from './dates';
import { perc, puntiFipav, type Bilancio, type RisultatiStats } from './statsRisultati';

type Row = (string | number)[];

function quoz(n: number, d: number): number | string {
  return d === 0 ? (n > 0 ? '∞' : '') : Math.round((n / d) * 100) / 100;
}

function media(n: number, d: number): number | string {
  return d === 0 ? '' : Math.round((n / d) * 10) / 10;
}

function rigaBilancio(label: string, b: Bilancio): Row {
  return [
    label, b.giocate, b.vinte, b.perse, perc(b.vinte, b.giocate) ?? '',
    b.setVinti, b.setPersi, quoz(b.setVinti, b.setPersi),
    b.setConParziali > 0 ? b.puntiFatti : '', b.setConParziali > 0 ? b.puntiSubiti : '',
    b.setConParziali > 0 ? quoz(b.puntiFatti, b.puntiSubiti) : '',
    media(b.puntiFatti, b.setConParziali), media(b.puntiSubiti, b.setConParziali),
  ];
}

const INTESTAZIONE_BILANCIO = [
  '', 'Giocate', 'Vinte', 'Perse', '% vittorie', 'Set vinti', 'Set persi', 'Quoziente set',
  'Punti fatti', 'Punti subiti', 'Quoziente punti', 'Media punti fatti/set', 'Media punti subiti/set',
];

export async function exportRisultatiToExcel({ clubName, s, filtro }: { clubName: string; s: RisultatiStats; filtro: string }) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const t = s.totale;

  // ---- Riepilogo ----
  const r: Row[] = [];
  r.push([`${clubName} — Statistiche risultati`]);
  r.push([`${filtro} · esportato il ${fmtDateShort(todayISO())}`]);
  r.push([]);
  r.push(['Bilancio']);
  r.push(['Partite giocate', t.giocate]);
  r.push(['Vinte', t.vinte]);
  r.push(['Perse', t.perse]);
  r.push(['% vittorie', perc(t.vinte, t.giocate) ?? '']);
  r.push(['Punti classifica (FIPAV)', s.puntiClassifica]);
  r.push(['Media punti classifica a partita', s.partiteClassifica > 0 ? media(s.puntiClassifica, s.partiteClassifica) : '']);
  r.push(['Striscia attuale', s.strisciaAttuale ? `${s.strisciaAttuale.n} ${s.strisciaAttuale.tipo === 'V' ? 'vittorie' : 'sconfitte'}` : '']);
  r.push(['Record vittorie di fila', s.migliorStrisciaV]);
  r.push(['Record sconfitte di fila', s.peggiorStrisciaP]);
  r.push([]);
  r.push(['Set']);
  r.push(['Set vinti', t.setVinti]);
  r.push(['Set persi', t.setPersi]);
  r.push(['Quoziente set', quoz(t.setVinti, t.setPersi)]);
  r.push(['% set vinti', perc(t.setVinti, t.setVinti + t.setPersi) ?? '']);
  r.push([]);
  r.push(['Punti', `(su ${s.partiteConParziali} partite con parziali)`]);
  r.push(['Punti fatti', t.puntiFatti]);
  r.push(['Punti subiti', t.puntiSubiti]);
  r.push(['Quoziente punti', quoz(t.puntiFatti, t.puntiSubiti)]);
  r.push(['Media punti fatti per set', media(t.puntiFatti, t.setConParziali)]);
  r.push(['Media punti subiti per set', media(t.puntiSubiti, t.setConParziali)]);
  r.push(['Differenza punti', t.puntiFatti - t.puntiSubiti]);
  r.push([]);
  r.push(['Distribuzione dei risultati']);
  s.distribuzione.forEach((d) => r.push([`${d.vinta ? 'Vinta' : 'Persa'} ${d.risultato}`, d.n]));
  if (s.altriRisultati > 0) r.push(['Altri risultati', s.altriRisultati]);
  r.push([]);
  r.push(['Rendimento set per set', 'Giocati', 'Vinti', '% vinti']);
  s.perSet.filter((x) => x.giocati > 0).forEach((x) => r.push([x.numero === 5 ? 'Tie-break' : `${x.numero}° set`, x.giocati, x.vinti, perc(x.vinti, x.giocati) ?? '']));
  r.push([]);
  r.push(['Momenti chiave', 'Vinte/vinti', 'Su']);
  r.push(['Partite vinte dopo aver vinto il 1° set', s.primoSetVinto.vinte, s.primoSetVinto.partite]);
  r.push(['Rimonte (vinte dopo aver perso il 1° set)', s.primoSetPerso.vinte, s.primoSetPerso.partite]);
  r.push(['Tie-break vinti', s.tieBreak.vinti, s.tieBreak.giocati]);
  r.push(['Set ai vantaggi vinti (oltre 25, 15 al tie-break)', s.vantaggi.vinti, s.vantaggi.giocati]);
  r.push(['Set punto a punto vinti (scarto ≤ 3)', s.puntoAPunto.vinti, s.puntoAPunto.giocati]);
  r.push(['Scarto medio set vinti', s.scartoMedioVinti !== null ? Math.round(s.scartoMedioVinti * 10) / 10 : '']);
  r.push(['Scarto medio set persi', s.scartoMedioPersi !== null ? Math.round(s.scartoMedioPersi * 10) / 10 : '']);
  if (s.migliorSet) r.push(['Set più netto vinto', `${s.migliorSet.set.noi}-${s.migliorSet.set.loro}`, `vs ${s.migliorSet.match.avversario} · ${fmtDateShort(s.migliorSet.match.data)}`]);
  if (s.peggiorSet) r.push(['Set più netto perso', `${s.peggiorSet.set.noi}-${s.peggiorSet.set.loro}`, `vs ${s.peggiorSet.match.avversario} · ${fmtDateShort(s.peggiorSet.match.data)}`]);
  const riepilogo = XLSX.utils.aoa_to_sheet(r);
  riepilogo['!cols'] = [{ wch: 46 }, { wch: 14 }, { wch: 30 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, riepilogo, 'Riepilogo');

  // ---- Partite ----
  const p: Row[] = [[
    'Data', 'Ora', 'Categoria', 'Casa/Trasferta', 'Avversario', 'Amichevole', 'N. Gara FIPAV',
    'Set SSV', 'Set avversario', 'Esito', 'Punti classifica',
    'Set 1', 'Set 2', 'Set 3', 'Set 4', 'Set 5', 'Punti fatti', 'Punti subiti',
  ]];
  s.partite.forEach(({ match: m, noi, loro, vinta, persa }) => {
    const parziali = m.parziali || [];
    const set = [0, 1, 2, 3, 4].map((i) => (parziali[i] ? `${parziali[i].noi}-${parziali[i].loro}` : ''));
    p.push([
      fmtDateShort(m.data), m.orario, m.categoria, m.casa_trasferta, m.avversario, m.amichevole ? 'Sì' : '', m.numero_gara_fipav || '',
      noi, loro, vinta ? 'Vinta' : persa ? 'Persa' : 'Pari', puntiFipav(noi, loro) ?? '',
      ...set,
      parziali.length > 0 ? parziali.reduce((a, x) => a + x.noi, 0) : '',
      parziali.length > 0 ? parziali.reduce((a, x) => a + x.loro, 0) : '',
    ]);
  });
  const partite = XLSX.utils.aoa_to_sheet(p);
  partite['!cols'] = [
    { wch: 11 }, { wch: 7 }, { wch: 9 }, { wch: 13 }, { wch: 28 }, { wch: 10 }, { wch: 13 },
    { wch: 8 }, { wch: 13 }, { wch: 7 }, { wch: 14 },
    { wch: 7 }, { wch: 7 }, { wch: 7 }, { wch: 7 }, { wch: 7 }, { wch: 11 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, partite, 'Partite');

  // ---- Contesto ----
  const c: Row[] = [INTESTAZIONE_BILANCIO];
  c.push(rigaBilancio('Totale', t));
  if (s.casa.giocate > 0) c.push(rigaBilancio('Casa', s.casa));
  if (s.trasferta.giocate > 0) c.push(rigaBilancio('Trasferta', s.trasferta));
  if (s.perCategoria.U14.giocate > 0) c.push(rigaBilancio('Under 14', s.perCategoria.U14));
  if (s.perCategoria.U15.giocate > 0) c.push(rigaBilancio('Under 15', s.perCategoria.U15));
  const contesto = XLSX.utils.aoa_to_sheet(c);
  contesto['!cols'] = [{ wch: 12 }, ...INTESTAZIONE_BILANCIO.slice(1).map((h) => ({ wch: Math.max(9, h.length + 1) }))];
  XLSX.utils.book_append_sheet(wb, contesto, 'Per contesto');

  // ---- Scontri diretti ----
  const a: Row[] = [['Avversario', 'Categoria', ...INTESTAZIONE_BILANCIO.slice(1)]];
  s.perAvversario.forEach((x) => {
    const [, ...resto] = rigaBilancio(x.nome, x);
    a.push([x.nome, x.categoria, ...resto]);
  });
  const avversari = XLSX.utils.aoa_to_sheet(a);
  avversari['!cols'] = [{ wch: 28 }, { wch: 10 }, ...INTESTAZIONE_BILANCIO.slice(1).map((h) => ({ wch: Math.max(9, h.length + 1) }))];
  XLSX.utils.book_append_sheet(wb, avversari, 'Scontri diretti');

  const safeClub = clubName.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const safeFiltro = filtro.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  XLSX.writeFile(wb, `Risultati_${safeClub}_${safeFiltro}_${todayISO()}.xlsx`);
}
