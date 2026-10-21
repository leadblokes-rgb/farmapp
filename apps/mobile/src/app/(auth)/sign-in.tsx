import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { HelperText, Text, TextInput } from 'react-native-paper';
import { isSelfServeRole, isValidEmail, normaliseEmail } from '@farmmatch/shared';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { supabase } from '@/lib/supabase';

const DEMO_ACCOUNTS = [
  { label: 'Demo worker', email: 'worker@demo.farmmatch.test' },
  { label: 'Demo farm', email: 'farm@demo.farmmatch.test' },
  { label: 'Demo new user (no role)', email: 'newuser@demo.farmmatch.test' },
];

export default function SignIn() {
  const params = useLocalSearchParams<{ role?: string }>();
  const role = isSelfServeRole(params.role) ? params.role : undefined;
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function sendCode() {
    const address = normaliseEmail(email);
    if (!isValidEmail(address)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setSending(true);
    // `data.role` is only used when this email is new; existing users keep their role.
    const { error: err } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true, data: role ? { role } : undefined },
    });
    setSending(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push({ pathname: '/verify', params: { email: address } });
  }

  async function demoSignIn(demoEmail: string) {
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: demoEmail, password: 'farmmatch-demo' });
    if (err) setError(err.message);
  }

  return (
    <Screen scroll edges={['bottom']}>
      <Text variant="headlineMedium">
        {role === 'farm' ? 'Sign in as a farm' : role === 'worker' ? 'Sign in to find work' : 'Sign in'}
      </Text>
      <Text variant="bodyLarge">We&apos;ll email you a 6-digit code. No password needed.</Text>
      <TextInput
        mode="outlined"
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={sendCode}
        style={styles.input}
      />
      <HelperText type="error" visible={error !== null}>
        {error}
      </HelperText>
      <BigButton onPress={sendCode} loading={sending} disabled={sending}>
        Email me a code
      </BigButton>

      {__DEV__ && (
        <View style={styles.demo}>
          <Text variant="labelLarge">Development only: seeded demo accounts</Text>
          {DEMO_ACCOUNTS.map((a) => (
            <BigButton key={a.email} mode="text" onPress={() => demoSignIn(a.email)}>
              {a.label}
            </BigButton>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { fontSize: 18 },
  demo: { marginTop: 24, gap: 4, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16 },
});
