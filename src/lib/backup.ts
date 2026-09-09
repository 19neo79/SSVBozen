import { supabase } from './supabase';
import type { Avversario, Match, RecurringDefault, RosterPlayer, Settings, Training, Venue } from '../types/database';

export const BACKUP_VERSION = 1;

export interface BackupTables {
  avversari: Avversario[];
  venues: Venue[];
  roster: RosterPlayer[];
  trainings: Training[];
  matches: Match[];
  recurring_defaults: RecurringDefault[];
  settings: Settings | null;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  clubName: string;
  tables: BackupTables;
}

async function fetchAll<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw error;
  return (data || []) as T[];
}

export async function exportFullBackup(clubName: string): Promise<void> {
  const [avversari, venues, roster, trainings, matches, recurring_defaults, settingsRows] = await Promise.all([
    fetchAll<Avversario>('avversari'),
    fetchAll<Venue>('venues'),
    fetchAll<RosterPlayer>('roster'),
    fetchAll<Training>('trainings'),
    fetchAll<Match>('matches'),
    fetchAll<RecurringDefault>('recurring_defaults'),
    fetchAll<Settings>('settings'),
  ]);

  const backup: BackupData = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    clubName,
    tables: { avversari, venues, roster, trainings, matches, recurring_defaults, settings: settingsRows[0] || null },
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeClub = clubName.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  a.href = url;
  a.download = `Backup_${safeClub}_${backup.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseBackupFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossibile leggere il file'));
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!parsed || typeof parsed !== 'object' || !parsed.tables || typeof parsed.tables !== 'object') {
          reject(new Error('Il file non sembra un backup valido di questa app'));
          return;
        }
        resolve(parsed as BackupData);
      } catch {
        reject(new Error('File JSON non valido'));
      }
    };
    reader.readAsText(file);
  });
}

async function deleteAll(table: string, idColumn = 'id') {
  const { error } = await supabase.from(table).delete().not(idColumn, 'is', null);
  if (error) throw error;
}

async function insertAll(table: string, rows: unknown[] | undefined) {
  if (!rows || rows.length === 0) return;
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + batchSize));
    if (error) throw error;
  }
}

/**
 * Sostituisce TUTTI i dati (avversari, palestre, rosa, allenamenti, partite,
 * default ricorrenti, impostazioni società) con il contenuto del backup.
 * Non tocca utenti/ruoli (profiles) né i link pubblici condivisi (rigenerabili).
 * Operazione distruttiva e non reversibile se non si ha un backup più recente.
 */
export async function restoreFullBackup(backup: BackupData): Promise<void> {
  const t = backup.tables;

  // Elimina prima le tabelle "figlie", poi quelle "genitrici".
  await deleteAll('matches');
  await deleteAll('trainings');
  await deleteAll('recurring_defaults', 'giorno');
  await deleteAll('venues');
  await deleteAll('avversari');
  await deleteAll('roster');

  // Reinserisce prima le "genitrici", poi le "figlie" (stessi id per preservare i riferimenti).
  await insertAll('avversari', t.avversari);
  await insertAll('venues', t.venues);
  await insertAll('roster', t.roster);
  await insertAll('trainings', t.trainings);
  await insertAll('matches', t.matches);
  await insertAll('recurring_defaults', t.recurring_defaults);

  if (t.settings) {
    const { id, ...rest } = t.settings;
    const { error } = await supabase.from('settings').update(rest).eq('id', id);
    if (error) throw error;
  }
}
