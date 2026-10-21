import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Divisa } from '../types/database';

const KEY = ['divise'];

/** Il vincolo "una normale e una da libero per ragazzo" arriva dal database come codice 23505. */
function errore(e: { code?: string; message: string }): Error {
  return e.code === '23505' ? new Error('Questo ragazzo ha già una divisa di questo tipo') : new Error(e.message);
}

export function useDivise() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('divise').select('*').order('numero');
      if (error) throw errore(error);
      return (data || []) as Divisa[];
    },
  });
}

export function useSalvaDivisa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data, liberaPrima }: { id: string | null; data: Partial<Divisa>; liberaPrima?: string }) => {
      // "Sposta qui": prima si libera la vecchia divisa del ragazzo, altrimenti il vincolo blocca il salvataggio.
      if (liberaPrima) {
        const { error } = await supabase.from('divise').update({ roster_id: null, giocatore_nome: null }).eq('id', liberaPrima);
        if (error) throw errore(error);
      }
      const { error } = id ? await supabase.from('divise').update(data).eq('id', id) : await supabase.from('divise').insert(data);
      if (error) throw errore(error);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCreaDivise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (righe: Pick<Divisa, 'gruppo' | 'numero' | 'taglia' | 'libero'>[]) => {
      const { error } = await supabase.from('divise').insert(righe);
      if (error) throw errore(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Stessa modifica su più divise: "Sposta in gruppo" o "Togli giocatore". */
export function useAggiornaDivise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, data }: { ids: string[]; data: Partial<Divisa> }) => {
      const { error } = await supabase.from('divise').update(data).in('id', ids);
      if (error) throw errore(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useEliminaDivise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('divise').delete().in('id', ids);
      if (error) throw errore(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
