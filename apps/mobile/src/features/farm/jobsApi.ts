import type { Database, JobInput } from '@croppr/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type Job = Database['public']['Tables']['jobs']['Row'];
export type JobStatus = Database['public']['Enums']['job_status'];
export type JobWithCounts = Job & { applications: { count: number }[] };

export function emptyJob(postcode: string, today: string): JobInput {
  return {
    title: '',
    roleType: 'picking',
    description: '',
    postcode,
    startDate: today,
    endDate: '',
    workersNeeded: 10,
    payType: 'hourly',
    payRateCents: 0,
    pieceRateUnit: '',
    minHourlyGuaranteeCents: null,
    hoursPerWeek: 38,
    accommodationProvided: false,
    accommodationCostWeekCents: null,
    transportProvided: false,
    carRequired: false,
    likelySpecifiedWork: true,
  };
}

export function jobToInput(j: Job): JobInput {
  return {
    title: j.title,
    roleType: j.role_type,
    description: j.description,
    postcode: j.postcode,
    startDate: j.start_date,
    endDate: j.end_date,
    workersNeeded: j.workers_needed,
    payType: j.pay_type,
    payRateCents: j.pay_rate_cents,
    pieceRateUnit: j.piece_rate_unit ?? '',
    minHourlyGuaranteeCents: j.min_hourly_guarantee_cents,
    hoursPerWeek: j.hours_per_week,
    accommodationProvided: j.accommodation_provided,
    accommodationCostWeekCents: j.accommodation_cost_week_cents,
    transportProvided: j.transport_provided,
    carRequired: j.car_required,
    likelySpecifiedWork: j.likely_specified_work,
  };
}

function inputToRow(v: JobInput) {
  const piece = v.payType === 'piece_rate';
  return {
    title: v.title,
    role_type: v.roleType,
    description: v.description,
    postcode: v.postcode,
    start_date: v.startDate,
    end_date: v.endDate,
    workers_needed: v.workersNeeded,
    pay_type: v.payType,
    pay_rate_cents: v.payRateCents,
    piece_rate_unit: piece ? v.pieceRateUnit : null,
    min_hourly_guarantee_cents: piece ? v.minHourlyGuaranteeCents : null,
    hours_per_week: v.hoursPerWeek,
    accommodation_provided: v.accommodationProvided,
    accommodation_cost_week_cents: v.accommodationProvided ? v.accommodationCostWeekCents : null,
    transport_provided: v.transportProvided,
    car_required: v.carRequired,
    likely_specified_work: v.likelySpecifiedWork,
  };
}

export function useMyJobs(farmId: string | undefined) {
  return useQuery({
    queryKey: ['my-jobs', farmId],
    enabled: !!farmId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, applications(count)')
        .eq('farm_id', farmId!)
        .order('status')
        .order('start_date');
      if (error) throw error;
      return data as JobWithCounts[];
    },
  });
}

export function useJob(jobId: string | undefined) {
  return useQuery({
    queryKey: ['job', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, applications(count)')
        .eq('id', jobId!)
        .single();
      if (error) throw error;
      return data as JobWithCounts;
    },
  });
}

export function useSaveJob(farmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: JobInput }) => {
      const row = inputToRow(values);
      const { data, error } = id
        ? await supabase.from('jobs').update(row).eq('id', id).select('id').single()
        : await supabase
            .from('jobs')
            .insert({ ...row, farm_id: farmId })
            .select('id')
            .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['my-jobs'] });
      qc.invalidateQueries({ queryKey: ['job', id] });
    },
  });
}

export function useSetJobStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: JobStatus }) => {
      const { error } = await supabase.from('jobs').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ['my-jobs'] });
      qc.invalidateQueries({ queryKey: ['job', id] });
    },
  });
}
