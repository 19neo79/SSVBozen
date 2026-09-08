import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * Restituisce il codice pubblico (uuid) associato a una settimana, riusando
 * quello esistente se la settimana e' gia' stata condivisa in precedenza,
 * altrimenti generandone uno nuovo. Il codice non ha alcuna relazione
 * leggibile con la data: non puo' essere costruito o modificato a mano.
 */
export function useGetOrCreatePublicWeekLink() {
  return useMutation({
    mutationFn: async (weekStart: string): Promise<string> => {
      const { data: existing, error: selectError } = await supabase
        .from('public_week_links')
        .select('id')
        .eq('week_start', weekStart)
        .maybeSingle();
      if (selectError) throw selectError;
      if (existing) return existing.id as string;

      const { data: created, error: insertError } = await supabase
        .from('public_week_links')
        .insert({ week_start: weekStart })
        .select('id')
        .single();
      if (insertError) throw insertError;
      return created.id as string;
    },
  });
}
