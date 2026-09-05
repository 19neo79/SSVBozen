import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Avversario } from '../types/database';

const KEY = ['avversari'];

export function useAvversari() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('avversari').select('*').order('categoria').order('nome');
      if (error) throw error;
      return (data || []) as Avversario[];
    },
  });
}

export function useSaveAvversario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nome, categoria }: { id: string | null; nome: string; categoria: string }) => {
      if (id) {
        const { error } = await supabase.from('avversari').update({ nome, categoria }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('avversari').insert({ nome, categoria });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteAvversario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('avversari').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      // eliminare un avversario cancella a cascata le sue palestre (venues.avversario_id)
      qc.invalidateQueries({ queryKey: ['venues'] });
    },
  });
}
