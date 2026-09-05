import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Profile, Ruolo } from '../types/database';

const KEY = ['profiles'];

export function useProfiles() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('nome');
      if (error) throw error;
      return (data || []) as Profile[];
    },
  });
}

export function useUpdateProfileRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ruolo }: { id: string; ruolo: Ruolo }) => {
      const { error } = await supabase.from('profiles').update({ ruolo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
