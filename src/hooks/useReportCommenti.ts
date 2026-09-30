import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ReportCommento } from '../types/database';

export function useReportCommento(mese: string) {
  return useQuery({
    queryKey: ['report_commenti', mese],
    queryFn: async () => {
      const { data, error } = await supabase.from('report_commenti').select('*').eq('mese', mese).maybeSingle();
      if (error) throw error;
      return data as ReportCommento | null;
    },
  });
}

export function useSaveReportCommento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: Omit<ReportCommento, 'updated_at'>) => {
      const { error } = await supabase.from('report_commenti').upsert({ ...c, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: (_d, c) => qc.invalidateQueries({ queryKey: ['report_commenti', c.mese] }),
  });
}
