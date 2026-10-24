import { router, Stack } from 'expo-router';
import { Screen } from '@/components/Screen';
import { useSaveEmployer } from '@/features/tracker/api';
import { EmployerForm } from '@/features/tracker/EmployerForm';
import { useUserId } from '@/providers/AuthProvider';
import { t } from '@/i18n';

export default function NewEmployer() {
  const save = useSaveEmployer(useUserId());
  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{ title: t('tracker.addEmployer') }} />
      <EmployerForm
        initial={{ name: '', postcode: '', abn: '', countsAsSpecified: true }}
        submitLabel={t('tracker.addEmployer')}
        onSubmit={async (v) => {
          await save.mutateAsync({ v });
          router.back();
        }}
      />
    </Screen>
  );
}
