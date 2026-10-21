import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

export function WarningBanner({ children }: { children: string }) {
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Icon source="alert" size={24} color="#8D5A00" />
      <Text variant="bodyMedium" style={styles.text}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#8D5A00',
    backgroundColor: '#FFF8E8',
  },
  text: { flex: 1 },
});
