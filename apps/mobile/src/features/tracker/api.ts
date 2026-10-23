import { estimateDays, todayIso, type DayEstimate, type TrackerGoal } from '@croppr/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { uploadUserFileFromUri } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export interface TrackerData {
  goal: TrackerGoal;
  visaType: string | null;
  employers: {
    id: string;
    name: string;
    postcode: string | null;
    abn: string | null;
    counts_as_specified: boolean;
  }[];
  shifts: { id: string; employer_id: string; work_date: string; hours: number; notes: string }[];
  payslips: {
    id: string;
    employer_id: string;
    period_start: string;
    period_end: string;
    days_worked: number;
    hours_total: number;
    file_path: string | null;
  }[];
  estimate: DayEstimate;
}

export function useTracker(userId: string) {
  return useQuery({
    queryKey: ['tracker', userId],
    queryFn: async (): Promise<TrackerData> => {
      const [priv, employers, shifts, payslips] = await Promise.all([
        supabase.from('worker_private').select('tracker_goal, visa_type').eq('user_id', userId).maybeSingle(),
        supabase
          .from('employers_worked')
          .select('id, name, postcode, abn, counts_as_specified')
          .order('created_at'),
        supabase
          .from('shift_logs')
          .select('id, employer_id, work_date, hours, notes')
          .order('work_date', { ascending: false }),
        supabase
          .from('payslips')
          .select('id, employer_id, period_start, period_end, days_worked, hours_total, file_path')
          .order('period_start', { ascending: false }),
      ]);
      for (const r of [priv, employers, shifts, payslips]) if (r.error) throw r.error;

      const goal = (priv.data?.tracker_goal ?? 'second') as TrackerGoal;
      const shiftRows = (shifts.data ?? []).map((s) => ({ ...s, hours: Number(s.hours) }));
      const payslipRows = (payslips.data ?? []).map((p) => ({ ...p, hours_total: Number(p.hours_total) }));
      const estimate = estimateDays(
        (employers.data ?? []).map((e) => ({
          id: e.id,
          name: e.name,
          countsAsSpecified: e.counts_as_specified,
          postcode: e.postcode,
        })),
        shiftRows.map((s) => ({ employerId: s.employer_id, workDate: s.work_date, hours: s.hours })),
        payslipRows.map((p) => ({
          employerId: p.employer_id,
          periodStart: p.period_start,
          periodEnd: p.period_end,
          daysWorked: p.days_worked,
          hoursTotal: p.hours_total,
        })),
        { goal, today: todayIso(), visaType: priv.data?.visa_type ?? null },
      );
      return {
        goal,
        visaType: priv.data?.visa_type ?? null,
        employers: employers.data ?? [],
        shifts: shiftRows,
        payslips: payslipRows,
        estimate,
      };
    },
  });
}

function useTrackerMutation<T>(userId: string, fn: (v: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: T) => {
      await fn(v);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tracker', userId] });
      qc.invalidateQueries({ queryKey: ['employer-suggestions'] });
    },
  });
}

const check = <R extends { error: unknown }>(r: R) => {
  if (r.error) throw r.error;
  return r;
};

export function useSetGoal(userId: string) {
  return useTrackerMutation(userId, async (goal: TrackerGoal) =>
    check(await supabase.from('worker_private').update({ tracker_goal: goal }).eq('user_id', userId)),
  );
}

export interface EmployerInput {
  name: string;
  postcode: string;
  abn: string;
  countsAsSpecified: boolean;
  farmId?: string;
  jobId?: string;
}

export function useSaveEmployer(userId: string) {
  return useTrackerMutation(userId, async ({ id, v }: { id?: string; v: EmployerInput }) => {
    const row = {
      worker_id: userId,
      name: v.name.trim(),
      postcode: v.postcode || null,
      abn: v.abn.replace(/\s/g, '') || null,
      counts_as_specified: v.countsAsSpecified,
      farm_id: v.farmId ?? null,
      job_id: v.jobId ?? null,
    };
    check(
      id
        ? await supabase.from('employers_worked').update(row).eq('id', id)
        : await supabase.from('employers_worked').insert(row),
    );
  });
}

export function useDeleteEmployer(userId: string) {
  return useTrackerMutation(userId, async (id: string) =>
    check(await supabase.from('employers_worked').delete().eq('id', id)),
  );
}

export function useLogShift(userId: string) {
  return useTrackerMutation(userId, async (s: { employerId: string; workDate: string; hours: number }) =>
    check(
      await supabase
        .from('shift_logs')
        .upsert(
          { worker_id: userId, employer_id: s.employerId, work_date: s.workDate, hours: s.hours },
          { onConflict: 'employer_id,work_date' },
        ),
    ),
  );
}

export function useDeleteShift(userId: string) {
  return useTrackerMutation(userId, async (id: string) =>
    check(await supabase.from('shift_logs').delete().eq('id', id)),
  );
}

export interface PayslipInput {
  employerId: string;
  periodStart: string;
  periodEnd: string;
  daysWorked: number;
  hoursTotal: number;
  file: { uri: string; name: string; mimeType: string } | null;
}

export function useAddPayslip(userId: string) {
  return useTrackerMutation(userId, async (p: PayslipInput) => {
    const filePath = p.file
      ? await uploadUserFileFromUri({
          bucket: 'payslips',
          userId,
          uri: p.file.uri,
          name: p.file.name,
          mimeType: p.file.mimeType,
        })
      : null;
    check(
      await supabase.from('payslips').insert({
        worker_id: userId,
        employer_id: p.employerId,
        period_start: p.periodStart,
        period_end: p.periodEnd,
        days_worked: p.daysWorked,
        hours_total: p.hoursTotal,
        file_path: filePath,
      }),
    );
  });
}

export function useDeletePayslip(userId: string) {
  return useTrackerMutation(userId, async (p: { id: string; filePath: string | null }) => {
    if (p.filePath) await supabase.storage.from('payslips').remove([p.filePath]);
    check(await supabase.from('payslips').delete().eq('id', p.id));
  });
}

export function useEmployerSuggestions() {
  return useQuery({
    queryKey: ['employer-suggestions'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('employer_suggestions');
      if (error) throw error;
      return data;
    },
  });
}
