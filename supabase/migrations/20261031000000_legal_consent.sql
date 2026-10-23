-- Terms of use and privacy policy consent. The app asks again whenever the current versions
-- (packages/shared/src/config/legal.ts) change.

alter table public.profiles
  add column terms_version text,
  add column privacy_version text,
  add column terms_accepted_at timestamptz;

create function public.accept_legal(p_terms_version text, p_privacy_version text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
     set terms_version = p_terms_version, privacy_version = p_privacy_version, terms_accepted_at = now()
   where id = auth.uid();
$$;
revoke execute on function public.accept_legal(text, text) from public, anon;
grant execute on function public.accept_legal(text, text) to authenticated;
