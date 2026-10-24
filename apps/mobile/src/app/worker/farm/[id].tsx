import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, Divider, Text } from 'react-native-paper';
import { LoadError } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { ListSkeleton } from '@/components/Skeleton';
import { RatingSummary } from '@/components/Stars';
import { Toast } from '@/components/Toast';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { initials } from '@/features/farm/ApplicantCard';
import { dateRangeLabel, payLabel } from '@/features/jobs/format';
import { FarmReviews } from '@/features/ratings/Reviews';
import { useApplyFromFarmPage, useFarmPage } from '@/features/worker/feedApi';
import { friendlyError } from '@/lib/errors';
import { farmImageUrl } from '@/lib/storage';
import { MIN_TAP } from '@/theme';
import { t } from '@/i18n';
import { employmentLabel } from '@/i18n/shared';

export default function FarmPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const page = useFarmPage(id);
  const apply = useApplyFromFarmPage(id);
  const [message, setMessage] = useState<string | null>(null);

  if (page.isPending) return <ListSkeleton label={t('farmPage.loading')} />;
  if (page.isError) return <LoadError onRetry={() => page.refetch()} />;
  const f = page.data.farm;
  if (!f) return <LoadError message={t('farmPage.gone')} onRetry={() => page.refetch()} />;

  const logo = farmImageUrl(f.logo_path);
  return (
    <>
      <Screen scroll edges={['bottom']}>
        <Stack.Screen options={{ title: f.business_name ?? t('farmPage.farm') }} />
        <View style={styles.top}>
          {logo ? (
            <Image
              source={{ uri: logo }}
              style={styles.logo}
              contentFit="cover"
              accessibilityLabel={t('farmPage.logo')}
            />
          ) : (
            <Avatar.Text size={72} label={initials(f.business_name ?? '?')} />
          )}
          <View style={styles.flex}>
            <Text variant="headlineSmall" style={styles.bold}>
              {f.business_name}
            </Text>
            <Text variant="bodyLarge">
              {f.locality ?? f.postcode}
              {f.is_labour_hire ? t('farmPage.labourHire') : ''}
            </Text>
            <VerifiedBadge />
          </View>
        </View>
        <RatingSummary avg={f.rating_avg} count={f.rating_count} />

        {f.photos?.length ? (
          <ScrollView horizontal contentContainerStyle={styles.photos} showsHorizontalScrollIndicator={false}>
            {f.photos.map((p) => (
              <Image key={p} source={{ uri: farmImageUrl(p)! }} style={styles.photo} contentFit="cover" />
            ))}
          </ScrollView>
        ) : null}

        {f.description ? <Text variant="bodyLarge">{f.description}</Text> : null}
        {f.accommodation_details ? (
          <View style={styles.block}>
            <Text variant="titleMedium" style={styles.bold}>
              {t('farmPage.accommodation')}
            </Text>
            <Text variant="bodyLarge">{f.accommodation_details}</Text>
          </View>
        ) : null}
        {f.website ? (
          <Button
            mode="text"
            icon="web"
            style={styles.left}
            onPress={() => Linking.openURL(f.website!)}
            accessibilityHint={t('farmPage.website')}
          >
            {f.website.replace(/^https?:\/\//, '')}
          </Button>
        ) : null}

        <Divider />
        <Text variant="titleMedium" style={styles.bold}>
          {t('farmPage.openJobs', { count: page.data.jobs.length })}
        </Text>
        {page.data.jobs.length === 0 ? <Text style={styles.muted}>{t('farmPage.noJobs')}</Text> : null}
        {page.data.jobs.map((j) => {
          const pay = payLabel(j);
          return (
            <Card key={j.id} mode="outlined">
              <Card.Content style={styles.job}>
                <Text variant="titleMedium" style={styles.bold}>
                  {j.title}
                </Text>
                <Text variant="bodyLarge">
                  {pay.main} · {employmentLabel(j.employment_type)}
                </Text>
                <Text variant="bodyLarge">{dateRangeLabel(j.start_date, j.end_date)}</Text>
                <Text variant="bodyMedium">
                  {j.locality ?? ''}
                  {j.accommodation_provided ? t('farmPage.accommodationAvailable') : ''}
                </Text>
                {j.applied ? (
                  <Text variant="bodyLarge" style={styles.applied}>
                    {t('farmPage.applied')}
                  </Text>
                ) : (
                  <Button
                    mode="contained"
                    icon="check"
                    contentStyle={styles.tall}
                    loading={apply.isPending && apply.variables === j.id}
                    disabled={apply.isPending}
                    onPress={() =>
                      apply.mutate(j.id, {
                        onSuccess: () => setMessage(t('farmPage.appliedFor', { title: j.title })),
                        onError: (e) => setMessage(friendlyError(e)),
                      })
                    }
                  >
                    {t('farmPage.apply')}
                  </Button>
                )}
              </Card.Content>
            </Card>
          );
        })}

        <Divider />
        <FarmReviews farmId={id} />
      </Screen>
      <Toast message={message} onDismiss={() => setMessage(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  logo: { width: 72, height: 72, borderRadius: 36 },
  flex: { flex: 1, gap: 4 },
  bold: { fontWeight: '700' },
  muted: { opacity: 0.7 },
  photos: { gap: 8 },
  photo: { width: 220, height: 160, borderRadius: 12 },
  block: { gap: 4 },
  left: { alignSelf: 'flex-start' },
  job: { gap: 6 },
  applied: { color: '#17482F', fontWeight: '700' },
  tall: { minHeight: MIN_TAP },
});
