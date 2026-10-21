import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

/** Shown next to verified farms everywhere workers see them. */
export function VerifiedBadge() {
  return (
    <View style={styles.badge} accessibilityLabel="Verified farm">
      <Icon source="check-decagram" size={18} color="#FFFFFF" />
      <Text style={styles.text}>Verified</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1B5E20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
