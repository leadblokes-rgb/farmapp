import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { HelperText, Text, TextInput } from 'react-native-paper';
import { isSelfServeRole, isValidEmail, normaliseEmail } from '@croppr/shared';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { t } from '@/i18n';

// Demo sign-in exists only in development builds: in production `__DEV__` is false, the bundler
// drops this require, and the demo accounts never ship.
const DemoSignIn: (() => React.JSX.Element | null) | null = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/features/auth/DemoSignIn').DemoSignIn
  : null;

export default function SignIn() {
  const params = useLocalSearchParams<{ role?: string }>();
  const role = isSelfServeRole(params.role) ? params.role : undefined;
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function sendCode() {
    const address = normaliseEmail(email);
    if (!isValidEmail(address)) {
      setError(t('signIn.invalidEmail'));
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
      setError(friendlyError(err));
      return;
    }
    router.push({ pathname: '/verify', params: { email: address } });
  }

  return (
    <Screen scroll edges={['bottom']}>
      <Text variant="headlineMedium">
        {role === 'farm'
          ? t('signIn.titleFarm')
          : role === 'worker'
            ? t('signIn.titleWorker')
            : t('signIn.title')}
      </Text>
      <Text variant="bodyLarge">{t('signIn.intro')}</Text>
      <TextInput
        mode="outlined"
        label={t('signIn.email')}
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
        {t('signIn.send')}
      </BigButton>

      {DemoSignIn ? <DemoSignIn /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { fontSize: 18 },
});
