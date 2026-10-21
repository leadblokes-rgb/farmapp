import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { theme } from '@/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30_000 } },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <StatusBar style="dark" />
              <RootNavigator />
            </AuthProvider>
          </QueryClientProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Exactly one group is reachable for each auth state, so Expo Router sends the user
 * to the right place automatically whenever their session or role changes.
 */
function RootNavigator() {
  const { loading, session, profile } = useAuth();

  if (loading) {
    return (
      <View style={[styles.flex, styles.centre]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const signedIn = session !== null;
  const active = profile?.status === 'active';
  const role = active ? profile?.role : null;

  // Where this user belongs right now. Any guarded screen redirects here, so a fresh
  // sign-in lands on the first tab rather than whichever route sorts first.
  const home: Href = !signedIn
    ? '/'
    : !active
      ? '/suspended'
      : role == null
        ? '/choose-role'
        : role === 'worker'
          ? '/worker'
          : role === 'farm'
            ? '/farm'
            : '/admin';

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!signedIn} redirectTo={home}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !active} redirectTo={home}>
        <Stack.Screen name="suspended" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && active && role == null} redirectTo={home}>
        <Stack.Screen name="choose-role" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'worker'} redirectTo={home}>
        <Stack.Screen name="worker" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'farm'} redirectTo={home}>
        <Stack.Screen name="farm" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'admin'} redirectTo={home}>
        <Stack.Screen name="admin" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centre: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
});
