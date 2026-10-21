import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

export function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="titleLarge" style={styles.title}>
        {title}
      </Text>
      {note ? (
        <Text variant="bodyMedium" style={styles.note}>
          {note}
        </Text>
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 6, paddingTop: 8 },
  title: { fontWeight: '700' },
  note: { opacity: 0.8 },
  body: { gap: 10, marginTop: 4 },
});
