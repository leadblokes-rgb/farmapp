import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HelperText } from 'react-native-paper';
import { Section } from '@/components/form/Section';
import { SwitchRow } from '@/components/form/SwitchRow';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

type Pref = 'messages' | 'updates' | 'reminders';
type Prefs = Record<Pref, boolean>;

const ROWS: Record<'worker' | 'farm', { key: Pref; label: string; description: string }[]> = {
  worker: [
    { key: 'messages', label: 'Messages', description: 'When a farm sends you a message.' },
    {
      key: 'updates',
      label: 'Updates about my jobs',
      description: 'Accepted or not, no-shows, and “did this work out?” when a job ends.',
    },
  ],
  farm: [
    { key: 'messages', label: 'Messages', description: 'When a worker sends you a message.' },
    {
      key: 'updates',
      label: 'Applicants and job updates',
      description: 'New applicants, and “did your crew work out?” when a job ends.',
    },
    {
      key: 'reminders',
      label: 'Check-in reminders',
      description: 'On a job’s first day, to check in your crew.',
    },
  ],
};

/** Push notification settings, saved as soon as a switch changes. No row = everything on. */
export function NotificationSettings({
  userId,
  role,
  onSaved,
}: {
  userId: string;
  role: 'worker' | 'farm';
  onSaved: (m: string) => void;
}) {
  const qc = useQueryClient();
  const key = ['notification-prefs', userId];
  const prefs = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Prefs> => {
      const { data, error } = await supabase
        .from('notification_prefs')
        .select('messages, updates, reminders')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data ?? { messages: true, updates: true, reminders: true };
    },
  });
  const save = useMutation({
    mutationFn: async (next: Prefs) => {
      const { error } = await supabase.from('notification_prefs').upsert({ user_id: userId, ...next });
      if (error) throw error;
    },
    onMutate: (next) => qc.setQueryData(key, next),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
    onSuccess: () => onSaved('Notification settings saved'),
  });

  if (!prefs.data) return null;
  const current = prefs.data;
  return (
    <Section title="Notifications" note="Choose which notifications you get on this phone.">
      {ROWS[role].map((r) => (
        <SwitchRow
          key={r.key}
          label={r.label}
          description={r.description}
          value={current[r.key]}
          onChange={(v) => save.mutate({ ...current, [r.key]: v })}
        />
      ))}
      <HelperText type="error" visible={save.isError}>
        {save.error ? friendlyError(save.error) : ''}
      </HelperText>
    </Section>
  );
}
