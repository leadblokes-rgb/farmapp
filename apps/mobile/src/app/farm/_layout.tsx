import { Stack } from 'expo-router';
import { RequireSession } from '@/providers/AuthProvider';

export default function Layout() {
  return (
    <RequireSession>
      <Stack
        screenOptions={{
          headerBackButtonDisplayMode: 'minimal',
          headerTitleStyle: { fontSize: 20, fontWeight: '700' },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </RequireSession>
  );
}
