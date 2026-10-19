import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUi } from '../contexts/UiContext';
import { useDeletePlayer, useFotoAtleti, useRoster, useSavePlayer, useUpsertManyPlayers } from '../hooks/useRoster';
import { useQueryClient } from '@tanstack/react-query';
import { apriImmagine, caricaFoto, creaFoto, eliminaFoto, impostaFotoAtleta, type Ritaglio } from '../lib/fotoAtleti';
import { RitaglioFoto } from '../components/RitaglioFoto';
import { FotoAtleta } from '../components/ui/FotoAtleta';
import type { RosterPlayer } from '../types/database';
import { CategoriaTag } from '../components/ui/CategoriaTag';
import { EsportaAtleti } from '../components/EsportaAtleti';
import { fmtDateShort, isoToItalian, normalizeDateInput } from '../lib/dates';
import { calcolaCodiceFiscale, caricaComuni, cercaComuni, type Comune, type Sesso } from '../lib/codiceFiscale';
import { COMUNI_AA, caricaVie, cercaVie, indirizzoCompleto, trovaComuneAA, type Via } from '../lib/indirizzi';
import {
  csvEscape,
  downloadCSV,
  detectDelimiter,
  normalizeHeader,
  parseCSVLine,
  readCsvFile,
} from '../lib/csv';

const RUOLI = ['Palleggiatore', 'Opposto', 'Schiacciatore', 'Centrale', 'Libero', 'Universale'];

const CSV_HEADER_MAP: Record<string, string> = {
  nome: 'nome',
  cognome: 'cognome',
  numero: 'numero', nmaglia: 'numero', numeromaglia: 'numero', maglia: 'numero', n: 'numero',
  datadinascita: 'data_nascita', dinascita: 'data_nascita', nascita: 'data_nascita', datanascita: 'data_nascita',
  codicefiscale: 'codice_fiscale', cf: 'codice_fiscale', codfisc: 'codice_fiscale',
  ruolo: 'ruolo',
  telefono: 'telefono_papa', telefonogenitore: 'telefono_papa', contatto: 'telefono_papa',
  cellulareatleta: 'telefono_atleta', telefonoatleta: 'telefono_atleta', cellulare: 'telefono_atleta',
  nomepapa: 'nome_papa', padre: 'nome_papa',
  telefonopapa: 'telefono_papa', cellularepapa: 'telefono_papa', telpapa: 'telefono_papa',
  nomemamma: 'nome_mamma', madre: 'nome_mamma',
  telefonomamma: 'telefono_mamma', cellularemamma: 'telefono_mamma', telmamma: 'telefono_mamma',
  certificato: 'certificato', scadenzacertificato: 'certificato', scadenzacertificatomedico: 'certificato', certificatomedico: 'certificato',
  sesso: 'sesso',
  luogodinascita: 'luogo_nascita', luogonascita: 'luogo_nascita', natoa: 'luogo_nascita',
  comune: 'indirizzo_comune', comuneresidenza: 'indirizzo_comune', citta: 'indirizzo_comune', residenza: 'indirizzo_comune',
  cap: 'indirizzo_cap',
  via: 'indirizzo_via', indirizzo: 'indirizzo_via',
  civico: 'indirizzo_civico', ncivico: 'indirizzo_civico', numerocivico: 'indirizzo_civico',
};

const emptyForm = {
  nome: '', cognome: '', numero: '', data_nascita: '', codice_fiscale: '', ruolo: '',
  telefono_atleta: '', nome_papa: '', telefono_papa: '', nome_mamma: '', telefono_mamma: '', certificato: '',
  solo_u15: false,
  sesso: '' as '' | Sesso, luogo_nascita: '', luogo_nascita_cc: '',
  indirizzo_comune: '', indirizzo_comune_cc: '', indirizzo_cap: '', indirizzo_via: '', indirizzo_civico: '',
};

function certStatus(p: RosterPlayer, today: Date, soon: Date): { label: string; warn: boolean; stato: string; breve: string } {
  if (!p.certificato) return { label: '—', warn: false, stato: 'assente', breve: 'Certificato non inserito' };
  const label = fmtDateShort(p.certificato);
  const cd = new Date(p.certificato + 'T00:00:00');
  if (cd < today) return { label: `Scaduto — ${label}`, warn: true, stato: 'scaduto', breve: `Certificato scaduto il ${label}` };
  if (cd < soon) return { label: `In scadenza — ${label}`, warn: true, stato: 'in-scadenza', breve: `Certificato in scadenza il ${label}` };
  return { label, warn: false, stato: 'valido', breve: `Certificato fino al ${label}` };
}

function eta(dataNascita: string): number {
  const n = new Date(dataNascita + 'T00:00:00');
  const oggi = new Date();
  let anni = oggi.getFullYear() - n.getFullYear();
  if (oggi.getMonth() < n.getMonth() || (oggi.getMonth() === n.getMonth() && oggi.getDate() < n.getDate())) anni--;
  return anni;
}

