import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { t } from '@/i18n';

export function Loading() {
  return (
    <View style={styles.centre}>
      <ActivityIndicator size="large" />
    </View>
  );
}

export function LoadError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <View style={styles.centre}>
      <Text variant="bodyLarge">{message ?? t('common.loadError')}</Text>
      <Button mode="contained" onPress={onRetry} contentStyle={{ minHeight: 56 }}>
        {t('common.tryAgain')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 },
});
