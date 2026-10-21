import { StyleSheet, View } from 'react-native';
import { Card, Icon, Text } from 'react-native-paper';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import type { Farm } from './api';

export function VerificationStatusCard({ farm }: { farm: Farm }) {
  if (farm.verification_status === 'verified') {
    return (
      <Card mode="outlined" style={styles.verified}>
        <Card.Content style={styles.content}>
          <VerifiedBadge />
          <Text variant="bodyLarge">
            {farm.business_name} is verified. Workers see the Verified badge on your jobs.
          </Text>
        </Card.Content>
      </Card>
    );
  }

  const rejected = farm.verification_status === 'rejected';
  return (
    <Card mode="outlined" style={rejected ? styles.rejected : styles.pending}>
      <Card.Content style={styles.content}>
        <View style={styles.title}>
          <Icon
            source={rejected ? 'alert-circle' : 'clock-outline'}
            size={26}
            color={rejected ? '#B00020' : '#8D5A00'}
          />
          <Text variant="titleMedium" style={styles.bold}>
            {rejected ? 'Verification unsuccessful' : 'Waiting for verification'}
          </Text>
        </View>
        {rejected ? (
          <>
            <Text variant="bodyLarge">{farm.rejection_reason}</Text>
            <Text variant="bodyMedium">Update your details in the Farm tab to resubmit.</Text>
          </>
        ) : (
          <Text variant="bodyLarge">
            We&apos;re checking your ABN{farm.is_labour_hire ? ' and labour hire licence' : ''}. This usually
            takes one business day. You can post jobs once you&apos;re verified.
          </Text>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: 8 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bold: { fontWeight: '700' },
  verified: { borderColor: '#1B5E20', borderWidth: 2 },
  pending: { borderColor: '#8D5A00', borderWidth: 2, backgroundColor: '#FFF8E8' },
  rejected: { borderColor: '#B00020', borderWidth: 2, backgroundColor: '#FDECEE' },
});
