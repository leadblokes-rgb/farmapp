// Load translations before anything renders.
import '@/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, useRootNavigationState, useSegments, type Href } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { needsLegalConsent } from '@croppr/shared';
import { registerForPush, useNotificationDeepLinks } from '@/lib/push';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { theme } from '@/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30_000 } },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        {/* Data and auth providers sit above PaperProvider: Paper's <Portal> (modals, dialogs)
            renders at the PaperProvider level, so anything below it is out of reach for portals. */}
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <PaperProvider theme={theme}>
              <StatusBar style="dark" />
              <RootNavigator />
            </PaperProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Exactly one group is reachable for each auth state, so Expo Router sends the user
 * to the right place automatically whenever their session or role changes.
 */
function RootNavigator() {
  const { loading, session, profile, onboarded } = useAuth();
  const ready = !loading && !!session && profile?.status === 'active' && !!profile.role && onboarded;
  const userId = session?.user.id;

  // Register this device for push once the user is fully set up, and open tapped notifications.
  useEffect(() => {
    if (ready && userId) registerForPush(userId).catch(() => {});
  }, [ready, userId]);
  useNotificationDeepLinks(ready);

  if (loading) {
    return (
      <View style={[styles.flex, styles.centre]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const signedIn = session !== null;
  const active = profile?.status === 'active';
  // Everyone accepts the current terms and privacy policy before anything else.
  const consent = signedIn && active && !!profile && needsLegalConsent(profile);
  const role = active && !consent ? profile?.role : null;

  // Where this user belongs right now. When their area changes (signed in, onboarded, signed out…)
  // we navigate there explicitly, so a fresh sign-in lands on the first tab rather than whichever
  // route the guard falls back to. Deep links inside the right area (e.g. a chat) are left alone.
  const home: Href = !signedIn
    ? '/'
    : !active
      ? '/suspended'
      : consent
        ? '/consent'
        : role == null
          ? '/choose-role'
          : role === 'worker'
            ? onboarded
              ? '/worker'
              : '/worker-onboarding'
            : role === 'farm'
              ? onboarded
                ? '/farm'
                : '/farm-onboarding'
              : '/admin';

  return (
    <GuardedStack
      home={home}
      signedIn={signedIn}
      active={active}
      consent={consent}
      role={role}
      onboarded={onboarded}
    />
  );
}

function GuardedStack({
  home,
  signedIn,
  active,
  consent,
  role,
  onboarded,
}: {
  home: Href;
  signedIn: boolean;
  active: boolean;
  consent: boolean;
  role: string | null | undefined;
  onboarded: boolean;
}) {
  const segments = useSegments();
  const navReady = !!useRootNavigationState()?.key;
  const homeArea = String(home).split('/')[1] || '(auth)';

  useEffect(() => {
    // The legal documents can be read from anywhere (welcome screen, consent screen, profile).
    if (navReady && segments[0] !== homeArea && segments[0] !== 'legal') router.replace(home);
  }, [navReady, home, homeArea, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !active}>
        <Stack.Screen name="suspended" />
      </Stack.Protected>
      <Stack.Protected guard={consent}>
        <Stack.Screen name="consent" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && active && !consent && role == null}>
        <Stack.Screen name="choose-role" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'worker' && !onboarded}>
        <Stack.Screen name="worker-onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'worker' && onboarded}>
        <Stack.Screen name="worker" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'farm' && !onboarded}>
        <Stack.Screen name="farm-onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'farm' && onboarded}>
        <Stack.Screen name="farm" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'admin'}>
        <Stack.Screen name="admin" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centre: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
});
