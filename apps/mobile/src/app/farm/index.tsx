import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { LoadError, Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { useMyFarm } from '@/features/farm/api';
import { VerificationStatusCard } from '@/features/farm/VerificationStatusCard';
import { useUserId } from '@/providers/AuthProvider';

export default function Jobs() {
  const farm = useMyFarm(useUserId());
  const [soon, setSoon] = useState(false);

  if (farm.isPending) return <Loading />;
  if (farm.isError || !farm.data) return <LoadError onRetry={() => farm.refetch()} />;

  const verified = farm.data.verification_status === 'verified';
  return (
    <>
      <Screen edges={[]}>
        <VerificationStatusCard farm={farm.data} />
        <View style={styles.empty}>
          <Text variant="headlineSmall">No jobs yet</Text>
          <Text variant="bodyLarge" style={styles.center}>
            Post a job and Croppr will build you a ranked shortlist of available workers.
          </Text>
          <Text variant="labelLarge" style={styles.muted}>
            Job posting arrives in milestone 3.
          </Text>
        </View>
        <BigButton icon="plus" disabled={!verified} onPress={() => setSoon(true)}>
          Post a job
        </BigButton>
      </Screen>
      <Snackbar visible={soon} onDismiss={() => setSoon(false)} duration={3000}>
        Coming soon: you can post jobs from milestone 3.
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  center: { textAlign: 'center' },
  muted: { opacity: 0.7 },
});
