import type { WorkerProfileInput } from '@croppr/shared';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import type { PickedImage } from '@/components/form/PhotoField';
import { removeUserFiles, uploadUserImage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export const EMPTY_WORKER_PROFILE: WorkerProfileInput = {
  fullName: '',
  currentPostcode: '',
  nationality: '',
  visaType: '417',
  visaExpiry: null,
  travelMode: 'solo',
  groupSize: 1,
  hasCar: false,
  needsAccommodation: false,
  skills: [],
  yearsExperience: 0,
  experienceSummary: '',
  regionIds: [],
  availability: [{ startDate: '', endDate: '' }],
};

export interface MyWorkerProfile {
  values: WorkerProfileInput;
  photoPath: string | null;
}

export function useMyWorkerProfile(userId: string) {
  return useQuery({
    queryKey: ['worker-profile', userId],
    queryFn: async (): Promise<MyWorkerProfile | null> => {
      const [profile, priv, regions, availability] = await Promise.all([
        supabase.from('worker_profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('worker_private').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('worker_regions').select('region_id').eq('worker_id', userId),
        supabase
          .from('worker_availability')
          .select('start_date, end_date')
          .eq('worker_id', userId)
          .order('start_date'),
      ]);
      for (const r of [profile, priv, regions, availability]) if (r.error) throw r.error;
      const p = profile.data;
      if (!p) return null;
      return {
        photoPath: p.photo_path,
        values: {
          fullName: p.full_name,
          currentPostcode: p.current_postcode,
          nationality: priv.data?.nationality ?? '',
          visaType: priv.data?.visa_type ?? '417',
          visaExpiry: priv.data?.visa_expiry ?? null,
          travelMode: p.travel_mode,
          groupSize: p.group_size,
          hasCar: p.has_car,
          needsAccommodation: p.needs_accommodation,
          skills: p.skills as WorkerProfileInput['skills'],
          yearsExperience: p.years_experience,
          experienceSummary: p.experience_summary,
          regionIds: (regions.data ?? []).map((r) => r.region_id),
          availability: (availability.data ?? []).map((a) => ({
            startDate: a.start_date,
            endDate: a.end_date,
          })),
        },
      };
    },
  });
}

export function useSaveWorkerProfile(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ values, photo }: { values: WorkerProfileInput; photo: PickedImage | null }) => {
      const { error } = await supabase.rpc('save_worker_profile', { p: values });
      if (error) throw error;
      if (photo) {
        const path = await uploadUserImage({ bucket: 'avatars', userId, name: 'avatar', ...photo });
        const { error: e2 } = await supabase
          .from('worker_profiles')
          .update({ photo_path: path })
          .eq('user_id', userId);
        if (e2) throw e2;
        await removeUserFiles('avatars', userId, path);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['worker-profile', userId] }),
  });
}
