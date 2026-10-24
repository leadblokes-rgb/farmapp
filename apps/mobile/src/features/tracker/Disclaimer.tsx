import { visaRules } from '@croppr/shared';
import { Linking, StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';
import { t } from '@/i18n';

/** Always shown on the tracker: this is an estimate, not immigration advice. */
export function Disclaimer() {
  return (
    <View style={styles.box} accessibilityRole="alert">
      <View style={styles.row}>
        <Icon source="information" size={22} color="#5C3B00" />
        <Text variant="bodyMedium" style={styles.text}>
          {t('shared.disclaimer')}
        </Text>
      </View>
      <Button
        compact
        icon="open-in-new"
        onPress={() => Linking.openURL(visaRules.sourceUrl)}
        style={styles.link}
      >
        {t('tracker.homeAffairs')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#8D5A00',
    backgroundColor: '#FFF8E8',
    padding: 12,
    gap: 4,
  },
  row: { flexDirection: 'row', gap: 8 },
  text: { flex: 1, color: '#3B2600' },
  link: { alignSelf: 'flex-start' },
});
