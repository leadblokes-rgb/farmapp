import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useRegions() {
  return useQuery({
    queryKey: ['regions'],
    // Regions rarely change, so cache them for the session, but never cache an empty list.
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('regions').select('id, name').order('name');
      if (error) throw error;
      // There are always regions; an empty answer means the request didn't get through properly.
      if (!data.length) throw new Error('Couldn’t load regions.');
      return data;
    },
  });
}

/** Looks up a postcode in our reference table (QLD subset in the MVP). */
export function usePostcode(postcode: string) {
  return useQuery({
    queryKey: ['postcode', postcode],
    enabled: /^\d{4}$/.test(postcode),
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('postcodes')
        .select('locality, state')
        .eq('postcode', postcode)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
