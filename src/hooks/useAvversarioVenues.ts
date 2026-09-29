import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const KEY = ['avversario_venues'];

export interface AvversarioVenueLink {
  avversario_id: string;
  venue_id: string;
}

/** Collegamenti avversario<->palestra: una palestra puo' essere condivisa da più avversari. */
export function useAvversarioVenues() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('avversario_venues').select('avversario_id, venue_id');
      if (error) throw error;
      return (data || []) as AvversarioVenueLink[];
    },
  });
}

export function useLinkAvversarioVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ avversarioId, venueId }: { avversarioId: string; venueId: string }) => {
      const { error } = await supabase.from('avversario_venues').insert({ avversario_id: avversarioId, venue_id: venueId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUnlinkAvversarioVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ avversarioId, venueId }: { avversarioId: string; venueId: string }) => {
      const { error } = await supabase.from('avversario_venues').delete().eq('avversario_id', avversarioId).eq('venue_id', venueId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
