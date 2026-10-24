-- Chat contact filter: until a farm accepts a worker (application accepted or completed), phone
-- numbers, email addresses, links and social handles in their chat are replaced with "#####".
-- It runs in the database, so no app version can get around it. The original text is kept in
-- contact_share_attempts for admins only, to spot accounts that keep trying to move off Croppr.
-- Expect it to catch most attempts, not all; repeat offenders are handled through admin review.

create function public.mask_contact_details(p_body text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  s text := p_body;
  digit_word constant text := '(zero|oh|nought|one|two|three|four|five|six|seven|eight|nine)';
  sep constant text := '[\s().-]*';
begin
  -- Links: http(s)://, www., and bare domains such as wa.me/..., bit.ly/..., farm.com.au
  s := regexp_replace(s, '(https?://|www\.)\S+', '#####', 'gi');
  -- Email addresses, including "name at gmail dot com" style.
  s := regexp_replace(s, '[[:alnum:]._%+-]+@[[:alnum:]-]+(\.[[:alnum:]-]+)*\.[[:alpha:]]{2,}', '#####', 'gi');
  -- Bare domains (after full emails, before spelled-out emails so "us at farm.com.au" stays a link).
  s := regexp_replace(s, '\m[[:alnum:]-]+\.(com|net|org|io|me|ly|gg|app|link)(\.au)?(/\S*)?\M', '#####', 'gi');
  s := regexp_replace(s,
    '[[:alnum:]._%+-]+\s*(\(at\)|\[at\]|\s+at\s+)\s*[[:alnum:]-]+\s*(\.|\(dot\)|\[dot\]|\s+dot\s+)\s*(com|net|org|au|co|uk|io|me)\M',
    '#####', 'gi');
  -- Phone numbers: +country codes, Australian 0X numbers (10 digits), or any run of 9+ digits,
  -- with spaces, dots, dashes or brackets in between. Dates like 21-10-2026 (8 digits) are left alone.
  s := regexp_replace(s, '\+' || '(' || sep || '\d){8,}', '#####', 'gi');
  s := regexp_replace(s, '\m0(' || sep || '\d){8,}', '#####', 'gi');
  s := regexp_replace(s, '\d(' || sep || '\d){8,}', '#####', 'gi');
  -- Numbers spelled out: "zero four one two ..." (8+ digits/words, starting with a word).
  s := regexp_replace(s,
    '\m' || digit_word || '\M([\s,.-]*(\m' || digit_word || '\M|\d)){7,}',
    '#####', 'gi');
  -- Social handles: "@handle", and "insta: zane_farm", "whatsapp bob123", "fb john.smith".
  s := regexp_replace(s, '(^|\s)@[[:alnum:]._]{3,}', '\1#####', 'gi');
  s := regexp_replace(s,
    '\m(whats\s?app|insta|instagram|snap|snapchat|facebook|fb|messenger|telegram|wechat|viber|kik|tiktok)\M'
    || '\s*(:|-|is|id|handle|@)?\s*@?[[:alnum:]_]*[._\d][[:alnum:]._]*',
    '#####', 'gi');
  return s;
end;
$$;

alter table public.messages add column contact_masked boolean not null default false;

create table public.contact_share_attempts (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  original_body text not null,
  created_at timestamptz not null default now()
);
alter table public.contact_share_attempts enable row level security;
-- No policies: app users can't read or write it. Admins use the dashboard (view below).

create function public.mask_contact_before_hire()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hired boolean;
  masked text;
begin
  select a.status in ('accepted', 'completed') into hired
  from public.conversations c join public.applications a on a.id = c.application_id
  where c.id = new.conversation_id;
  if coalesce(hired, false) then
    return new;
  end if;
  masked := public.mask_contact_details(new.body);
  if masked is distinct from new.body then
    insert into public.contact_share_attempts (conversation_id, sender_id, original_body)
    values (new.conversation_id, new.sender_id, new.body);
    new.body := masked;
    new.contact_masked := true;
  end if;
  return new;
end;
$$;
create trigger messages_mask_contact before insert on public.messages
  for each row execute function public.mask_contact_before_hire();

-- Who keeps trying to share contact details before a hire (last 30 days), most attempts first.
create view public.admin_contact_share_attempts as
  select a.sender_id, u.email as sender_email, p.role as sender_role,
         count(*) as attempts_30_days, max(a.created_at) as latest_attempt,
         (array_agg(a.original_body order by a.created_at desc))[1] as latest_original
  from public.contact_share_attempts a
  join auth.users u on u.id = a.sender_id
  join public.profiles p on p.id = a.sender_id
  where a.created_at > now() - interval '30 days'
  group by a.sender_id, u.email, p.role
  order by count(*) desc;
revoke all on public.admin_contact_share_attempts from public, anon, authenticated;
