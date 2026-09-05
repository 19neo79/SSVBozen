import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Venue } from '../types/database';

const KEY = ['venues'];

export function useVenues() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('venues').select('*').order('nome');
      if (error) throw error;
      return (data || []) as Venue[];
    },
  });
}

export function useSaveVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string | null; data: Partial<Venue> }) => {
      if (id) {
        const { error } = await supabase.from('venues').update(data).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('venues').insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('venues').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpsertManyVenues() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Partial<Venue>[]) => {
      const toInsert = rows.filter((r) => !r.id);
      const toUpdate = rows.filter((r) => r.id);
      if (toInsert.length) {
        const { error } = await supabase.from('venues').insert(toInsert);
        if (error) throw error;
      }
      for (const row of toUpdate) {
        const { id, ...rest } = row;
        const { error } = await supabase.from('venues').update(rest).eq('id', id as string);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
