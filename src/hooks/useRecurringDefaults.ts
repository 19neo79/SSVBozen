import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Giorno, RecurringDefault } from '../types/database';

const KEY = ['recurring_defaults'];

export function useRecurringDefaults() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('recurring_defaults').select('*');
      if (error) throw error;
      const byDay: Record<string, RecurringDefault> = {};
      (data || []).forEach((d) => {
        byDay[d.giorno] = d as RecurringDefault;
      });
      return byDay;
    },
  });
}

export function useSaveRecurringDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: { giorno: Giorno; orario: string | null; venue_id: string | null; palestra_custom: string | null; convocati: string[] }[]) => {
      const { error } = await supabase.from('recurring_defaults').upsert(rows, { onConflict: 'giorno' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
