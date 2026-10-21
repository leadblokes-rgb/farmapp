import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerTitle: '', headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal' }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
  </Stack>;
}
