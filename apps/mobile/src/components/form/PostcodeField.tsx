import * as Location from 'expo-location';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { MIN_TAP } from '@/theme';
import { FieldMessage } from './TextField';
import { t } from '@/i18n';

interface Props {
  label: string;
  value: string;
  onChange: (postcode: string) => void;
  error?: string;
  hint?: string;
  /** Show "Use my location". Only the resulting postcode is kept; coordinates are discarded. */
  allowLocation?: boolean;
}

export function PostcodeField({ label, value, onChange, error, hint, allowLocation }: Props) {
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  async function useLocation() {
    setLocError(null);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocError(t('form.location.denied'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const [place] = await Location.reverseGeocodeAsync(pos.coords);
      if (place?.postalCode && /^\d{4}$/.test(place.postalCode)) onChange(place.postalCode);
      else setLocError(t('form.location.noPostcode'));
    } catch {
      setLocError(t('form.location.failed'));
    } finally {
      setLocating(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <TextInput
        mode="outlined"
        label={label}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 4))}
        keyboardType="number-pad"
        maxLength={4}
        error={!!error}
        accessibilityLabel={label}
        style={styles.input}
      />
      <FieldMessage error={error ?? locError ?? undefined} hint={hint} />
      {allowLocation ? (
        <Button
          mode="outlined"
          icon="crosshairs-gps"
          onPress={useLocation}
          loading={locating}
          disabled={locating}
          contentStyle={styles.button}
        >
          {t('form.location.use')}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  input: { fontSize: 18 },
  button: { minHeight: MIN_TAP },
});
