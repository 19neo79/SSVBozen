import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Training } from '../types/database';

const KEY = ['trainings'];

export function useTrainings() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('trainings').select('*').order('data').order('orario');
      if (error) throw error;
      return (data || []) as Training[];
    },
  });
}

export function useAddTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Training>) => {
      const { error } = await supabase.from('trainings').insert(data);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAddTrainingsBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Partial<Training>[]) => {
      if (rows.length === 0) return;
      const { error } = await supabase.from('trainings').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Training> }) => {
      const { error } = await supabase.from('trainings').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('trainings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
