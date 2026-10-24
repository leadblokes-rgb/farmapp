// Sends push notifications via the Expo Push API. Called only by the database (public.notify)
// with the service role key, after:
//   application_created  -> the farm owner ("New applicant")
//   application_decided  -> the worker (accepted / not this time)
//   message              -> the other person in the conversation
//   no_show_marked       -> the worker (with a way to dispute it)
//   application_completed -> the worker ("How was it? Leave a rating")
//   check_in_reminder    -> the farm owner, on a job's first day
//   work_outcome_request -> the worker, when a job ends ("Did this work out?")
//   work_outcome_request_farm -> the farm owner, once per ended job
//   job_alert            -> workers whose job alert matches a new job: great matches (by the
//                           ranker's score) are pushed straight away, the rest wait for the digest
//   job_alert_digest     -> once a day, one summary per worker of the jobs waiting for them
// Every attempt is written to public.notification_log. People can turn off messages, updates
// and reminders in their notification settings (public.notification_prefs).
import { ranker, weights } from '../_shared/matching.js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

interface Notice {
  recipientId: string;
  title: string;
  body: string;
  url: string;
}

const firstName = (full: string) => full.split(' ')[0];

async function workerName(userId: string): Promise<string> {
  const [w] = await rest<{ full_name: string }[]>(`worker_profiles?user_id=eq.${userId}&select=full_name`);
  return w?.full_name ?? 'Worker';
}
const preview = (s: string) => (s.length > 120 ? `${s.slice(0, 117)}…` : s);

async function build(event: string, payload: Record<string, string>): Promise<Notice | null> {
  if (event === 'application_created' || event === 'application_decided') {
    const [a] = await rest<any[]>(
      `applications?id=eq.${payload.application_id}&select=id,status,worker_id,job:jobs(id,title,farm:farms(owner_id,business_name))`,
    );
    if (!a) return null;
    if (event === 'application_created') {
      return {
        recipientId: a.job.farm.owner_id,
        title: `New applicant for ${a.job.title}`,
        body: `${firstName(await workerName(a.worker_id))} applied. Tap to review your shortlist.`,
        url: `/farm/job/${a.job.id}`,
      };
    }
    const [conv] = await rest<any[]>(`conversations?application_id=eq.${a.id}&select=id`);
    return a.status === 'accepted'
      ? {
          recipientId: a.worker_id,
          title: "You're in! 🎉",
          body: `${a.job.farm.business_name} accepted you for ${a.job.title}. Say hello in Croppr.`,
          url: conv ? `/worker/chat/${conv.id}` : '/worker/matches',
        }
      : {
          recipientId: a.worker_id,
          title: `Update on ${a.job.title}`,
          body: `${a.job.farm.business_name} has filled this role. Keep swiping, there are more jobs waiting.`,
          url: '/worker/matches',
        };
  }

  if (event === 'no_show_marked' || event === 'application_completed') {
    const [a] = await rest<any[]>(
      `applications?id=eq.${payload.application_id}&select=id,worker_id,job:jobs(id,title,farm:farms(business_name))`,
    );
    if (!a) return null;
    return event === 'no_show_marked'
      ? {
          recipientId: a.worker_id,
          title: `${a.job.farm.business_name} marked you as a no-show`,
          body: `For ${a.job.title}. Not right? Tap to dispute it.`,
          url: '/worker/matches',
        }
      : {
          recipientId: a.worker_id,
          title: `How was ${a.job.farm.business_name}?`,
          body: `You finished ${a.job.title}. Leave a rating to help other workers.`,
          url: '/worker/matches',
        };
  }

  if (event === 'work_outcome_request') {
    const [a] = await rest<any[]>(
      `applications?id=eq.${payload.application_id}&select=id,worker_id,job:jobs(title,farm:farms(business_name))`,
      { headers: { Prefer: 'return=representation' } },
    );
    if (!a) return null;
    return {
      recipientId: a.worker_id,
      title: `Did ${a.job.title} work out?`,
      body: `Tell us how it went at ${a.job.farm.business_name}. It confirms your work record.`,
      url: '/worker/matches',
    };
  }

  if (event === 'work_outcome_request_farm') {
    const [j] = await rest<any[]>(`jobs?id=eq.${payload.job_id}&select=id,title,farm:farms(owner_id)`, {
      headers: { Prefer: 'return=representation' },
    });
    if (!j) return null;
    return {
      recipientId: j.farm.owner_id,
      title: `${j.title} has ended`,
      body: 'Did your crew work out? Tap to confirm who worked.',
      url: `/farm/job/${j.id}`,
    };
  }

  if (event === 'check_in_reminder') {
    const [j] = await rest<any[]>(`jobs?id=eq.${payload.job_id}&select=id,title,farm:farms(owner_id)`);
    if (!j) return null;
    return {
      recipientId: j.farm.owner_id,
      title: `Day one: ${j.title}`,
      body: 'Who turned up? Tap to check in your crew.',
      url: `/farm/job/attendance/${j.id}`,
    };
  }

  if (event === 'message') {
    const [m] = await rest<any[]>(
      `messages?id=eq.${payload.message_id}&select=body,sender_id,conversation:conversations(id,worker_id,farm:farms(owner_id,business_name))`,
    );
    if (!m) return null;
    const c = m.conversation;
    const fromWorker = m.sender_id === c.worker_id;
    return {
      recipientId: fromWorker ? c.farm.owner_id : c.worker_id,
      title: fromWorker ? await workerName(c.worker_id) : c.farm.business_name,
      body: preview(m.body),
      url: fromWorker ? `/farm/chat/${c.id}` : `/worker/chat/${c.id}`,
    };
  }
  return null;
}

