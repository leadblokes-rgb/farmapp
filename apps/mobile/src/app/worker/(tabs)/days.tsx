import { visaRules, type TrackerGoal } from '@croppr/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text as NativeText, View } from 'react-native';
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
import { OutcomePrompts } from '@/features/ratings/OutcomePrompts';
import { PendingReviews } from '@/features/ratings/PendingReviews';
import { Disclaimer } from '@/features/tracker/Disclaimer';
import { LogShiftSheet } from '@/features/tracker/LogShiftSheet';
import { useUserId } from '@/providers/AuthProvider';
import { friendlyError } from '@/lib/errors';
import { MIN_TAP } from '@/theme';
import { Toast } from '@/components/Toast';
import { t, Trans } from '@/i18n';
import { sharedText } from '@/i18n/shared';

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

  const tr = tracker.data;
  const e = tr.estimate;
  const lastShift = tr.shifts[0];
  const hasEmployers = tr.employers.length > 0;
  const notWhm = tr.visaType && !(visaRules.appliesToVisaTypes as readonly string[]).includes(tr.visaType);

  return (
    <>
      <Screen scroll edges={[]}>
        <Disclaimer />
        <OutcomePrompts onMessage={setMessage} />
        <PendingReviews onMessage={setMessage} />
        {notWhm ? <Text variant="bodyMedium">{t('days.notWhm')}</Text> : null}

        <SingleChoiceChips<TrackerGoal>
          value={tr.goal}
          onChange={(g) => setGoal.mutate(g)}
          options={[
            { key: 'second', label: t('days.goalSecond', { days: visaRules.targets.second }) },
            { key: 'third', label: t('days.goalThird', { days: visaRules.targets.third }) },
          ]}
        />

        <View
          style={styles.progress}
          accessibilityLabel={t('days.progressLabel', { total: e.totalDays, target: e.target })}
        >
          <Text style={styles.big}>{e.totalDays}</Text>
          <Text variant="titleLarge">{t('days.ofTarget', { target: e.target })}</Text>
          <Meter value={e.progress} height={16} label={t('days.meterLabel')} />
          <Text variant="titleMedium" style={styles.togo}>
            {e.remaining === 0 ? t('days.reached') : t('days.toGo', { count: e.remaining })}
          </Text>
        </View>

        <BigButton icon="clock-plus-outline" disabled={!hasEmployers} onPress={() => setLogging(true)}>
          {t('days.logShift')}
        </BigButton>
        <Button
          mode="outlined"
          icon="file-document-outline"
          disabled={!hasEmployers}
          contentStyle={styles.tall}
          onPress={() => router.push('/worker/payslip/new')}
        >
          {t('days.addPayslip')}
        </Button>

        {(suggestions.data ?? []).map((s) => (
          <Card key={s.job_id} mode="outlined" style={styles.suggestion}>
            <Card.Content style={styles.gap}>
              <Text variant="bodyLarge">
                <Trans
                  i18nKey="days.suggestion"
                  values={{ farm: s.business_name, job: s.job_title }}
                  components={{ bold: <NativeText style={styles.bold} /> }}
                />
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
                    { onSuccess: () => setMessage(t('days.added', { name: s.business_name })) },
                  )
                }
              >
                {t('days.addNamed', { name: s.business_name })}
              </Button>
            </Card.Content>
          </Card>
        ))}

        <View style={styles.headerRow}>
          <Text variant="titleLarge" style={styles.bold}>
            {t('days.employers')}
          </Text>
          <Button icon="plus" onPress={() => router.push('/worker/employer/new')}>
            {t('days.addEmployer')}
          </Button>
        </View>
        {!hasEmployers ? (
          <Text variant="bodyLarge">{t('days.noEmployers')}</Text>
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
                    {b.countsAsSpecified ? t('days.specified') : t('days.notSpecified')}
                  </Text>
                  {tr.employers.find((x) => x.id === b.employerId)?.verified ? (
                    <Text variant="bodyMedium" style={styles.verified}>
                      {t('days.verified')}
                    </Text>
                  ) : null}
                </View>
                <Text variant="headlineSmall" style={styles.bold}>
                  {t('days.daysShort', { count: b.days })}
                </Text>
              </Card.Content>
            </Card>
          ))
        )}

        {e.noteMessages.map(sharedText).map((n) => (
          <Text key={n} variant="bodyMedium" style={styles.note}>
            • {n}
          </Text>
        ))}
        <Text variant="bodySmall" style={styles.note}>
          {t('days.rules', {
            version: visaRules.rulesVersion,
            weekHours: visaRules.fullTimeWeekHours,
            weekDays: visaRules.fullTimeWeekMinDays,
            dayHours: visaRules.fullDayHours,
          })}
        </Text>
      </Screen>

      <LogShiftSheet
        visible={logging}
        employers={tr.employers}
        shifts={tr.shifts}
        defaults={{
          employerId: lastShift?.employer_id,
          hoursFor: (id) => tr.shifts.find((s) => s.employer_id === id)?.hours ?? 8,
        }}
        saving={logShift.isPending}
        error={logShift.error ? friendlyError(logShift.error) : undefined}
        onDismiss={() => setLogging(false)}
        onSave={(s) =>
          logShift.mutate(s, {
            onSuccess: () => {
              setLogging(false);
              setMessage(t('days.shiftSaved'));
            },
          })
        }
      />
      <Toast message={message} onDismiss={() => setMessage(null)} duration={2500} />
    </>
  );
}

const styles = StyleSheet.create({
  verified: { color: '#17482F', fontWeight: '700' },
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
