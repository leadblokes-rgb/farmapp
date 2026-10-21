import type { Session } from '@supabase/supabase-js';
import type { Database } from '@croppr/shared';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { unregisterPush } from '@/lib/push';
import { supabase } from '@/lib/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthState {
  /** True until we know both the session and (if signed in) that user's profile. */
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  /** Worker has a worker profile / farm has registered its business. */
  onboarded: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialising, setInitialising] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  // Which user the current `profile` belongs to, so a fresh sign-in doesn't briefly
  // render with no profile (and flash the role picker).
  const [profileFor, setProfileFor] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState(false);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setProfileFor(null);
      setOnboarded(false);
      return;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    if (error) console.warn('Failed to load profile', error.message);
    setOnboarded(data ? await isOnboarded(data) : false);
    setProfile(data ?? null);
    setProfileFor(s.user.id);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session);
      setInitialising(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Defer: calling supabase inside this callback can deadlock the auth client.
      setTimeout(() => loadProfile(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const refreshProfile = useCallback(() => loadProfile(session), [loadProfile, session]);
  const signOut = useCallback(async () => {
    await unregisterPush().catch(() => {});
    await supabase.auth.signOut();
  }, []);

  const loading = initialising || (session !== null && profileFor !== session.user.id);

  return (
    <AuthContext.Provider value={{ loading, session, profile, onboarded, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

async function isOnboarded(profile: Profile): Promise<boolean> {
  const query =
    profile.role === 'worker'
      ? supabase
          .from('worker_profiles')
          .select('user_id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
      : profile.role === 'farm'
        ? supabase.from('farms').select('id', { count: 'exact', head: true }).eq('owner_id', profile.id)
        : null;
  if (!query) return true;
  const { count } = await query;
  return (count ?? 0) > 0;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/**
 * Renders children only while signed in. During sign-out the router redirects a frame after the
 * session clears, so signed-in screens are wrapped in this to never render without a user.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  return session ? <>{children}</> : null;
}

/** The signed-in user's id. Only use inside <RequireSession>. */
export function useUserId(): string {
  const { session } = useAuth();
  if (!session) throw new Error('useUserId used outside <RequireSession>');
  return session.user.id;
}
