import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { t } from '@/i18n';

/** Shown next to verified farms everywhere workers see them. */
export function VerifiedBadge() {
  return (
    <View style={styles.badge} accessibilityLabel={t('common.verifiedFarm')}>
      <Icon source="check-decagram" size={18} color="#FFFFFF" />
      <Text style={styles.text}>{t('common.verified')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#17482F',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
