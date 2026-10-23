// Ranks a job's applicants with the matching module and stores the scores.
// POST { "jobId": "<uuid>" } with the farm user's JWT. Returns { ranked, rankerVersion }.
//
// The ranking code is packages/matching, bundled into ../_shared/matching.js by
// `npm run build:functions`. Swapping in an AI ranker only changes that package.
import { ranker } from '../_shared/matching.js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function rest<T>(path: string, init: RequestInit & { key?: string; jwt?: string } = {}): Promise<T> {
  const key = init.key ?? SERVICE_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${init.jwt ?? key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

const inList = (ids: string[]) => `in.(${ids.map((id) => `"${id}"`).join(',')})`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'Not signed in' }, 401);
    const { jobId } = await req.json();
    if (typeof jobId !== 'string') return json({ error: 'jobId required' }, 400);

    // Authorise as the caller: only the farm that owns the job may rank it.
    const owns = await rest<boolean>('rpc/owns_job', {
      method: 'POST',
      key: ANON_KEY,
      jwt,
      body: JSON.stringify({ p_job_id: jobId }),
    });
    if (!owns) return json({ error: 'Not your job' }, 403);

    // Load everything with the service role (RLS already enforced the ownership check above).
    const [job] = await rest<any[]>(
      `jobs?id=eq.${jobId}&select=id,role_type,start_date,end_date,lat,lng,car_required,transport_provided,accommodation_provided,pay_type,pay_rate_cents,min_hourly_guarantee_cents`,
    );
    const apps = await rest<{ id: string; worker_id: string }[]>(
      `applications?job_id=eq.${jobId}&status=in.(applied,accepted)&select=id,worker_id`,
    );
    if (!apps.length) return json({ ranked: [], rankerVersion: ranker.version });

    const workerIds = apps.map((a) => a.worker_id);
    const [profiles, availability, reputation] = await Promise.all([
      rest<any[]>(
        `worker_profiles?user_id=${inList(workerIds)}&select=user_id,current_postcode,has_car,needs_accommodation,skills,years_experience`,
      ),
      rest<any[]>(`worker_availability?worker_id=${inList(workerIds)}&select=worker_id,start_date,end_date`),
      // Revealed reliability ratings, with no-shows counted as 1 star (see worker_reputation in SQL).
      rest<{ worker_id: string; reliability_score: number | null }[]>('rpc/worker_reputation', {
        method: 'POST',
        body: JSON.stringify({ p_worker_ids: workerIds }),
      }),
    ]);
    const reliabilityOf = new Map(reputation.map((r) => [r.worker_id, r.reliability_score]));
    const postcodes = await rest<{ postcode: string; lat: number; lng: number }[]>(
      `postcodes?postcode=${inList([...new Set(profiles.map((p) => p.current_postcode))])}&select=postcode,lat,lng`,
    );
    const coords = new Map(postcodes.map((p) => [p.postcode, { lat: p.lat, lng: p.lng }]));

    const matchJob = {
      id: job.id,
      roleType: job.role_type,
      startDate: job.start_date,
      endDate: job.end_date,
      location: job.lat != null ? { lat: job.lat, lng: job.lng } : null,
      carRequired: job.car_required,
      transportProvided: job.transport_provided,
      accommodationProvided: job.accommodation_provided,
      effectiveHourlyCents: job.pay_type === 'hourly' ? job.pay_rate_cents : (job.min_hourly_guarantee_cents ?? 0),
    };
    const workers = profiles.map((p) => ({
      id: p.user_id,
      availability: availability
        .filter((a) => a.worker_id === p.user_id)
        .map((a) => ({ startDate: a.start_date, endDate: a.end_date })),
      location: coords.get(p.current_postcode) ?? null,
      hasCar: p.has_car,
      needsAccommodation: p.needs_accommodation,
      skills: p.skills,
      yearsExperience: p.years_experience,
      reliability: reliabilityOf.get(p.user_id) ?? null,
    }));

    const ranked = ranker.rankApplicants(matchJob, workers);
    const appByWorker = new Map(apps.map((a) => [a.worker_id, a.id]));
    const scores = ranked.map((r) => ({
      application_id: appByWorker.get(r.item.id),
      score: r.score,
      breakdown: r.breakdown,
    }));

    await rest('rpc/save_match_scores', {
      method: 'POST',
      body: JSON.stringify({ p_scores: scores, p_ranker_version: ranker.version }),
    });

    return json({
      rankerVersion: ranker.version,
      ranked: scores.map((s) => ({ applicationId: s.application_id, score: s.score })),
    });
  } catch (e) {
    console.error(e);
    return json({ error: 'Ranking failed' }, 500);
  }
});
