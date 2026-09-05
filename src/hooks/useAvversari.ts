import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { AvversarioConCampi, CampoAvversario } from '../types/database';

const KEY = ['avversari'];

export function useAvversari() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avversari')
        .select('*, campi:campi_avversari(*)')
        .order('categoria')
        .order('nome');
      if (error) throw error;
      return (data || []) as AvversarioConCampi[];
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
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSaveCampo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      avversario_id,
      data,
    }: {
      id: string | null;
      avversario_id: string;
      data: Partial<CampoAvversario>;
    }) => {
      if (id) {
        const { error } = await supabase.from('campi_avversari').update(data).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('campi_avversari').insert({ ...data, avversario_id });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteCampo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campi_avversari').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
