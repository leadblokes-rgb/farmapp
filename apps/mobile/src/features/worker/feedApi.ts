import { effectiveHourlyCents, type Database } from '@croppr/shared';
import { ranker, type MatchJob, type MatchWorker, type Ranked } from '@croppr/matching';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type FeedJob = Database['public']['Functions']['job_feed']['Returns'][number];

export interface FeedFilters {
  regionIds: string[];
  from: string | null;
  to: string | null;
  minHourlyCents: number | null;
  accommodationOnly: boolean;
}

export const NO_FILTERS: FeedFilters = {
  regionIds: [],
  from: null,
  to: null,
  minHourlyCents: null,
  accommodationOnly: false,
};

export function activeFilterCount(f: FeedFilters): number {
  return (
    (f.regionIds.length ? 1 : 0) +
    (f.from || f.to ? 1 : 0) +
    (f.minHourlyCents ? 1 : 0) +
    (f.accommodationOnly ? 1 : 0)
  );
}

export interface RankedFeedJob {
  job: FeedJob;
  score: number;
  breakdown: Ranked<MatchJob>['breakdown'];
  /** Specified-work postcode check for the viewing worker's own visa (from the database lists). */
  specified: SpecifiedWorkCheck;
}

export interface SpecifiedWorkCheck {
  /** null when it doesn't apply (the worker isn't on a 417/462 visa). */
  eligible: boolean | null;
  /** e.g. "Eligible postcode for 417 plant & animal cultivation" */
  label: string;
}

function specifiedFor(job: FeedJob): SpecifiedWorkCheck {
  if (!job.viewer_visa_subclass || job.specified_work_eligible == null) return { eligible: null, label: '' };
  return job.specified_work_eligible
    ? {
        eligible: true,
        label: `Eligible postcode for ${job.viewer_visa_subclass} ${job.specified_work_label ?? 'specified work'}`,
      }
    : { eligible: false, label: '' };
}

function toMatchJob(j: FeedJob): MatchJob {
  return {
    id: j.id,
    roleType: j.role_type,
    startDate: j.start_date,
    endDate: j.end_date,
    location: j.lat != null && j.lng != null ? { lat: j.lat, lng: j.lng } : null,
    carRequired: j.car_required,
    transportProvided: j.transport_provided,
    accommodationProvided: j.accommodation_provided,
    employmentType: j.employment_type,
    effectiveHourlyCents: effectiveHourlyCents({
      payType: j.pay_type,
      payRateCents: j.pay_rate_cents,
      minHourlyGuaranteeCents: j.min_hourly_guarantee_cents,
    }),
  };
}

/** The signed-in worker in the shape the matching module needs. */
async function loadMatchWorker(userId: string): Promise<MatchWorker> {
  const [profile, availability] = await Promise.all([
    supabase.from('worker_profiles').select('*').eq('user_id', userId).single(),
    supabase.from('worker_availability').select('start_date, end_date').eq('worker_id', userId),
  ]);
  if (profile.error) throw profile.error;
  const p = profile.data;
  const { data: pc } = await supabase
    .from('postcodes')
    .select('lat, lng')
    .eq('postcode', p.current_postcode)
    .maybeSingle();
  return {
    id: userId,
    availability: (availability.data ?? []).map((a) => ({ startDate: a.start_date, endDate: a.end_date })),
    location: pc ? { lat: pc.lat, lng: pc.lng } : null,
    hasCar: p.has_car,
    needsAccommodation: p.needs_accommodation,
    skills: p.skills,
    yearsExperience: p.years_experience,
    reliability: null,
  };
}

type FeedArgs = Database['public']['Functions']['job_feed']['Args'];

/** Candidate jobs from the database (filtered), ordered by the matching module (ranked). */
async function loadRankedJobs(userId: string, args: FeedArgs): Promise<RankedFeedJob[]> {
  const [worker, feed] = await Promise.all([loadMatchWorker(userId), supabase.rpc('job_feed', args)]);
  if (feed.error) throw feed.error;
  const byId = new Map(feed.data.map((j) => [j.id, j]));
  return ranker.rankJobsForWorker(worker, feed.data.map(toMatchJob)).map((r) => {
    const job = byId.get(r.item.id)!;
    return {
      job,
      score: r.score,
      breakdown: r.breakdown,
      specified: specifiedFor(job),
    };
  });
}

export function useFeed(userId: string, filters: FeedFilters) {
  return useQuery({
    queryKey: ['feed', userId, filters],
    staleTime: 60_000,
    queryFn: () =>
      loadRankedJobs(userId, {
        p_region_ids: filters.regionIds.length ? filters.regionIds : undefined,
        p_from: filters.from ?? undefined,
        p_to: filters.to ?? undefined,
        p_min_hourly_cents: filters.minHourlyCents ?? undefined,
        p_accommodation_only: filters.accommodationOnly,
      }),
  });
}

/** Jobs the worker saved for later (still open, not yet applied for or skipped). */
export function useSavedJobs(userId: string) {
  return useQuery({
    queryKey: ['saved-jobs', userId],
    queryFn: () => loadRankedJobs(userId, { p_saved_only: true }),
  });
}

export function useSwipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, direction }: { jobId: string; direction: 'like' | 'pass' }) => {
      const { error } = await supabase.rpc('swipe_job', { p_job_id: jobId, p_direction: direction });
      if (error) throw error;
    },
    onSuccess: (_d, { direction }) => {
      if (direction === 'like') qc.invalidateQueries({ queryKey: ['my-applications'] });
      qc.invalidateQueries({ queryKey: ['saved-jobs'] });
    },
  });
}

export function useUndoSwipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase.rpc('undo_swipe', { p_job_id: jobId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-applications'] }),
  });
}

export function useMyApplications() {
  return useQuery({
    queryKey: ['my-applications'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_applications');
      if (error) throw error;
      return data;
    },
  });
}

export function useWithdrawApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (applicationId: string) => {
      const { error } = await supabase.rpc('withdraw_application', { p_application_id: applicationId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-applications'] }),
  });
}

/** A verified farm's public page: details, rating and open jobs. */
export function useFarmPage(farmId: string | undefined) {
  return useQuery({
    queryKey: ['farm-page', farmId],
    enabled: !!farmId,
    queryFn: async () => {
      const [farm, jobs] = await Promise.all([
        supabase.from('farms_public').select('*').eq('id', farmId!).maybeSingle(),
        supabase.rpc('farm_open_jobs', { p_farm_id: farmId! }),
      ]);
      if (farm.error) throw farm.error;
      if (jobs.error) throw jobs.error;
      return { farm: farm.data, jobs: jobs.data };
    },
  });
}

export function useApplyFromFarmPage(farmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase.rpc('swipe_job', { p_job_id: jobId, p_direction: 'like' });
      if (error) throw error;
    },
    onSuccess: () => {
      for (const key of [['farm-page', farmId], ['my-applications'], ['feed']])
        qc.invalidateQueries({ queryKey: key });
    },
  });
}

/** Save a job for later (keeps it out of the feed), or remove it from the saved list. */
export function useSaveJob(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, saved }: { jobId: string; saved: boolean }) => {
      const { error } = saved
        ? await supabase.from('saved_jobs').insert({ worker_id: userId, job_id: jobId })
        : await supabase.from('saved_jobs').delete().eq('worker_id', userId).eq('job_id', jobId);
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-jobs'] });
    },
  });
}
