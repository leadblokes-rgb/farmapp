// Sends push notifications via the Expo Push API. Called only by the database (public.notify)
// with the service role key, after:
//   application_created  -> the farm owner ("New applicant")
//   application_decided  -> the worker (accepted / not this time)
//   message              -> the other person in the conversation
//   no_show_marked       -> the worker (with a way to dispute it)
//   application_completed -> the worker ("How was it? Leave a rating")
//   check_in_reminder    -> the farm owner, on a job's first day
// Every attempt is written to public.notification_log.

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

Deno.serve(async (req) => {
  if (req.headers.get('Authorization') !== `Bearer ${SERVICE_KEY}`) {
    return new Response('Forbidden', { status: 403 });
  }
  const { event, ...payload } = await req.json();
  let notice: Notice | null = null;
  try {
    notice = await build(event, payload);
    if (!notice) return Response.json({ skipped: true });

    const tokens = await rest<{ expo_token: string }[]>(
      `push_tokens?user_id=eq.${notice.recipientId}&select=expo_token`,
    );
    let outcome = 'no_tokens';
    if (tokens.length) {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(
          tokens.map((t) => ({
            to: t.expo_token,
            title: notice!.title,
            body: notice!.body,
            sound: 'default',
            data: { url: notice!.url },
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
    return Response.json({ outcome });
  } catch (e) {
    console.error(e);
    await rest('notification_log', {
      method: 'POST',
      body: JSON.stringify({ event, recipient_id: notice?.recipientId ?? null, outcome: `error: ${String(e).slice(0, 200)}` }),
    }).catch(() => {});
    return new Response('error', { status: 500 });
  }
});
