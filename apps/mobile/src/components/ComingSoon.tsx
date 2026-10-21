import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Screen } from './Screen';

/** Placeholder for tabs whose features land in a later milestone. */
export function ComingSoon({ title, milestone, description }: { title: string; milestone: number; description: string }) {
  return (
    <Screen edges={[]}>
      <View style={styles.centre}>
        <Text variant="headlineMedium">{title}</Text>
        <Text variant="bodyLarge" style={styles.text}>{description}</Text>
        <Text variant="labelLarge" style={styles.muted}>Coming in milestone {milestone}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  text: { textAlign: 'center' },
  muted: { opacity: 0.7 },
});
