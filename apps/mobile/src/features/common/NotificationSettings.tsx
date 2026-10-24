import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HelperText } from 'react-native-paper';
import { Section } from '@/components/form/Section';
import { SwitchRow } from '@/components/form/SwitchRow';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { t } from '@/i18n';

type Pref = 'messages' | 'updates' | 'reminders';
type Prefs = Record<Pref, boolean>;

// Which settings each role sees; labels are notifications.<role>.<key> (and <key>Note) in en.json.
const ROWS = {
  worker: ['messages', 'updates'],
  farm: ['messages', 'updates', 'reminders'],
} as const;

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
    onSuccess: () => onSaved(t('notifications.saved')),
  });

  if (!prefs.data) return null;
  const current = prefs.data;
  return (
    <Section title={t('notifications.title')} note={t('notifications.note')}>
      {ROWS[role].map((key: Pref) => (
        <SwitchRow
          key={key}
          label={t(`notifications.${role}.${key}` as 'notifications.farm.messages')}
          description={t(`notifications.${role}.${key}Note` as 'notifications.farm.messagesNote')}
          value={current[key]}
          onChange={(v) => save.mutate({ ...current, [key]: v })}
        />
      ))}
      <HelperText type="error" visible={save.isError}>
        {save.error ? friendlyError(save.error) : ''}
      </HelperText>
    </Section>
  );
}
