import { visaRules, type TrackerGoal } from '@croppr/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { SingleChoiceChips } from '@/components/form/SingleChoiceChips';
import { LoadError } from '@/components/Loading';
import { Meter } from '@/components/Meter';
import { Screen } from '@/components/Screen';
import { DaysSkeleton } from '@/components/Skeleton';
import {
  useEmployerSuggestions,
  useLogShift,
  useSaveEmployer,
  useSetGoal,
  useTracker,
} from '@/features/tracker/api';
import { Disclaimer } from '@/features/tracker/Disclaimer';
import { LogShiftSheet } from '@/features/tracker/LogShiftSheet';
import { useUserId } from '@/providers/AuthProvider';
import { friendlyError } from '@/lib/errors';
import { MIN_TAP } from '@/theme';
import { Toast } from '@/components/Toast';

export default function Days() {
  const userId = useUserId();
  const tracker = useTracker(userId);
  const suggestions = useEmployerSuggestions();
  const setGoal = useSetGoal(userId);
  const logShift = useLogShift(userId);
  const saveEmployer = useSaveEmployer(userId);
  const [logging, setLogging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (tracker.isPending) return <DaysSkeleton />;
  if (tracker.isError) return <LoadError onRetry={() => tracker.refetch()} />;

  const t = tracker.data;
  const e = t.estimate;
  const lastShift = t.shifts[0];
  const hasEmployers = t.employers.length > 0;
  const notWhm = t.visaType && !(visaRules.appliesToVisaTypes as readonly string[]).includes(t.visaType);

  return (
    <>
      <Screen scroll edges={[]}>
        <Disclaimer />
        {notWhm ? (
          <Text variant="bodyMedium">
            Your profile says you&apos;re not on a 417/462 visa, so you probably don&apos;t need specified
            work days.
          </Text>
        ) : null}

        <SingleChoiceChips<TrackerGoal>
          value={t.goal}
          onChange={(g) => setGoal.mutate(g)}
          options={[
            { key: 'second', label: `2nd visa: ${visaRules.targets.second} days` },
            { key: 'third', label: `3rd visa: ${visaRules.targets.third} days` },
          ]}
        />

        <View style={styles.progress} accessibilityLabel={`${e.totalDays} of ${e.target} days, estimated`}>
          <Text style={styles.big}>{e.totalDays}</Text>
          <Text variant="titleLarge">of {e.target} days (estimate)</Text>
          <Meter value={e.progress} height={16} label="Progress towards your days" />
          <Text variant="titleMedium" style={styles.togo}>
            {e.remaining === 0
              ? 'Target reached 🎉 Check with Home Affairs before you apply.'
              : `${e.remaining} days to go`}
          </Text>
        </View>

        <BigButton icon="clock-plus-outline" disabled={!hasEmployers} onPress={() => setLogging(true)}>
          Log a shift
        </BigButton>
        <Button
          mode="outlined"
          icon="file-document-outline"
          disabled={!hasEmployers}
          contentStyle={styles.tall}
          onPress={() => router.push('/worker/payslip/new')}
        >
          Add a payslip
        </Button>

        {(suggestions.data ?? []).map((s) => (
          <Card key={s.job_id} mode="outlined" style={styles.suggestion}>
            <Card.Content style={styles.gap}>
              <Text variant="bodyLarge">
                You were accepted at <Text style={styles.bold}>{s.business_name}</Text> ({s.job_title}). Track
                your days there?
              </Text>
              <Button
                mode="contained-tonal"
                icon="plus"
                contentStyle={styles.tall}
                onPress={() =>
                  saveEmployer.mutate(
                    {
                      v: {
                        name: s.business_name,
                        postcode: s.postcode,
                        abn: '',
                        countsAsSpecified: s.likely_specified_work,
                        farmId: s.farm_id,
                        jobId: s.job_id,
                      },
                    },
                    { onSuccess: () => setMessage(`Added ${s.business_name}`) },
                  )
                }
              >
                Add {s.business_name}
              </Button>
            </Card.Content>
          </Card>
        ))}

        <View style={styles.headerRow}>
          <Text variant="titleLarge" style={styles.bold}>
            Employers
          </Text>
          <Button icon="plus" onPress={() => router.push('/worker/employer/new')}>
            Add employer
          </Button>
        </View>
        {!hasEmployers ? (
          <Text variant="bodyLarge">
            Add the farm you&apos;re working at, then log your shifts or upload payslips.
          </Text>
        ) : (
          e.byEmployer.map((b) => (
            <Card
              key={b.employerId}
              mode="outlined"
              onPress={() => router.push(`/worker/employer/${b.employerId}`)}
            >
              <Card.Content style={styles.employer}>
                <View style={styles.flex}>
                  <Text variant="titleMedium" style={styles.bold}>
                    {b.name}
                  </Text>
                  <Text variant="bodyMedium">
                    {b.countsAsSpecified ? 'Specified work' : 'Not specified work (not counted)'}
                  </Text>
                </View>
                <Text variant="headlineSmall" style={styles.bold}>
                  {b.days}d
                </Text>
              </Card.Content>
            </Card>
          ))
        )}

        {e.notes.map((n) => (
          <Text key={n} variant="bodyMedium" style={styles.note}>
            • {n}
          </Text>
        ))}
        <Text variant="bodySmall" style={styles.note}>
          Counting rules v{visaRules.rulesVersion}: full-time weeks ({visaRules.fullTimeWeekHours}+ hrs over{' '}
          {visaRules.fullTimeWeekMinDays}+ days) count 7 days; otherwise shifts of {visaRules.fullDayHours}+
          hrs count as a day; each calendar day counts once.
        </Text>
      </Screen>

      <LogShiftSheet
        visible={logging}
        employers={t.employers}
        shifts={t.shifts}
        defaults={{
          employerId: lastShift?.employer_id,
          hoursFor: (id) => t.shifts.find((s) => s.employer_id === id)?.hours ?? 8,
        }}
        saving={logShift.isPending}
        error={logShift.error ? friendlyError(logShift.error) : undefined}
        onDismiss={() => setLogging(false)}
        onSave={(s) =>
          logShift.mutate(s, {
            onSuccess: () => {
              setLogging(false);
              setMessage('Shift saved');
            },
          })
        }
      />
      <Toast message={message} onDismiss={() => setMessage(null)} duration={2500} />
    </>
  );
}

const styles = StyleSheet.create({
  progress: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  big: { fontSize: 64, fontWeight: '900', color: '#17482F', lineHeight: 70 },
  togo: { fontWeight: '700' },
  tall: { minHeight: MIN_TAP },
  suggestion: { borderColor: '#17482F', borderWidth: 2 },
  gap: { gap: 8 },
  bold: { fontWeight: '700' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  employer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  note: { opacity: 0.8 },
});
