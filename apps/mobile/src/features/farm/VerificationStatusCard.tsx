import { StyleSheet, View } from 'react-native';
import { Card, Icon, Text } from 'react-native-paper';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import type { Farm } from './api';
import { t } from '@/i18n';

export function VerificationStatusCard({ farm }: { farm: Farm }) {
  if (farm.verification_status === 'verified') {
    return (
      <Card mode="outlined" style={styles.verified}>
        <Card.Content style={styles.content}>
          <VerifiedBadge />
          <Text variant="bodyLarge">{t('verification.verified', { name: farm.business_name })}</Text>
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
            {rejected ? t('verification.rejected') : t('verification.waiting')}
          </Text>
        </View>
        {rejected ? (
          <>
            <Text variant="bodyLarge">{farm.rejection_reason}</Text>
            <Text variant="bodyMedium">{t('verification.resubmit')}</Text>
          </>
        ) : (
          <Text variant="bodyLarge">
            {farm.is_labour_hire ? t('verification.checkingLabourHire') : t('verification.checking')}
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
  verified: { borderColor: '#17482F', borderWidth: 2 },
  pending: { borderColor: '#8D5A00', borderWidth: 2, backgroundColor: '#FFF8E8' },
  rejected: { borderColor: '#B00020', borderWidth: 2, backgroundColor: '#FDECEE' },
});