// Job alerts: score each matching worker (see job_alert_recipients in SQL). Great matches are
// pushed now (at most JOB_ALERT_MAX_INSTANT_PER_DAY a day); the rest are queued for the digest.
async function jobAlerts(jobId: string): Promise<Notice[]> {
  const [j] = await rest<any[]>(
    `jobs?id=eq.${jobId}&select=id,title,role_type,start_date,end_date,lat,lng,car_required,transport_provided,accommodation_provided,pay_type,pay_rate_cents,min_hourly_guarantee_cents,employment_type,farm:farms(business_name)`,
    { headers: { Prefer: 'return=representation' } },
  );
  if (!j) return [];
  const recipients = await rest<{ worker_id: string }[]>('rpc/job_alert_recipients', {
    method: 'POST',
    body: JSON.stringify({ p_job_id: jobId }),
    headers: { Prefer: 'return=representation' },
  });
  if (!recipients.length) return [];
  const ids = inList(recipients.map((r) => r.worker_id));
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [alerts, profiles, availability, sentToday] = await Promise.all([
    rest<{ worker_id: string; instant_top_matches: boolean }[]>(
      `job_alerts?worker_id=${ids}&select=worker_id,instant_top_matches`,
      { headers: { Prefer: 'return=representation' } },
    ),
    rest<any[]>(
      `worker_profiles?user_id=${ids}&select=user_id,current_postcode,has_car,needs_accommodation,skills,years_experience`,
      { headers: { Prefer: 'return=representation' } },
    ),
    rest<any[]>(`worker_availability?worker_id=${ids}&select=worker_id,start_date,end_date`, {
      headers: { Prefer: 'return=representation' },
    }),
    rest<{ recipient_id: string }[]>(
      `notification_log?event=eq.job_alert_instant&recipient_id=${ids}&created_at=gt.${since}&select=recipient_id`,
      { headers: { Prefer: 'return=representation' } },
    ),
  ]);
  const postcodes = profiles.length
    ? await rest<{ postcode: string; lat: number; lng: number }[]>(
        `postcodes?postcode=${inList([...new Set(profiles.map((p) => p.current_postcode))])}&select=postcode,lat,lng`,
        { headers: { Prefer: 'return=representation' } },
      )
    : [];
  const coords = new Map(postcodes.map((p) => [p.postcode, { lat: p.lat, lng: p.lng }]));
  const instantOn = new Map(alerts.map((a) => [a.worker_id, a.instant_top_matches]));
  const instantCount = new Map<string, number>();
  for (const r of sentToday) instantCount.set(r.recipient_id, (instantCount.get(r.recipient_id) ?? 0) + 1);

  const hourly = j.pay_type === 'hourly' ? j.pay_rate_cents : j.min_hourly_guarantee_cents;
  const matchJob = {
    id: j.id,
    roleType: j.role_type,
    startDate: j.start_date,
    endDate: j.end_date,
    location: j.lat != null ? { lat: j.lat, lng: j.lng } : null,
    carRequired: j.car_required,
    transportProvided: j.transport_provided,
    accommodationProvided: j.accommodation_provided,
    effectiveHourlyCents: hourly ?? 0,
    employmentType: j.employment_type,
  };
  const pay = hourly ? ` · from $${(hourly / 100).toFixed(2)}/hr` : '';
  const notices: Notice[] = [];
  const queue: { worker_id: string; job_id: string; score: number }[] = [];
  for (const p of profiles) {
    const worker = {
      id: p.user_id,
      availability: availability
        .filter((a) => a.worker_id === p.user_id)
        .map((a) => ({ startDate: a.start_date, endDate: a.end_date })),
      location: coords.get(p.current_postcode) ?? null,
      hasCar: p.has_car,
      needsAccommodation: p.needs_accommodation,
      skills: p.skills ?? [],
      yearsExperience: p.years_experience ?? 0,
      reliability: null,
    };
    const [{ score }] = ranker.rankJobsForWorker(worker, [matchJob]);
    const instant =
      instantOn.get(p.user_id) !== false &&
      score >= weights.JOB_ALERT_INSTANT_MIN_SCORE &&
      (instantCount.get(p.user_id) ?? 0) < weights.JOB_ALERT_MAX_INSTANT_PER_DAY;
    if (instant) {
      notices.push({
        recipientId: p.user_id,
        title: `Great match: ${j.title}`,
        body: `${j.farm.business_name}${pay}. Tap to have a look.`,
        url: '/worker',
      });
    } else {
      queue.push({ worker_id: p.user_id, job_id: j.id, score });
    }
  }
  if (queue.length) {
    await rest('job_alert_queue', {
      method: 'POST',
      body: JSON.stringify(queue),
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    });
  }
  return notices;
}