/** Il primo numero utile: dell'atleta, altrimenti di un genitore (con chi è). */
function contattoPrincipale(p: RosterPlayer): string | null {
  if (p.telefono_atleta) return `Tel. ${p.telefono_atleta}`;
  if (p.telefono_mamma) return `Mamma ${p.telefono_mamma}`;
  if (p.telefono_papa) return `Papà ${p.telefono_papa}`;
  return null;
}

export default function RosterPage() {
  const { isAdmin } = useAuth();
  const { showToast, confirm } = useUi();
  const { data: roster = [] } = useRoster();
  const savePlayer = useSavePlayer();
  const deletePlayer = useDeletePlayer();
  const upsertMany = useUpsertManyPlayers();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [comuni, setComuni] = useState<Comune[]>([]);
  const [cfAuto, setCfAuto] = useState(false);
  const [capAuto, setCapAuto] = useState(false);
  const [vie, setVie] = useState<Via[]>([]);
  const [esportaIniziali, setEsportaIniziali] = useState<string[] | null>(null);
  const [fotoNuova, setFotoNuova] = useState<{ volto: Blob; intera: Blob; url: string } | null>(null);
  const [daRitagliare, setDaRitagliare] = useState<ImageBitmap | null>(null);
  const [fotoRimossa, setFotoRimossa] = useState(false);
  const [fotoInPreparazione, setFotoInPreparazione] = useState(false);
  const qc = useQueryClient();
  const { data: fotoUrls = {} } = useFotoAtleti(roster.flatMap((p) => [p.foto_path, p.foto_intera_path]).filter((x): x is string => !!x));

  useEffect(() => {
    if (formOpen) caricaComuni().then(setComuni).catch(() => showToast('Impossibile caricare l\'elenco dei comuni'));
  }, [formOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggerimenti = useMemo(() => cercaComuni(comuni, form.luogo_nascita), [comuni, form.luogo_nascita]);

  useEffect(() => {
    if (!formOpen) return;
    const prima = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prima; };
  }, [formOpen]);

  const comuneAA = COMUNI_AA.find((c) => c.cc === form.indirizzo_comune_cc);
  useEffect(() => {
    if (!comuneAA) { setVie([]); return; }
    let attivo = true;
    caricaVie(comuneAA.cc).then((v) => { if (attivo) setVie(v); });
    return () => { attivo = false; };
  }, [comuneAA?.cc]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggerimentiComuneResidenza = useMemo(() => {
    const q = form.indirizzo_comune.trim().toLowerCase();
    const aa = COMUNI_AA.filter((c) => !q || c.nome.toLowerCase().includes(q) || c.nomeDe.toLowerCase().includes(q));
    // Fuori provincia: elenco nazionale, solo se il testo non corrisponde già a un comune altoatesino.
    const altri = q.length >= 2 && aa.length === 0
      ? cercaComuni(comuni, form.indirizzo_comune, 20).filter((c) => c.attivo && c.prov !== 'BZ' && c.prov !== 'EE')
      : [];
    return { aa, altri };
  }, [comuni, form.indirizzo_comune]);

  const suggerimentiVia = useMemo(() => cercaVie(vie, form.indirizzo_via), [vie, form.indirizzo_via]);
  const viaInElenco = !form.indirizzo_via.trim() || vie.some((v) => v.n.toLowerCase() === form.indirizzo_via.trim().toLowerCase());

  const cfCalcolato = useMemo(
    () => (form.sesso && form.luogo_nascita_cc
      ? calcolaCodiceFiscale({
        nome: form.nome, cognome: form.cognome, dataNascita: form.data_nascita,
        sesso: form.sesso, codiceCatastale: form.luogo_nascita_cc,
      })
      : null),
    [form.nome, form.cognome, form.data_nascita, form.sesso, form.luogo_nascita_cc],
  );

  useEffect(() => {
    if (!formOpen) return;
    if (cfCalcolato && (form.codice_fiscale === '' || cfAuto)) {
      if (form.codice_fiscale !== cfCalcolato) setForm((f) => ({ ...f, codice_fiscale: cfCalcolato }));
      setCfAuto(true);
    } else if (!cfCalcolato && cfAuto) {
      setForm((f) => ({ ...f, codice_fiscale: '' }));
      setCfAuto(false);
    }
  }, [cfCalcolato]); // eslint-disable-line react-hooks/exhaustive-deps

  async function scegliFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFotoInPreparazione(true);
    try {
      setDaRitagliare(await apriImmagine(file));
    } catch {
      showToast('Impossibile leggere questa immagine: prova con una foto JPEG o PNG');
    } finally {
      setFotoInPreparazione(false);
    }
  }

  /** Rifà il ritaglio partendo dalla foto intera già salvata, senza ricaricarla. */
  async function ritagliaDiNuovo(urlIntera: string) {
    setFotoInPreparazione(true);
    try {
      const blob = await fetch(urlIntera).then((r) => r.blob());
      setDaRitagliare(await apriImmagine(blob));
    } catch {
      showToast('Impossibile aprire la foto salvata');
    } finally {
      setFotoInPreparazione(false);
    }
  }

  async function confermaRitaglio(r: Ritaglio) {
    if (!daRitagliare) return;
    try {
      const { volto, intera } = await creaFoto(daRitagliare, r);
      if (fotoNuova) URL.revokeObjectURL(fotoNuova.url);
      setFotoNuova({ volto, intera, url: URL.createObjectURL(volto) });
      setFotoRimossa(false);
    } catch {
      showToast('Errore nella preparazione della foto');
    }
    chiudiRitaglio();
  }

  function chiudiRitaglio() {
    daRitagliare?.close();
    setDaRitagliare(null);
  }

  function rimuoviFoto() {
    if (fotoNuova) URL.revokeObjectURL(fotoNuova.url);
    setFotoNuova(null);
    setFotoRimossa(true);
  }

  function handleComuneResidenzaChange(value: string) {
    const aa = trovaComuneAA(value);
    if (aa) {
      setForm((f) => ({
        ...f,
        indirizzo_comune: aa.nome,
        indirizzo_comune_cc: aa.cc,
        indirizzo_cap: !f.indirizzo_cap || capAuto || f.indirizzo_comune_cc !== aa.cc ? aa.cap : f.indirizzo_cap,
      }));
      setCapAuto(true);
      return;
    }
    const altro = comuni.find((c) => c.attivo && c.prov !== 'EE' && c.label === value.toUpperCase());
    setForm((f) => ({
      ...f,
      indirizzo_comune: value,
      indirizzo_comune_cc: altro ? altro.cc : '',
      indirizzo_cap: capAuto ? '' : f.indirizzo_cap,
    }));
    if (capAuto) setCapAuto(false);
  }

  function handleLuogoChange(value: string) {
    const match = comuni.find((c) => c.label === value.toUpperCase());
    setForm((f) => ({ ...f, luogo_nascita: value, luogo_nascita_cc: match ? match.cc : '' }));
  }

  const campiMancanti = [
    !form.nome.trim() || !form.cognome.trim() ? 'nome e cognome' : null,
    !form.data_nascita ? 'data di nascita' : null,
    !form.sesso ? 'sesso' : null,
    !form.luogo_nascita_cc ? 'luogo di nascita (scelto dall\'elenco)' : null,
  ].filter(Boolean) as string[];

  function openForm(p?: RosterPlayer) {
    if (p) {
      setEditingId(p.id);
      setForm({
        nome: p.nome || '', cognome: p.cognome || '', numero: p.numero != null ? String(p.numero) : '',
        data_nascita: p.data_nascita || '', codice_fiscale: p.codice_fiscale || '', ruolo: p.ruolo || '',
        telefono_atleta: p.telefono_atleta || '', nome_papa: p.nome_papa || '', telefono_papa: p.telefono_papa || '',
        nome_mamma: p.nome_mamma || '', telefono_mamma: p.telefono_mamma || '', certificato: p.certificato || '',
        solo_u15: p.solo_u15,
        sesso: p.sesso || '', luogo_nascita: p.luogo_nascita || '', luogo_nascita_cc: p.luogo_nascita_cc || '',
        indirizzo_comune: p.indirizzo_comune || '', indirizzo_comune_cc: p.indirizzo_comune_cc || '',
        indirizzo_cap: p.indirizzo_cap || '', indirizzo_via: p.indirizzo_via || '', indirizzo_civico: p.indirizzo_civico || '',
      });
    } else {
      setEditingId(null);
      setForm(emptyForm);
    }
    setCfAuto(false);
    setCapAuto(false);
    if (fotoNuova) URL.revokeObjectURL(fotoNuova.url);
    setFotoNuova(null);
    setFotoRimossa(false);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  async function handleSave() {
    if (!form.nome.trim() || !form.cognome.trim()) {
      showToast('Inserisci almeno nome e cognome');
      return;
    }
    if (form.luogo_nascita.trim() && !form.luogo_nascita_cc) {
      showToast('Scegli il luogo di nascita dall\'elenco dei comuni (o svuota il campo)');
      return;
    }
    if (form.indirizzo_comune.trim() && !form.indirizzo_comune_cc) {
      showToast('Scegli il comune di residenza dall\'elenco (o svuota il campo)');
      return;
    }
    if (form.indirizzo_cap.trim() && !/^\d{5}$/.test(form.indirizzo_cap.trim())) {
      showToast('Il CAP deve avere 5 cifre');
      return;
    }
    const data = {
      nome: form.nome.trim(),
      cognome: form.cognome.trim(),
      numero: form.numero ? parseInt(form.numero, 10) : null,
      data_nascita: form.data_nascita || null,
      codice_fiscale: form.codice_fiscale.trim().toUpperCase() || null,
      ruolo: form.ruolo || null,
      telefono_atleta: form.telefono_atleta.trim() || null,
      nome_papa: form.nome_papa.trim() || null,
      telefono_papa: form.telefono_papa.trim() || null,
      nome_mamma: form.nome_mamma.trim() || null,
      telefono_mamma: form.telefono_mamma.trim() || null,
      certificato: form.certificato || null,
      solo_u15: form.solo_u15,
      sesso: form.sesso || null,
      luogo_nascita: form.luogo_nascita_cc ? form.luogo_nascita.toUpperCase() : null,
      luogo_nascita_cc: form.luogo_nascita_cc || null,
      indirizzo_comune: form.indirizzo_comune_cc ? form.indirizzo_comune.trim() : null,
      indirizzo_comune_cc: form.indirizzo_comune_cc || null,
      indirizzo_cap: form.indirizzo_cap.trim() || null,
      indirizzo_via: form.indirizzo_via.trim() || null,
      indirizzo_civico: form.indirizzo_civico.trim() || null,
    };
    try {
      const id = await savePlayer.mutateAsync({ id: editingId, data });
      const prima = editingId ? roster.find((p) => p.id === editingId) : undefined;
      const vecchie = [prima?.foto_path, prima?.foto_intera_path];
      try {
        if (fotoNuova) {
          const paths = await caricaFoto(id, fotoNuova);
          await impostaFotoAtleta(id, paths.volto, paths.intera);
          await eliminaFoto(vecchie);
        } else if (fotoRimossa && vecchie.some(Boolean)) {
          await impostaFotoAtleta(id, null, null);
          await eliminaFoto(vecchie);
        }
      } catch {
        showToast('Giocatore salvato, ma la foto non è stata caricata: riprova');
        qc.invalidateQueries({ queryKey: ['roster'] });
        return;
      }
      if (fotoNuova || fotoRimossa) qc.invalidateQueries({ queryKey: ['roster'] });
      closeForm();
      showToast('Giocatore salvato');
    } catch {
      showToast('Errore nel salvataggio del giocatore');
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm('Eliminare questo giocatore dalla rosa?');
    if (!ok) return;
    try {
      const atleta = roster.find((p) => p.id === id);
      await deletePlayer.mutateAsync(id);
      await eliminaFoto([atleta?.foto_path, atleta?.foto_intera_path]);
      if (viewingId === id) setViewingId(null);
      showToast('Giocatore eliminato');
    } catch {
      showToast('Errore nella cancellazione');
    }
  }

  function openDetail(id: string) {
    setViewingId(id);
  }

  function closeDetail() {
    setViewingId(null);
  }

  function editFromDetail(p: RosterPlayer) {
    setViewingId(null);
    openForm(p);
  }

  function downloadTemplate() {
    const headers = ['Nome', 'Cognome', 'Numero maglia', 'Data di nascita', 'Codice Fiscale', 'Ruolo', 'Cellulare atleta', 'Nome papà', 'Telefono papà', 'Nome mamma', 'Telefono mamma', 'Scadenza certificato medico', 'Sesso', 'Luogo di nascita', 'Comune', 'CAP', 'Via', 'Civico'];
    const example = ['Mario', 'Rossi', '7', '15/03/2011', 'RSSMRA11C15B563X', 'Schiacciatore', '+39 333 9998877', 'Luca', '+39 333 1234567', 'Anna', '+39 333 7654321', '10/01/2027', 'M', 'BOLZANO (BZ)', 'Bolzano', '39100', 'Via Armando Diaz', '34'];
    const csv = headers.join(';') + '\n' + example.map(csvEscape).join(';');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'modello_giocatori.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    if (roster.length === 0) { showToast('Nessun giocatore da esportare'); return; }
    const headers = ['Nome', 'Cognome', 'Numero maglia', 'Data di nascita', 'Codice Fiscale', 'Ruolo', 'Cellulare atleta', 'Nome papà', 'Telefono papà', 'Nome mamma', 'Telefono mamma', 'Scadenza certificato medico', 'Sesso', 'Luogo di nascita', 'Comune', 'CAP', 'Via', 'Civico'];
    const rows = roster.map((p) => [
      p.nome || '', p.cognome || '', p.numero ?? '', isoToItalian(p.data_nascita), p.codice_fiscale || '', p.ruolo || '',
      p.telefono_atleta || '', p.nome_papa || '', p.telefono_papa || '', p.nome_mamma || '', p.telefono_mamma || '',
      isoToItalian(p.certificato),
      p.sesso || '', p.luogo_nascita || '',
      p.indirizzo_comune || '', p.indirizzo_cap || '', p.indirizzo_via || '', p.indirizzo_civico || '',
    ]);
    downloadCSV('rosa_export.csv', headers, rows);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readCsvFile(file);
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) { showToast('Il file CSV sembra vuoto'); e.target.value = ''; return; }
    const delim = detectDelimiter(lines[0]);
    const headers = parseCSVLine(lines[0], delim).map(normalizeHeader);
    const fieldMap = headers.map((h) => CSV_HEADER_MAP[h] || null);

    if (!fieldMap.includes('nome') || !fieldMap.includes('cognome')) {
      showToast('Il CSV deve avere almeno le colonne Nome e Cognome');
      e.target.value = '';
      return;
    }

    const listaComuni = fieldMap.includes('luogo_nascita') ? await caricaComuni() : [];
    const rowsToUpsert: Partial<RosterPlayer>[] = [];
    let added = 0, updated = 0, skipped = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i], delim);
      const rec: Record<string, string> = {};
      fieldMap.forEach((field, idx) => { if (field) rec[field] = (cols[idx] || '').trim(); });
      const nome = rec.nome || '';
      const cognome = rec.cognome || '';
      if (!nome || !cognome) { skipped++; continue; }
      const numeroInt = rec.numero ? parseInt(rec.numero, 10) : NaN;
      const codiceFiscale = (rec.codice_fiscale || '').toUpperCase();
      const playerData: Partial<RosterPlayer> = {
        nome, cognome,
        numero: Number.isFinite(numeroInt) ? numeroInt : null,
        data_nascita: normalizeDateInput(rec.data_nascita) || null,
        codice_fiscale: codiceFiscale || null,
        ruolo: rec.ruolo || null,
        telefono_atleta: rec.telefono_atleta || null,
        nome_papa: rec.nome_papa || null,
        telefono_papa: rec.telefono_papa || null,
        nome_mamma: rec.nome_mamma || null,
        telefono_mamma: rec.telefono_mamma || null,
        certificato: normalizeDateInput(rec.certificato) || null,
      };
      if ('sesso' in rec) {
        const sx = rec.sesso.trim().toUpperCase();
        playerData.sesso = sx.startsWith('M') ? 'M' : sx.startsWith('F') ? 'F' : null;
      }
      if ('luogo_nascita' in rec) {
        const v = rec.luogo_nascita.trim().toUpperCase();
        const c = v ? listaComuni.find((x) => x.label === v) || listaComuni.find((x) => x.attivo && x.nome === v) : undefined;
        playerData.luogo_nascita = c ? c.label : null;
        playerData.luogo_nascita_cc = c ? c.cc : null;
      }
      if ('indirizzo_comune' in rec) {
        const aa = trovaComuneAA(rec.indirizzo_comune);
        playerData.indirizzo_comune = aa ? aa.nome : rec.indirizzo_comune || null;
        playerData.indirizzo_comune_cc = aa ? aa.cc : null;
        if (aa && !rec.indirizzo_cap) playerData.indirizzo_cap = aa.cap;
      }
      if ('indirizzo_cap' in rec) playerData.indirizzo_cap = rec.indirizzo_cap || playerData.indirizzo_cap || null;
      if ('indirizzo_via' in rec) playerData.indirizzo_via = rec.indirizzo_via || null;
      if ('indirizzo_civico' in rec) playerData.indirizzo_civico = rec.indirizzo_civico || null;
      const existing = codiceFiscale ? roster.find((p) => p.codice_fiscale && p.codice_fiscale === codiceFiscale) : null;
      if (existing) {
        rowsToUpsert.push({ id: existing.id, ...playerData });
        updated++;
      } else {
        rowsToUpsert.push(playerData);
        added++;
      }
    }
    try {
      await upsertMany.mutateAsync(rowsToUpsert);
      const skippedMsg = skipped ? `, ${skipped} righe saltate` : '';
      showToast(`Import completato: ${added} aggiunti, ${updated} aggiornati${skippedMsg}`);
    } catch {
      showToast('Errore durante l\'importazione');
    }
    e.target.value = '';
  }

  const players = [...roster].sort((a, b) => (a.numero ?? 99) - (b.numero ?? 99) || a.cognome.localeCompare(b.cognome));
  const today = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const viewingPlayer = players.find((p) => p.id === viewingId) || null;

  return (
    <section>
      {isAdmin && (
        <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost small" onClick={downloadTemplate}>Scarica modello CSV</button>
            <button className="btn ghost small" onClick={() => fileInputRef.current?.click()}>Importa da CSV</button>
            <button className="btn ghost small" onClick={exportCSV}>Esporta CSV (backup)</button>
            <button className="btn ghost small" onClick={() => setEsportaIniziali([])}>Esporta / condividi</button>
            <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
          </div>
          <button className="btn" onClick={() => openForm()}>+ Aggiungi giocatore</button>
        </div>
      )}

      {!isAdmin && (
        <div className="card" style={{ fontSize: 13, color: 'var(--inchiostro-soft)' }}>
          Rosa in sola lettura. Per modificarla contatta un amministratore.
        </div>
      )}

      {formOpen && isAdmin && (
        <div className="settings-modal open" role="dialog" aria-modal="true" aria-labelledby="titolo-modulo-giocatore">
        <div className="modale-giocatore form-giocatore">
          <div className="modale-giocatore-testa">
            <h3 id="titolo-modulo-giocatore">{editingId ? 'Modifica giocatore' : 'Nuovo giocatore'}</h3>
            <button type="button" className="modale-chiudi" aria-label="Chiudi senza salvare" onClick={closeForm}>✕</button>
          </div>
          {(() => {
            const corrente = editingId ? roster.find((p) => p.id === editingId) : undefined;
            const anteprima = fotoNuova?.url || (!fotoRimossa && corrente?.foto_path ? fotoUrls[corrente.foto_path] : undefined);
            const urlIntera = !fotoNuova && !fotoRimossa && corrente?.foto_intera_path ? fotoUrls[corrente.foto_intera_path] : undefined;
            return (
              <div className="foto-modifica">
                {anteprima
                  ? <img className="foto-atleta" src={anteprima} alt="Foto dell'atleta" style={{ width: 88, height: 88 }} />
                  : <span className="foto-atleta foto-atleta-placeholder" style={{ width: 88, height: 88 }}>Nessuna foto</span>}
                <div className="foto-azioni">
                  <label className="btn ghost small" style={{ cursor: 'pointer' }}>
                    {fotoInPreparazione ? 'Preparo la foto…' : anteprima ? 'Cambia foto' : 'Aggiungi foto'}
                    <input type="file" accept="image/*" hidden onChange={scegliFoto} disabled={fotoInPreparazione} />
                  </label>
                  {urlIntera && <button type="button" className="btn ghost small" disabled={fotoInPreparazione} onClick={() => ritagliaDiNuovo(urlIntera)}>Rifai ritaglio</button>}
                  {anteprima && <button type="button" className="btn ghost small" onClick={rimuoviFoto}>Rimuovi foto</button>}
                  <span className="muted" style={{ fontSize: 12 }}>L'app cerca il viso e propone il ritaglio; la foto si salva quando premi Salva.</span>
                </div>
              </div>
            );
          })()}
          <div className="row">
            <div className="field"><label>Nome</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="field"><label>Cognome</label><input value={form.cognome} onChange={(e) => setForm({ ...form, cognome: e.target.value })} /></div>
            <div className="field"><label>N. maglia</label><input type="number" min={0} max={99} style={{ width: 80 }} value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <div className="field"><label>Data di nascita</label><input type="date" value={form.data_nascita} onChange={(e) => setForm({ ...form, data_nascita: e.target.value })} /></div>
            <div className="field">
              <label>Sesso</label>
              <select style={{ width: 110 }} value={form.sesso} onChange={(e) => setForm({ ...form, sesso: e.target.value as '' | Sesso })}>
                <option value="">—</option>
                <option value="M">Maschio</option>
                <option value="F">Femmina</option>
              </select>
            </div>
            <div className="field" style={{ flex: 1, minWidth: 220 }}>
              <label>Luogo di nascita (comune o stato estero)</label>
              <input
                list="comuni-nascita"
                style={{ width: '100%', textTransform: 'uppercase' }}
                placeholder="Scrivi e scegli dall'elenco…"
                value={form.luogo_nascita}
                onChange={(e) => handleLuogoChange(e.target.value)}
              />
              <datalist id="comuni-nascita">
                {suggerimenti.map((c) => <option key={`${c.cc}-${c.label}`} value={c.label} />)}
              </datalist>
              {form.luogo_nascita && !form.luogo_nascita_cc && (
                <span className="muted" style={{ fontSize: 12 }}>Scegli un comune dall'elenco proposto (codice catastale non ancora riconosciuto).</span>
              )}
              {form.luogo_nascita_cc && <span className="muted" style={{ fontSize: 12 }}>Codice catastale: {form.luogo_nascita_cc}</span>}
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <div className="field">
              <label>Codice fiscale</label>
              <input
                style={{ width: 220, textTransform: 'uppercase' }}
                value={form.codice_fiscale}
                onChange={(e) => { setCfAuto(false); setForm({ ...form, codice_fiscale: e.target.value }); }}
              />
              {cfAuto && <span className="muted" style={{ fontSize: 12 }}>Calcolato automaticamente (modificabile a mano)</span>}
              {!cfAuto && cfCalcolato && form.codice_fiscale.trim().toUpperCase() === cfCalcolato && (
                <span className="muted" style={{ fontSize: 12 }}>✓ Coincide con il codice calcolato</span>
              )}
              {!cfAuto && cfCalcolato && form.codice_fiscale.trim() && form.codice_fiscale.trim().toUpperCase() !== cfCalcolato && (
                <span style={{ fontSize: 12, color: 'var(--rosso)' }}>
                  Diverso dal calcolato ({cfCalcolato}): può essere omocodia o un dato da controllare.{' '}
                  <button type="button" className="btn ghost small" onClick={() => { setForm({ ...form, codice_fiscale: cfCalcolato }); setCfAuto(true); }}>Usa il calcolato</button>
                </span>
              )}
              {!cfAuto && cfCalcolato && !form.codice_fiscale.trim() && (
                <span className="muted" style={{ fontSize: 12 }}>
                  Codice calcolabile: {cfCalcolato}{' '}
                  <button type="button" className="btn ghost small" onClick={() => { setForm({ ...form, codice_fiscale: cfCalcolato }); setCfAuto(true); }}>Inserisci</button>
                </span>
              )}
              {!cfCalcolato && !form.codice_fiscale && campiMancanti.length > 0 && (
                <span className="muted" style={{ fontSize: 12 }}>Per il calcolo automatico servono: {campiMancanti.join(', ')}.</span>
              )}
            </div>
            <div className="field">
              <label>Ruolo</label>
              <select style={{ width: 170 }} value={form.ruolo} onChange={(e) => setForm({ ...form, ruolo: e.target.value })}>
                <option value="">— nessuno —</option>
                {RUOLI.map((r) => <option key={r} value={r}>{r === 'Schiacciatore' ? 'Schiacciatore (banda)' : r}</option>)}
              </select>
            </div>
            <div className="field"><label>Cellulare atleta</label><input style={{ width: 150 }} value={form.telefono_atleta} onChange={(e) => setForm({ ...form, telefono_atleta: e.target.value })} /></div>
          </div>
          <div className="field" style={{ marginTop: 16 }}>
            <label style={{ fontSize: 13.5 }}>Residenza</label>
          </div>
          <div className="row" style={{ marginTop: 4 }}>
            <div className="field" style={{ flex: 1, minWidth: 200 }}>
              <label htmlFor="residenza-comune">Comune</label>
              <input
                id="residenza-comune"
                list="comuni-residenza"
                style={{ width: '100%' }}
                placeholder="Scrivi e scegli dall'elenco…"
                value={form.indirizzo_comune}
                onChange={(e) => handleComuneResidenzaChange(e.target.value)}
              />
              <datalist id="comuni-residenza">
                {suggerimentiComuneResidenza.aa.map((c) => <option key={c.cc} value={c.nome} label={c.nomeDe ? `${c.nomeDe} · ${c.cap}` : c.cap} />)}
                {suggerimentiComuneResidenza.altri.map((c) => <option key={`${c.cc}-${c.label}`} value={c.label} />)}
              </datalist>
              {form.indirizzo_comune && !form.indirizzo_comune_cc && (
                <span className="muted" style={{ fontSize: 12 }}>Scegli il comune dall'elenco (per i comuni fuori provincia scrivine il nome, es. Trento).</span>
              )}
              {comuneAA && comuneAA.nomeDe && <span className="muted" style={{ fontSize: 12 }}>{comuneAA.nomeDe}</span>}
            </div>
            <div className="field">
              <label htmlFor="residenza-cap">CAP</label>
              <input
                id="residenza-cap"
                inputMode="numeric"
                maxLength={5}
                style={{ width: 90 }}
                value={form.indirizzo_cap}
                onChange={(e) => { setCapAuto(false); setForm({ ...form, indirizzo_cap: e.target.value }); }}
              />
              {capAuto && <span className="muted" style={{ fontSize: 12 }}>Dal comune: se la frazione ha un CAP proprio, correggilo</span>}
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <div className="field" style={{ flex: 1, minWidth: 220 }}>
              <label htmlFor="residenza-via">Via / località</label>
              <input
                id="residenza-via"
                list="vie-residenza"
                style={{ width: '100%' }}
                placeholder={comuneAA ? 'Scrivi e scegli dall\'elenco delle vie…' : 'Scrivi la via'}
                value={form.indirizzo_via}
                onChange={(e) => setForm({ ...form, indirizzo_via: e.target.value })}
              />
              <datalist id="vie-residenza">
                {suggerimentiVia.map((v) => <option key={v.n + (v.d || '')} value={v.n} label={v.d} />)}
              </datalist>
              {comuneAA && !viaInElenco && (
                <span className="muted" style={{ fontSize: 12 }}>Via non presente nell'elenco: verrà salvata come l'hai scritta.</span>
              )}
            </div>
            <div className="field">
              <label htmlFor="residenza-civico">N. civico</label>
              <input id="residenza-civico" style={{ width: 90 }} value={form.indirizzo_civico} onChange={(e) => setForm({ ...form, indirizzo_civico: e.target.value })} />
            </div>
          </div>
          {comuneAA && (
            <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
              Elenco vie ©{' '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
            </div>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <div className="field"><label>Nome papà</label><input style={{ width: 150 }} value={form.nome_papa} onChange={(e) => setForm({ ...form, nome_papa: e.target.value })} /></div>
            <div className="field"><label>Telefono papà</label><input style={{ width: 150 }} value={form.telefono_papa} onChange={(e) => setForm({ ...form, telefono_papa: e.target.value })} /></div>
            <div className="field"><label>Nome mamma</label><input style={{ width: 150 }} value={form.nome_mamma} onChange={(e) => setForm({ ...form, nome_mamma: e.target.value })} /></div>
            <div className="field"><label>Telefono mamma</label><input style={{ width: 150 }} value={form.telefono_mamma} onChange={(e) => setForm({ ...form, telefono_mamma: e.target.value })} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <div className="field"><label>Scadenza certificato medico</label><input type="date" value={form.certificato} onChange={(e) => setForm({ ...form, certificato: e.target.value })} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <label className="chk">
              <input type="checkbox" checked={form.solo_u15} onChange={(e) => setForm({ ...form, solo_u15: e.target.checked })} />
              Può giocare solo in U15 (nonostante l'età sia U14)
            </label>
          </div>
          <div className="settings-actions">
            <button className="btn ghost" onClick={closeForm}>Annulla</button>
            <button className="btn" onClick={handleSave}>Salva</button>
          </div>
        </div>
        </div>
      )}

      {players.length === 0 ? (
        <div className="empty">Nessun giocatore in rosa.</div>
      ) : (
        <div className="roster-list">
          {players.map((p) => {
            const cert = certStatus(p, today, soon);
            return (
              <button className="roster-row" key={p.id} onClick={() => openDetail(p.id)}>
                <FotoAtleta player={p} url={p.foto_path ? fotoUrls[p.foto_path] : undefined} size={48} />
                <div className="roster-row-main">
                  <div className="roster-row-top">
                    <span className="roster-row-name">{p.cognome} {p.nome}</span>
                    <CategoriaTag dataNascita={p.data_nascita} soloU15={p.solo_u15} />
                  </div>
                  <div className="roster-row-meta">
                    {[
                      p.data_nascita ? `${eta(p.data_nascita)} anni · ${fmtDateShort(p.data_nascita)}` : null,
                      p.numero != null ? `maglia ${p.numero}` : null,
                      p.ruolo,
                      p.indirizzo_comune,
                    ].filter(Boolean).join(' · ') || '—'}
                  </div>
                  <div className="roster-row-meta">
                    {contattoPrincipale(p) && <span>{contattoPrincipale(p)}</span>}
                    <span className={`roster-cert ${cert.stato}`}>{cert.breve}</span>
                  </div>
                </div>
                <span className="roster-row-chevron">›</span>
              </button>
            );
          })}
        </div>
      )}

      {viewingPlayer && (
        <div className="settings-modal open" onClick={closeDetail}>
          <div className="settings-box scheda-atleta" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FotoAtleta player={viewingPlayer} url={viewingPlayer.foto_path ? fotoUrls[viewingPlayer.foto_path] : undefined} size={64} />
                {viewingPlayer.cognome} {viewingPlayer.nome}
                <CategoriaTag dataNascita={viewingPlayer.data_nascita} soloU15={viewingPlayer.solo_u15} />
              </h3>
            </div>
            {viewingPlayer.foto_intera_path && fotoUrls[viewingPlayer.foto_intera_path] && (
              <img className="foto-intera" src={fotoUrls[viewingPlayer.foto_intera_path]} alt={`${viewingPlayer.cognome} ${viewingPlayer.nome}`} />
            )}
            <dl className="detail-list">
              <div><dt>Ruolo</dt><dd>{viewingPlayer.ruolo || '—'}</dd></div>
              <div><dt>Data di nascita</dt><dd>{viewingPlayer.data_nascita ? fmtDateShort(viewingPlayer.data_nascita) : '—'}</dd></div>
              <div><dt>Sesso</dt><dd>{viewingPlayer.sesso === 'M' ? 'Maschio' : viewingPlayer.sesso === 'F' ? 'Femmina' : '—'}</dd></div>
              <div><dt>Luogo di nascita</dt><dd>{viewingPlayer.luogo_nascita || '—'}</dd></div>
              <div className="largo">
                <dt>Residenza</dt>
                <dd>
                  {indirizzoCompleto(viewingPlayer) ? (
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(indirizzoCompleto(viewingPlayer))}`} target="_blank" rel="noopener noreferrer">
                      {indirizzoCompleto(viewingPlayer)}
                    </a>
                  ) : '—'}
                </dd>
              </div>
              <div><dt>Codice fiscale</dt><dd>{viewingPlayer.codice_fiscale || '—'}</dd></div>
              <div>
                <dt>Certificato medico</dt>
                <dd className={certStatus(viewingPlayer, today, soon).warn ? 'cert-warn' : ''}>
                  {certStatus(viewingPlayer, today, soon).label}
                </dd>
              </div>
              <div><dt>Cellulare atleta</dt><dd>{viewingPlayer.telefono_atleta || '—'}</dd></div>
              <div><dt>Papà</dt><dd>{viewingPlayer.nome_papa || viewingPlayer.telefono_papa ? `${viewingPlayer.nome_papa || ''}${viewingPlayer.nome_papa && viewingPlayer.telefono_papa ? ' · ' : ''}${viewingPlayer.telefono_papa || ''}` : '—'}</dd></div>
              <div><dt>Mamma</dt><dd>{viewingPlayer.nome_mamma || viewingPlayer.telefono_mamma ? `${viewingPlayer.nome_mamma || ''}${viewingPlayer.nome_mamma && viewingPlayer.telefono_mamma ? ' · ' : ''}${viewingPlayer.telefono_mamma || ''}` : '—'}</dd></div>
            </dl>
            <div className="detail-actions">
              <button className="btn ghost" onClick={closeDetail}>Chiudi</button>
              {isAdmin && (
                <>
                  <button className="btn ghost" onClick={() => { setViewingId(null); setEsportaIniziali([viewingPlayer.id]); }}>Esporta / condividi</button>
                  <button className="btn ghost" onClick={() => editFromDetail(viewingPlayer)}>Modifica</button>
                  <button className="btn" style={{ background: 'var(--rosso-scuro)' }} onClick={() => handleDelete(viewingPlayer.id)}>Elimina</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {daRitagliare && <RitaglioFoto img={daRitagliare} onConferma={confermaRitaglio} onAnnulla={chiudiRitaglio} />}

      {esportaIniziali && isAdmin && (
        <EsportaAtleti players={players} iniziali={esportaIniziali} onClose={() => setEsportaIniziali(null)} />
      )}
    </section>
  );
}
