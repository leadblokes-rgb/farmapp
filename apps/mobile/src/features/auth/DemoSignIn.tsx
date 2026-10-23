// Development builds only: one-tap sign-in for the seeded demo accounts (supabase/seed.sql).
// sign-in.tsx loads this file behind `if (__DEV__)`, so production builds don't contain it at all
// (no demo emails or password in the app bundle).
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { HelperText, Text } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

const DEMO_ACCOUNTS = [
  { label: 'Demo worker', email: 'worker@demo.croppr.test' },
  { label: 'Demo farm (verified)', email: 'farm@demo.croppr.test' },
  { label: 'Demo farm (pending)', email: 'pending-farm@demo.croppr.test' },
  { label: 'Demo farm (rejected)', email: 'rejected-farm@demo.croppr.test' },
  { label: 'Demo new user (no role)', email: 'newuser@demo.croppr.test' },
];

export function DemoSignIn() {
  const [error, setError] = useState<string | null>(null);

  // Also switched off unless .env.local sets EXPO_PUBLIC_SHOW_DEMO_ACCOUNTS=true, so testing
  // against a real (hosted) project doesn't show buttons that won't work there.
  if (process.env.EXPO_PUBLIC_SHOW_DEMO_ACCOUNTS !== 'true') return null;

  async function signIn(email: string) {
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password: 'croppr-demo' });
    if (err) setError(friendlyError(err));
  }

  return (
    <View style={styles.demo}>
      <Text variant="labelLarge">Development only: seeded demo accounts</Text>
      {DEMO_ACCOUNTS.map((a) => (
        <BigButton key={a.email} mode="text" onPress={() => signIn(a.email)}>
          {a.label}
        </BigButton>
      ))}
      <HelperText type="error" visible={error !== null}>
        {error}
      </HelperText>
    </View>
  );
}

const styles = StyleSheet.create({
  demo: { marginTop: 24, gap: 4, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16 },
});
