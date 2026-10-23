import { todayIso, trackerLimits, validatePayslip } from '@croppr/shared';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { DateField } from '@/components/form/DateField';
import { SingleChoiceChips } from '@/components/form/SingleChoiceChips';
import { Stepper } from '@/components/form/Stepper';
import { LoadError, Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { useAddPayslip, useTracker, type PayslipInput } from '@/features/tracker/api';
import { useUserId } from '@/providers/AuthProvider';
import { MIN_TAP } from '@/theme';
import { friendlyError } from '@/lib/errors';

export default function NewPayslip() {
  const { employerId } = useLocalSearchParams<{ employerId?: string }>();
  const userId = useUserId();
  const tracker = useTracker(userId);
  const add = useAddPayslip(userId);
  const [employer, setEmployer] = useState<string | undefined>(employerId);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [days, setDays] = useState(5);
  const [hours, setHours] = useState('');
  const [file, setFile] = useState<PayslipInput['file']>(null);
  const [error, setError] = useState<string | null>(null);

  if (tracker.isPending) return <Loading />;
  if (tracker.isError) return <LoadError onRetry={() => tracker.refetch()} />;
  const employers = tracker.data.employers;
  const selected = employer ?? employers[0]?.id;

  async function pickPhoto(camera: boolean) {
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
    if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return;
    const r = camera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    const a = !r.canceled ? r.assets[0] : null;
    if (a) setFile({ uri: a.uri, name: a.fileName ?? 'payslip.jpg', mimeType: a.mimeType ?? 'image/jpeg' });
  }

  async function pickPdf() {
    const r = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    const a = !r.canceled ? r.assets[0] : null;
    if (a) setFile({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/pdf' });
  }

  function save() {
    const hoursTotal = hours.trim() === '' ? null : Number(hours.replace(',', '.'));
    if (!selected) return setError('Add an employer first');
    // Nothing is saved unless every check passes (the database enforces the same limits).
    const problem = validatePayslip(
      { periodStart: start, periodEnd: end, daysWorked: days, hoursTotal },
      todayIso(),
    );
    if (problem) return setError(problem);
    setError(null);
    add.mutate(
      {
        employerId: selected,
        periodStart: start!,
        periodEnd: end!,
        daysWorked: days,
        hoursTotal: hoursTotal!,
        file,
      },
      { onSuccess: () => router.back(), onError: (e) => setError(friendlyError(e)) },
    );
  }

  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{ title: 'Add payslip' }} />
      <Text variant="bodyLarge">
        Copy the details from your payslip and attach a photo or PDF. Only you can see it.
      </Text>
      <SingleChoiceChips
        options={employers.map((e) => ({ key: e.id, label: e.name }))}
        value={selected}
        onChange={setEmployer}
      />
      <View style={styles.row}>
        <DateField label="Period start" value={start} maxDate={end ?? todayIso()} onChange={setStart} />
        <DateField label="Period end" value={end} minDate={start} maxDate={todayIso()} onChange={setEnd} />
      </View>
      <Stepper
        label="Days worked"
        value={days}
        onChange={setDays}
        min={1}
        max={trackerLimits.maxPayslipPeriodDays}
      />
      <TextInput
        mode="outlined"
        label="Total hours"
        accessibilityLabel="Total hours"
        value={hours}
        onChangeText={(t) => setHours(t.replace(/[^\d.,]/g, ''))}
        keyboardType="decimal-pad"
        style={styles.input}
      />
      <Text variant="titleMedium">Attach payslip {file ? `(${file.name})` : '(optional)'}</Text>
      <View style={styles.row}>
        <Button
          mode="outlined"
          icon="camera"
          style={styles.flex}
          contentStyle={styles.tall}
          onPress={() => pickPhoto(true)}
        >
          Photo
        </Button>
        <Button
          mode="outlined"
          icon="image"
          style={styles.flex}
          contentStyle={styles.tall}
          onPress={() => pickPhoto(false)}
        >
          Gallery
        </Button>
        <Button
          mode="outlined"
          icon="file-pdf-box"
          style={styles.flex}
          contentStyle={styles.tall}
          onPress={pickPdf}
        >
          PDF
        </Button>
      </View>
      <HelperText type="error" visible={error !== null}>
        {error}
      </HelperText>
      <BigButton onPress={save} loading={add.isPending} disabled={add.isPending}>
        Save payslip
      </BigButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  input: { fontSize: 18 },
  tall: { minHeight: MIN_TAP },
});
