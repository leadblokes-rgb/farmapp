import { formatAbn, type Database, type FarmInput, type FarmOutput } from '@croppr/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { t } from '@/i18n';

export type Farm = Database['public']['Tables']['farms']['Row'];

export const EMPTY_FARM: FarmInput = {
  businessName: '',
  abn: '',
  contactPhone: '',
  postcode: '',
  description: '',
  isLabourHire: false,
  labourHireLicenceNumber: '',
};

export function farmToInput(f: Farm): FarmInput {
  return {
    businessName: f.business_name,
    abn: formatAbn(f.abn),
    contactPhone: f.contact_phone,
    postcode: f.postcode,
    description: f.description,
    isLabourHire: f.is_labour_hire,
    labourHireLicenceNumber: f.labour_hire_licence_number ?? '',
  };
}

export function useMyFarm(userId: string) {
  return useQuery({
    queryKey: ['my-farm', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('farms').select('*').eq('owner_id', userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveFarm(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: FarmOutput) => {
      const row = {
        owner_id: userId,
        business_name: v.businessName,
        abn: v.abn,
        contact_phone: v.contactPhone,
        postcode: v.postcode,
        description: v.description,
        is_labour_hire: v.isLabourHire,
        labour_hire_licence_number: v.isLabourHire ? v.labourHireLicenceNumber : null,
      };
      // owner_id is unique, so this inserts on signup and updates afterwards.
      // Verification status is controlled by a database trigger, never by the app.
      const { error } = await supabase.from('farms').upsert(row, { onConflict: 'owner_id' });
      if (error) {
        if (error.code === '23505' && error.message.includes('abn')) {
          throw new Error(t('errors.abnTaken'));
        }
        throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-farm', userId] }),
  });
}

export interface FarmPageInput {
  website: string;
  accommodationDetails: string;
}

/** Farm page details (logo, photos, website, accommodation). These never trigger re-verification. */
export function useSaveFarmPage(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: {
      website?: string | null;
      accommodation_details?: string;
      logo_path?: string | null;
      photos?: string[];
    }) => {
      const { error } = await supabase.from('farms').update(patch).eq('owner_id', userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-farm', userId] }),
  });
}
