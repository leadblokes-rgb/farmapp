import { router, Stack } from 'expo-router';
import { Screen } from '@/components/Screen';
import { useSaveEmployer, useTracker } from '@/features/tracker/api';
import { EmployerForm } from '@/features/tracker/EmployerForm';
import { useUserId } from '@/providers/AuthProvider';

export default function NewEmployer() {
  const userId = useUserId();
  const save = useSaveEmployer(userId);
  const tracker = useTracker(userId);
  return (
    <Screen scroll edges={['bottom']}>
      <Stack.Screen options={{ title: 'Add employer' }} />
      <EmployerForm
        visaType={tracker.data?.visaType}
        initial={{ name: '', postcode: '', abn: '', countsAsSpecified: true }}
        submitLabel="Add employer"
        onSubmit={async (v) => {
          await save.mutateAsync({ v });
          router.back();
        }}
      />
    </Screen>
  );
}
