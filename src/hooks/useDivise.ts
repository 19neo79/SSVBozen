import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { NuovaDivisa } from '../lib/divise';
import type { Divisa } from '../types/database';

const KEY = ['divise'];

/** Il vincolo "una normale e una da libero per ragazzo" arriva dal database come codice 23505. */
function errore(e: { code?: string; message: string }): Error {
  return e.code === '23505' ? new Error('Questo ragazzo ha già una divisa di questo tipo') : new Error(e.message);
}

/** Solo gli admin possono leggere le divise: per gli altri la richiesta non parte. */
export function useDivise({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: KEY,
    enabled,
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
      // "Sposta qui": il database libera la vecchia divisa e salva la nuova in un solo passaggio (o nessuno dei due).
      if (liberaPrima) {
        const { error } = await supabase.rpc('salva_divisa_spostando', { vecchia: liberaPrima, dati: data, divisa_id: id });
        if (error) throw errore(error);
        return;
      }
      if (id) {
        const { data: righe, error } = await supabase.from('divise').update(data).eq('id', id).select('id');
        if (error) throw errore(error);
        if (!righe?.length) throw new Error('Questa divisa non esiste più: forse è stata eliminata');
        return;
      }
      const { error } = await supabase.from('divise').insert(data);
      if (error) throw errore(error);
    },
    // Anche la rosa: il database allinea il "N. maglia" al numero della divisa normale.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['roster'] });
    },
  });
}

export function useCreaDivise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (righe: NuovaDivisa[]) => {
      const { error } = await supabase.from('divise').insert(righe);
      if (error) throw errore(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['roster'] });
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['roster'] });
    },
  });
}

export function useEliminaDivise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('divise').delete().in('id', ids);
      if (error) throw errore(error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['roster'] });
    },
  });
}
