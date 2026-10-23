import { Stack, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { LegalDocument, type LegalDoc } from '@/features/legal/LegalDocument';

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const which: LegalDoc = doc === 'privacy' ? 'privacy' : 'terms';
  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{ title: which === 'privacy' ? 'Privacy policy' : 'Terms of use' }} />
      <LegalDocument doc={which} />
    </Screen>
  );
}
