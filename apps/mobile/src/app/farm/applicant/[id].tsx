import { SKILLS } from '@croppr/shared';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar, Button, Divider, Snackbar, Text } from 'react-native-paper';
import { Meter } from '@/components/Meter';
import { LoadError, Loading } from '@/components/Loading';
import { useStartConversation } from '@/features/chat/api';
import { Screen } from '@/components/Screen';
import { initials, VisaBadge } from '@/features/farm/ApplicantCard';
import {
  useApplicantAvailability,
  useDecide,
  useShortlist,
  type FactorScore,
} from '@/features/farm/shortlistApi';
import { dateRangeLabel } from '@/features/jobs/format';
import { MIN_TAP } from '@/theme';

const FACTOR_LABELS: Record<string, string> = {
  availability: 'Availability',
  distance: 'Distance',
  transport: 'Transport',
  experience: 'Experience',
  reliability: 'Reliability',
};

export default function ApplicantDetail() {
  const { id, jobId } = useLocalSearchParams<{ id: string; jobId: string }>();
  const shortlist = useShortlist(jobId);
  const a = shortlist.data?.applicants.find((x) => x.application_id === id);
  const availability = useApplicantAvailability(a?.worker_id);
  const decide = useDecide(jobId);
  const startChat = useStartConversation();
  const [message, setMessage] = useState<string | null>(null);

  if (shortlist.isPending) return <Loading />;
  if (shortlist.isError || !a) return <LoadError onRetry={() => shortlist.refetch()} />;

  const breakdown = (a.score_breakdown ?? {}) as Record<string, FactorScore>;
  const skillLabels = a.skills.map((k) => SKILLS.find((s) => s.key === k)?.label ?? k);
  const act = (decision: 'accepted' | 'declined') =>
    decide.mutate(
      { ids: [a.application_id], decision },
      {
        onSuccess: () =>
          setMessage(decision === 'accepted' ? `${a.full_name} accepted` : `${a.full_name} declined`),
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
            <Text variant="bodyLarge">Currently near {a.locality ?? 'unknown'}</Text>
            <Text variant="bodyLarge">Status: {a.status}</Text>
          </View>
        </View>
        <VisaBadge a={a} />
        <Text variant="bodyMedium" style={styles.muted}>
          Croppr only shows whether the visa covers your job dates; visa details stay private.
        </Text>

        <View style={styles.scoreBox}>
          <Text variant="titleMedium" style={styles.bold}>
            Match score {a.match_score != null ? Math.round(Number(a.match_score)) : '–'}/100
          </Text>
          {Object.entries(breakdown).map(([key, f]) => (
            <View key={key} style={styles.factor}>
              <View style={styles.factorHead}>
                <Text variant="bodyLarge" style={styles.bold}>
                  {FACTOR_LABELS[key] ?? key}
                </Text>
                <Text variant="bodyMedium">
                  {Math.round(f.score * f.weight)}/{f.weight}
                </Text>
              </View>
              <Meter value={f.score} height={8} label={FACTOR_LABELS[key] ?? key} />
              <Text variant="bodyMedium">{f.note}</Text>
            </View>
          ))}
        </View>

        <Divider />
        <Text variant="titleMedium" style={styles.bold}>
          Available
        </Text>
        {(availability.data ?? []).map((w) => (
          <Text key={w.start_date} variant="bodyLarge">
            {dateRangeLabel(w.start_date, w.end_date)}
          </Text>
        ))}
        <Text variant="titleMedium" style={styles.bold}>
          Practical
        </Text>
        <Text variant="bodyLarge">
          {a.has_car ? 'Has a car' : 'No car'} ·{' '}
          {a.needs_accommodation ? 'Needs accommodation' : 'Has accommodation sorted'}
        </Text>
        <Text variant="bodyLarge">
          {a.travel_mode === 'group' ? `Travelling in a group of ${a.group_size}` : 'Travelling solo'}
        </Text>
        <Text variant="titleMedium" style={styles.bold}>
          Experience
        </Text>
        <Text variant="bodyLarge">
          {a.years_experience} season{a.years_experience === 1 ? '' : 's'} of farm work
          {skillLabels.length ? ` · ${skillLabels.join(', ')}` : ''}
        </Text>
        {a.experience_summary ? <Text variant="bodyLarge">“{a.experience_summary}”</Text> : null}

        {a.status === 'applied' || a.status === 'accepted' ? (
          <Button
            mode="outlined"
            icon="chat"
            contentStyle={styles.tall}
            loading={startChat.isPending}
            onPress={() =>
              startChat.mutate(a.application_id, {
                onSuccess: (convId) => router.push(`/farm/chat/${convId}`),
                onError: (e) => setMessage(e.message),
              })
            }
          >
            Message {a.full_name.split(' ')[0]}
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
                Decline
              </Button>
              <Button
                mode="contained"
                icon="check"
                style={styles.flex}
                contentStyle={styles.tall}
                onPress={() => act('accepted')}
                loading={decide.isPending}
              >
                Accept
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
              No longer coming: decline
            </Button>
          ) : null}
        </View>
      </Screen>
      <Snackbar visible={message !== null} onDismiss={() => setMessage(null)} duration={3000}>
        {message}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
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
