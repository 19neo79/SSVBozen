import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { RosterPlayer } from '../types/database';

const KEY = ['roster'];

export function useRoster() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('roster').select('*').order('cognome');
      if (error) throw error;
      return (data || []) as RosterPlayer[];
    },
  });
}

export function useSavePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string | null; data: Partial<RosterPlayer> }): Promise<string> => {
      if (id) {
        const { error } = await supabase.from('roster').update(data).eq('id', id);
        if (error) throw error;
        return id;
      }
      const { data: creato, error } = await supabase.from('roster').insert(data).select('id').single();
      if (error) throw error;
      return creato.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeletePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('roster').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpsertManyPlayers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Partial<RosterPlayer>[]) => {
      const toInsert = rows.filter((r) => !r.id);
      const toUpdate = rows.filter((r) => r.id);
      if (toInsert.length) {
        const { error } = await supabase.from('roster').insert(toInsert);
        if (error) throw error;
      }
      for (const row of toUpdate) {
        const { id, ...rest } = row;
        const { error } = await supabase.from('roster').update(rest).eq('id', id as string);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Link temporanei (1 ora) alle foto nell'archivio privato, per tutti gli atleti in una sola richiesta. */
export function useFotoAtleti(paths: string[]) {
  const ordinati = [...new Set(paths)].sort();
  return useQuery({
    queryKey: ['foto-atleti', ordinati],
    enabled: ordinati.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('foto-atleti').createSignedUrls(ordinati, 3600);
      if (error) throw error;
      const mappa: Record<string, string> = {};
      (data || []).forEach((d) => { if (d.path && d.signedUrl) mappa[d.path] = d.signedUrl; });
      return mappa;
    },
  });
}
