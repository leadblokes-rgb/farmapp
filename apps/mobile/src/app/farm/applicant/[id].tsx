import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar, Button, Divider, Text } from 'react-native-paper';
import { Meter } from '@/components/Meter';
import { LoadError, Loading } from '@/components/Loading';
import { useStartConversation } from '@/features/chat/api';
import { Screen } from '@/components/Screen';
import { initials, VisaBadge } from '@/features/farm/ApplicantCard';
import {
  useApplicantAvailability,
  useApplicantResume,
  useDecide,
  useShortlist,
  type FactorScore,
} from '@/features/farm/shortlistApi';
import { dateRangeLabel } from '@/features/jobs/format';
import { WorkerReviews } from '@/features/ratings/Reviews';
import { openResume } from '@/features/worker/ResumeCard';
import { MIN_TAP } from '@/theme';
import { friendlyError } from '@/lib/errors';
import { Toast } from '@/components/Toast';
import { matchNote } from '@/features/jobs/matchNote';
import { t } from '@/i18n';
import { skillLabel } from '@/i18n/shared';

const factorLabel = (key: string) =>
  t(`applicantDetail.factors.${key}` as 'applicantDetail.factors.availability', { defaultValue: key });

export default function ApplicantDetail() {
  const { id, jobId } = useLocalSearchParams<{ id: string; jobId: string }>();
  const shortlist = useShortlist(jobId);
  const a = shortlist.data?.applicants.find((x) => x.application_id === id);
  const availability = useApplicantAvailability(a?.worker_id);
  const resume = useApplicantResume(a?.worker_id);
  const decide = useDecide(jobId);
  const startChat = useStartConversation();
  const [message, setMessage] = useState<string | null>(null);

  if (shortlist.isPending) return <Loading />;
  if (shortlist.isError || !a) return <LoadError onRetry={() => shortlist.refetch()} />;

  const breakdown = (a.score_breakdown ?? {}) as Record<string, FactorScore>;
  const skillLabels = a.skills.map(skillLabel);
  const act = (decision: 'accepted' | 'declined') =>
    decide.mutate(
      { ids: [a.application_id], decision },
      {
        onSuccess: () =>
          setMessage(
            decision === 'accepted'
              ? t('applicantDetail.acceptedMsg', { name: a.full_name })
              : t('applicantDetail.declinedMsg', { name: a.full_name }),
          ),
      },
    );

  return (
    <>
      <Screen scroll edges={['bottom']}>
        <Stack.Screen options={{ title: a.full_name }} />
        <View style={styles.top}>
          {a.photoUrl ? (
            <Image source={{ uri: a.photoUrl }} style={styles.photo} />
          ) : (
            <Avatar.Text size={96} label={initials(a.full_name)} />
          )}
          <View style={styles.flex}>
            <Text variant="headlineSmall" style={styles.bold}>
              {a.full_name}
            </Text>
            <Text variant="bodyLarge">
              {t('applicantDetail.near', { place: a.locality ?? t('applicantDetail.unknown') })}
            </Text>
            <Text variant="bodyLarge">
              {t('applicantDetail.status', {
                status: t(`applicantDetail.statuses.${a.status as 'applied'}`, { defaultValue: a.status }),
              })}
            </Text>
          </View>
        </View>
        <VisaBadge a={a} />
        <Text variant="bodyMedium" style={styles.muted}>
          {t('applicantDetail.visaPrivate')}
        </Text>

        <View style={styles.scoreBox}>
          <Text variant="titleMedium" style={styles.bold}>
            {t('applicantDetail.matchScore', {
              score: a.match_score != null ? Math.round(Number(a.match_score)) : '–',
            })}
          </Text>
          {Object.entries(breakdown).map(([key, f]) => (
            <View key={key} style={styles.factor}>
              <View style={styles.factorHead}>
                <Text variant="bodyLarge" style={styles.bold}>
                  {factorLabel(key)}
                </Text>
                <Text variant="bodyMedium">
                  {t('applicantDetail.factorScore', {
                    points: Math.round(f.score * f.weight),
                    weight: f.weight,
                  })}
                </Text>
              </View>
              <Meter value={f.score} height={8} label={factorLabel(key)} />
              <Text variant="bodyMedium">{matchNote(f)}</Text>
            </View>
          ))}
        </View>

        <Divider />
        <Text variant="titleMedium" style={styles.bold}>
          {t('applicantDetail.available')}
        </Text>
        {(availability.data ?? []).map((w) => (
          <Text key={w.start_date} variant="bodyLarge">
            {dateRangeLabel(w.start_date, w.end_date)}
          </Text>
        ))}
        <Text variant="titleMedium" style={styles.bold}>
          {t('applicantDetail.practical')}
        </Text>
        <Text variant="bodyLarge">
          {a.has_car ? t('applicantDetail.hasCar') : t('applicantDetail.noCar')} ·{' '}
          {a.needs_accommodation
            ? t('applicantDetail.needsAccommodation')
            : t('applicantDetail.hasAccommodation')}
        </Text>
        <Text variant="bodyLarge">
          {a.travel_mode === 'group'
            ? t('applicantDetail.groupOf', { size: a.group_size })
            : t('applicantDetail.solo')}
        </Text>
        <Text variant="titleMedium" style={styles.bold}>
          {t('applicantDetail.experience')}
        </Text>
        <Text variant="bodyLarge">
          {t('applicantDetail.seasons', { count: a.years_experience })}
          {skillLabels.length ? ` · ${skillLabels.join(', ')}` : ''}
        </Text>
        {a.experience_summary ? (
          <Text variant="bodyLarge">{t('applicantDetail.quote', { text: a.experience_summary })}</Text>
        ) : null}
        {resume.data ? (
          <Button
            mode="outlined"
            icon="file-account-outline"
            contentStyle={styles.tall}
            onPress={() => openResume(resume.data!.resume_path!).catch((e) => setMessage(friendlyError(e)))}
          >
            {t('applicantDetail.viewResume')}
          </Button>
        ) : null}
        {a.no_show_count > 0 ? (
          <Text variant="bodyLarge" style={styles.warnText}>
            {t('applicantDetail.noShows', { count: a.no_show_count })}
          </Text>
        ) : null}
        <WorkerReviews workerId={a.worker_id} />

        {a.status === 'applied' || a.status === 'accepted' ? (
          <Button
            mode="outlined"
            icon="chat"
            contentStyle={styles.tall}
            loading={startChat.isPending}
            onPress={() =>
              startChat.mutate(a.application_id, {
                onSuccess: (convId) => router.push(`/farm/chat/${convId}`),
                onError: (e) => setMessage(friendlyError(e)),
              })
            }
          >
            {t('applicantDetail.message', { name: a.full_name.split(' ')[0] })}
          </Button>
        ) : null}
        <View style={styles.actions}>
          {a.status === 'applied' ? (
            <>
              <Button
                mode="outlined"
                icon="close"
                textColor="#B00020"
                style={styles.flex}
                contentStyle={styles.tall}
                onPress={() => act('declined')}
                loading={decide.isPending}
              >
                {t('applicantDetail.decline')}
              </Button>
              <Button
                mode="contained"
                icon="check"
                style={styles.flex}
                contentStyle={styles.tall}
                onPress={() => act('accepted')}
                loading={decide.isPending}
              >
                {t('applicantDetail.accept')}
              </Button>
            </>
          ) : a.status === 'accepted' ? (
            <Button
              mode="outlined"
              icon="account-remove"
              textColor="#B00020"
              style={styles.flex}
              contentStyle={styles.tall}
              onPress={() => act('declined')}
            >
              {t('applicantDetail.noLongerComing')}
            </Button>
          ) : null}
        </View>
      </Screen>
      <Toast message={message} onDismiss={() => setMessage(null)} duration={3000} />
    </>
  );
}

const styles = StyleSheet.create({
  warnText: { color: '#8D5A00', fontWeight: '700' },
  top: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  photo: { width: 96, height: 96, borderRadius: 48 },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  muted: { opacity: 0.75 },
  scoreBox: { gap: 12, borderWidth: 1, borderColor: '#BDBDBD', borderRadius: 14, padding: 16 },
  factor: { gap: 4 },
  factorHead: { flexDirection: 'row', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  tall: { minHeight: MIN_TAP },
});
