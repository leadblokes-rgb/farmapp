import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { Linking, StyleSheet, View } from 'react-native';
import { Button, HelperText, Icon, Text } from 'react-native-paper';
import { Section } from '@/components/form/Section';
import { friendlyError } from '@/lib/errors';
import { removeUserFiles, signedUrl, uploadUserFileFromUri } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { MIN_TAP } from '@/theme';
import { t } from '@/i18n';

const TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/*',
];

function useResume(userId: string) {
  return useQuery({
    queryKey: ['resume', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_profiles')
        .select('resume_path, resume_name')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Open a resume (the worker's own, or an applicant's for a farm) in the phone's viewer. */
export async function openResume(path: string) {
  await Linking.openURL(await signedUrl('resumes', path, 600));
}

/** Profile → Resume: import a PDF, Word file or photo. Only farms you apply to can open it. */
export function ResumeCard({ userId, onMessage }: { userId: string; onMessage: (m: string) => void }) {
  const qc = useQueryClient();
  const resume = useResume(userId);
  const save = useMutation({
    mutationFn: async (file: { uri: string; name: string; mimeType: string } | null) => {
      let path: string | null = null;
      if (file) path = await uploadUserFileFromUri({ bucket: 'resumes', userId, ...file });
      const { error } = await supabase
        .from('worker_profiles')
        .update({ resume_path: path, resume_name: file ? file.name.slice(0, 120) : null })
        .eq('user_id', userId);
      if (error) throw error;
      // Keep only the current file.
      await removeUserFiles('resumes', userId, path ?? undefined);
    },
    onSuccess: (_d, file) => {
      qc.invalidateQueries({ queryKey: ['resume', userId] });
      onMessage(file ? t('resume.added') : t('resume.removed'));
    },
  });

  async function pick() {
    const r = await DocumentPicker.getDocumentAsync({ type: TYPES, copyToCacheDirectory: true });
    const a = !r.canceled ? r.assets[0] : null;
    if (!a) return;
    if (a.size && a.size > 5 * 1024 * 1024) return onMessage(t('resume.tooBig'));
    save.mutate({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/pdf' });
  }

  const current = resume.data?.resume_path ? resume.data : null;
  return (
    <Section title={t('resume.title')} note={t('resume.note')}>
      {current ? (
        <View style={styles.row}>
          <Icon source="file-account-outline" size={28} color="#17482F" />
          <Text variant="bodyLarge" style={styles.flex} numberOfLines={2}>
            {current.resume_name ?? t('resume.title')}
          </Text>
        </View>
      ) : null}
      <View style={styles.actions}>
        <Button
          mode={current ? 'outlined' : 'contained'}
          icon="file-upload-outline"
          contentStyle={styles.tall}
          loading={save.isPending}
          disabled={save.isPending}
          onPress={pick}
        >
          {current ? t('resume.replace') : t('resume.import')}
        </Button>
        {current ? (
          <>
            <Button
              mode="text"
              icon="eye-outline"
              contentStyle={styles.tall}
              onPress={() => openResume(current.resume_path!).catch((e) => onMessage(friendlyError(e)))}
            >
              {t('resume.view')}
            </Button>
            <Button
              mode="text"
              icon="delete-outline"
              textColor="#B00020"
              contentStyle={styles.tall}
              disabled={save.isPending}
              onPress={() => save.mutate(null)}
            >
              {t('resume.remove')}
            </Button>
          </>
        ) : null}
      </View>
      <HelperText type="error" visible={save.isError}>
        {save.error ? friendlyError(save.error) : ''}
      </HelperText>
    </Section>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tall: { minHeight: MIN_TAP },
});