// The daily digest: one push per worker with jobs waiting in the queue.
async function jobDigests(): Promise<Notice[]> {
  const rows = await rest<
    { worker_id: string; job_count: number; top_job_title: string; top_farm_name: string }[]
  >('rpc/take_job_alert_digests', {
    method: 'POST',
    body: '{}',
    headers: { Prefer: 'return=representation' },
  });
  return rows.map((r) => ({
    recipientId: r.worker_id,
    title: r.job_count === 1 ? '1 new job for you today' : `${r.job_count} new jobs for you today`,
    body:
      r.job_count === 1
        ? `${r.top_job_title} at ${r.top_farm_name}. Tap to have a look.`
        : `Including ${r.top_job_title} at ${r.top_farm_name}. Tap to have a look.`,
    url: '/worker',
  }));
}

const inList = (ids: string[]) => `in.(${ids.map((id) => `"${id}"`).join(',')})`;

// Which notification setting covers each event (job alerts have their own settings).
const PREF_FOR_EVENT: Record<string, 'messages' | 'updates' | 'reminders'> = {
  message: 'messages',
  application_created: 'updates',
  application_decided: 'updates',
  no_show_marked: 'updates',
  application_completed: 'updates',
  work_outcome_request: 'updates',
  work_outcome_request_farm: 'updates',
  check_in_reminder: 'reminders',
};

async function mutedByPrefs(event: string, recipientId: string): Promise<boolean> {
  const pref = PREF_FOR_EVENT[event];
  if (!pref) return false;
  const [p] = await rest<Record<string, boolean>[]>(
    `notification_prefs?user_id=eq.${recipientId}&select=${pref}`,
    {
      headers: { Prefer: 'return=representation' },
    },
  );
  return p ? p[pref] === false : false;
}

async function deliver(event: string, notice: Notice): Promise<string> {
  if (await mutedByPrefs(event, notice.recipientId)) {
    await rest('notification_log', {
      method: 'POST',
      body: JSON.stringify({
        event,
        recipient_id: notice.recipientId,
        title: notice.title,
        outcome: 'muted',
      }),
    });
    return 'muted';
  }
  const tokens = await rest<{ expo_token: string }[]>(
    `push_tokens?user_id=eq.${notice.recipientId}&select=expo_token`,
    { headers: { Prefer: 'return=representation' } },
  );
  let outcome = 'no_tokens';
  if (tokens.length) {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(
        tokens.map((t) => ({
          to: t.expo_token,
          title: notice.title,
          body: notice.body,
          sound: 'default',
          data: { url: notice.url },
        })),
      ),
    }).catch((e) => ({ ok: false, status: 0, statusText: String(e) }) as Response);
    outcome = res.ok ? 'sent' : `expo_error_${res.status}`;
  }
  await rest('notification_log', {
    method: 'POST',
    body: JSON.stringify({
      event,
      recipient_id: notice.recipientId,
      title: notice.title,
      body: notice.body,
      url: notice.url,
      tokens: tokens.length,
      outcome,
    }),
  });
  return outcome;
}

Deno.serve(async (req) => {
  if (req.headers.get('Authorization') !== `Bearer ${SERVICE_KEY}`) {
    return new Response('Forbidden', { status: 403 });
  }
  const { event, ...payload } = await req.json();
  let current: Notice | null = null;
  try {
    const notices =
      event === 'job_alert'
        ? await jobAlerts(payload.job_id)
        : event === 'job_alert_digest'
          ? await jobDigests()
          : [await build(event, payload)];
    // Instant job alerts are logged separately so send-push can cap them per day.
    const logAs = event === 'job_alert' ? 'job_alert_instant' : event;
    const outcomes: string[] = [];
    for (const notice of notices) {
      if (!notice) continue;
      current = notice;
      outcomes.push(await deliver(logAs, notice));
    }
    return Response.json(outcomes.length ? { outcomes } : { skipped: true });
  } catch (e) {
    console.error(e);
    await rest('notification_log', {
      method: 'POST',
      body: JSON.stringify({
        event,
        recipient_id: current?.recipientId ?? null,
        outcome: `error: ${String(e).slice(0, 200)}`,
      }),
    }).catch(() => {});
    return new Response('error', { status: 500 });
  }
});
