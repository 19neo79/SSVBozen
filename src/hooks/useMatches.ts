import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Match } from '../types/database';

const KEY = ['matches'];

export function useMatches() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('matches').select('*').order('data').order('orario');
      if (error) throw error;
      return (data || []) as Match[];
    },
  });
}

export function useAddMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Match>) => {
      const { error } = await supabase.from('matches').insert(data);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAddMatchesBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Partial<Match>[]) => {
      if (rows.length === 0) return;
      const { error } = await supabase.from('matches').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Match> }) => {
      const { error } = await supabase.from('matches').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('matches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
