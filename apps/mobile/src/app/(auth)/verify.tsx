import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { HelperText, Text, TextInput } from 'react-native-paper';
import { OTP_LENGTH, isValidOtp } from '@farmmatch/shared';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { supabase } from '@/lib/supabase';

const RESEND_SECONDS = 60;

export default function Verify() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function verify(value = code) {
    if (!isValidOtp(value)) {
      setError(`Enter the ${OTP_LENGTH}-digit code from your email.`);
      return;
    }
    setError(null);
    setVerifying(true);
    const { error: err } = await supabase.auth.verifyOtp({ email, token: value.trim(), type: 'email' });
    setVerifying(false);
    // On success the auth listener updates the session and the root navigator redirects.
    if (err) setError('That code didn’t work. Check it, or request a new one.');
  }

  async function resend() {
    setCooldown(RESEND_SECONDS);
    const { error: err } = await supabase.auth.signInWithOtp({ email });
    if (err) setError(err.message);
  }

  return (
    <Screen scroll edges={['bottom']}>
      <Text variant="headlineMedium">Check your email</Text>
      <Text variant="bodyLarge">We sent a {OTP_LENGTH}-digit code to {email}.</Text>
      <TextInput
        mode="outlined"
        label="Code"
        value={code}
        onChangeText={(v) => {
          const digits = v.replace(/\D/g, '').slice(0, OTP_LENGTH);
          setCode(digits);
          if (digits.length === OTP_LENGTH) verify(digits);
        }}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={OTP_LENGTH}
        style={styles.code}
        autoFocus
      />
      <HelperText type="error" visible={error !== null}>
        {error}
      </HelperText>
      <BigButton onPress={() => verify()} loading={verifying} disabled={verifying}>
        Continue
      </BigButton>
      <BigButton mode="text" onPress={resend} disabled={cooldown > 0}>
        {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
      </BigButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 28, letterSpacing: 8, textAlign: 'center' },
});
