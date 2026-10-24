import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { HelperText, Text, TextInput } from 'react-native-paper';
import { OTP_LENGTH, isValidOtp } from '@croppr/shared';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { t } from '@/i18n';

const RESEND_SECONDS = 60;

export default function Verify() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function verify(value = code) {
    if (!isValidOtp(value)) {
      setError(t('verify.enterCode', { length: OTP_LENGTH }));
      return;
    }
    setError(null);
    setVerifying(true);
    const { error: err } = await supabase.auth.verifyOtp({ email, token: value.trim(), type: 'email' });
    setVerifying(false);
    // On success the auth listener updates the session and the root navigator redirects.
    if (err) setError(t('verify.badCode'));
  }

  async function resend() {
    setCooldown(RESEND_SECONDS);
    const { error: err } = await supabase.auth.signInWithOtp({ email });
    if (err) setError(friendlyError(err));
  }

  return (
    <Screen scroll edges={['bottom']}>
      <Text variant="headlineMedium">{t('verify.title')}</Text>
      <Text variant="bodyLarge">{t('verify.sent', { length: OTP_LENGTH, email })}</Text>
      <TextInput
        mode="outlined"
        label={t('verify.code')}
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
        {t('verify.continue')}
      </BigButton>
      <BigButton mode="text" onPress={resend} disabled={cooldown > 0}>
        {cooldown > 0 ? t('verify.resendIn', { seconds: cooldown }) : t('verify.resend')}
      </BigButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 28, letterSpacing: 8, textAlign: 'center' },
});
