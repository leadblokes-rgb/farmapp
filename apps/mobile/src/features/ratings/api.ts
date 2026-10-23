import type { Database } from '@croppr/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

type Fns = Database['public']['Functions'];
export type PendingReview = Fns['pending_reviews']['Returns'][number];
export type FarmReview = Fns['farm_reviews']['Returns'][number];
export type WorkerReview = Fns['worker_reviews']['Returns'][number];
export type AttendanceStatus = Database['public']['Enums']['attendance_status'];

/**
 * Ratings still to give. Finishing jobs first means completion doesn't depend on the daily
 * database job having run (e.g. in local development).
 */
export function usePendingReviews() {
  return useQuery({
    queryKey: ['pending-reviews'],
    queryFn: async () => {
      await supabase.rpc('complete_finished_jobs');
      const { data, error } = await supabase.rpc('pending_reviews');
      if (error) throw error;
      return data;
    },
  });
}

function useRatingsMutation<T>(fn: (input: T) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of [
        'pending-reviews',
        'my-applications',
        'shortlist',
        'farm-reviews',
        'worker-reviews',
        'feed',
      ])
        qc.invalidateQueries({ queryKey: [key] });
    },
  });
}

export interface FarmRatingInput {
  applicationId: string;
  overall: number;
  accommodation: number | null;
  wouldWorkAgain: boolean;
  comment: string;
}

export function useRateFarm() {
  return useRatingsMutation(async (r: FarmRatingInput) => {
    const { error } = await supabase.rpc('rate_farm', {
      p_application_id: r.applicationId,
      p_overall: r.overall,
      p_would_work_again: r.wouldWorkAgain,
      p_accommodation: r.accommodation ?? undefined,
      p_comment: r.comment,
    });
    if (error) throw error;
  });
}

export interface WorkerRatingInput {
  applicationId: string;
  reliability: number;
  quality: number;
  comment: string;
}

export function useRateWorker() {
  return useRatingsMutation(async (r: WorkerRatingInput) => {
    const { error } = await supabase.rpc('rate_worker', {
      p_application_id: r.applicationId,
      p_reliability: r.reliability,
      p_quality: r.quality,
      p_comment: r.comment,
    });
    if (error) throw error;
  });
}

export function useFarmReviews(farmId: string | undefined) {
  return useQuery({
    queryKey: ['farm-reviews', farmId],
    enabled: !!farmId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('farm_reviews', { p_farm_id: farmId! });
      if (error) throw error;
      return data;
    },
  });
}

export function useWorkerReviews(workerId: string | undefined) {
  return useQuery({
    queryKey: ['worker-reviews', workerId],
    enabled: !!workerId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('worker_reviews', { p_worker_id: workerId! });
      if (error) throw error;
      return data;
    },
  });
}

export function useReportReview() {
  return useMutation({
    mutationFn: async (r: { kind: 'farm' | 'worker'; applicationId: string; details: string }) => {
      const { error } = await supabase.rpc('report_review', {
        p_kind: r.kind,
        p_application_id: r.applicationId,
        p_details: r.details,
      });
      if (error) throw error;
    },
  });
}

export function useDisputeNoShow() {
  return useRatingsMutation(async (r: { applicationId: string; details: string }) => {
    const { error } = await supabase.rpc('dispute_no_show', {
      p_application_id: r.applicationId,
      p_details: r.details,
    });
    if (error) throw error;
  });
}

export function useMarkAttendance(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: AttendanceStatus }) => {
      const { data, error } = await supabase.rpc('mark_attendance', {
        p_application_ids: ids,
        p_status: status,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shortlist', jobId] });
      qc.invalidateQueries({ queryKey: ['pending-reviews'] });
    },
  });
}
