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

interface SaveAvversarioInput {
  id: string | null;
  nome: string;
  categoria: string;
  responsabile: string | null;
  telefono_responsabile: string | null;
  email_responsabile: string | null;
}

export function useSaveAvversario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: SaveAvversarioInput) => {
      if (id) {
        const { error } = await supabase.from('avversari').update(data).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('avversari').insert(data);
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
