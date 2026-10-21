import type { Database } from '@croppr/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

type Row = Database['public']['Functions']['job_shortlist']['Returns'][number];
export type Applicant = Row & { photoUrl: string | null };
export type FactorScore = { score: number; weight: number; note: string };
export type Decision = 'accepted' | 'declined';

/**
 * Ranks applicants on the server (rank-applicants Edge Function → packages/matching), then reads
 * the shortlist. If ranking fails (e.g. patchy signal), the last stored scores are still shown.
 */
export function useShortlist(jobId: string) {
  return useQuery({
    queryKey: ['shortlist', jobId],
    queryFn: async (): Promise<{ applicants: Applicant[]; rankingFailed: boolean }> => {
      const ranked = await supabase.functions.invoke('rank-applicants', { body: { jobId } });
      const { data, error } = await supabase.rpc('job_shortlist', { p_job_id: jobId });
      if (error) throw error;

      const paths = data.map((a) => a.photo_path).filter((p): p is string => !!p);
      const signed = paths.length
        ? await supabase.storage.from('avatars').createSignedUrls(paths, 60 * 60)
        : null;
      const urlByPath = new Map((signed?.data ?? []).map((s) => [s.path, s.signedUrl]));

      return {
        rankingFailed: !!ranked.error,
        applicants: groupMembersTogether(
          data.map((a) => ({ ...a, photoUrl: a.photo_path ? (urlByPath.get(a.photo_path) ?? null) : null })),
        ),
      };
    },
  });
}

/**
 * Keeps the ranked order, but moves each travel group's members up to sit directly after the
 * group's highest-ranked member, so farms can take a whole group at once.
 */
export function groupMembersTogether<T extends { group_id: string | null }>(rows: T[]): T[] {
  const out: T[] = [];
  const placed = new Set<T>();
  for (const row of rows) {
    if (placed.has(row)) continue;
    const members = row.group_id ? rows.filter((r) => r.group_id === row.group_id) : [row];
    for (const m of members) {
      out.push(m);
      placed.add(m);
    }
  }
  return out;
}

export function useDecide(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, decision }: { ids: string[]; decision: Decision }) => {
      const { data, error } = await supabase.rpc('decide_applications', {
        p_application_ids: ids,
        p_decision: decision,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shortlist', jobId] });
      qc.invalidateQueries({ queryKey: ['job', jobId] });
      qc.invalidateQueries({ queryKey: ['my-jobs'] });
    },
  });
}

export function useApplicantAvailability(workerId: string | undefined) {
  return useQuery({
    queryKey: ['availability', workerId],
    enabled: !!workerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_availability')
        .select('start_date, end_date')
        .eq('worker_id', workerId!)
        .order('start_date');
      if (error) throw error;
      return data;
    },
  });
}
