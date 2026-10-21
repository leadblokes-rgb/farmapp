import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Text, TextInput } from 'react-native-paper';
import { supabase } from '@/lib/supabase';
import { MIN_TAP } from '@/theme';

/** Link up with friends so farms see you're travelling together (each person still applies). */
export function GroupCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const group = useQuery({
    queryKey: ['my-group', userId],
    queryFn: async () => {
      const { data, error: e } = await supabase.rpc('my_group');
      if (e) throw e;
      return data;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['my-group', userId] });
    qc.invalidateQueries({ queryKey: ['worker-profile', userId] });
  };
  const run = useMutation({
    mutationFn: async (action: 'create' | 'join' | 'leave') => {
      const res =
        action === 'create'
          ? await supabase.rpc('create_group')
          : action === 'join'
            ? await supabase.rpc('join_group', { p_invite_code: code })
            : await supabase.rpc('leave_group');
      if (res.error) throw res.error;
    },
    onSuccess: () => {
      setError(null);
      setCode('');
      refresh();
    },
    onError: (e) => setError(e.message),
  });

  const members = group.data ?? [];
  const inGroup = members.length > 0;

  return (
    <Card mode="outlined">
      <Card.Content style={styles.content}>
        <Text variant="titleLarge" style={styles.bold}>
          Travelling with friends?
        </Text>
        {inGroup ? (
          <>
            <Text variant="bodyLarge">
              Your group: {members.map((m) => (m.is_me ? 'You' : m.member_name)).join(', ')}
            </Text>
            <Text variant="bodyLarge">
              Group code: <Text style={styles.code}>{members[0]!.invite_code}</Text>
            </Text>
            <Text variant="bodyMedium">
              Farms see your group together on their shortlist so they can hire you all at once. Each person
              still swipes and applies for themselves.
            </Text>
            <Button
              mode="outlined"
              icon="share-variant"
              contentStyle={styles.tall}
              onPress={() =>
                Share.share({ message: `Join my group on Croppr with code ${members[0]!.invite_code}` })
              }
            >
              Share code
            </Button>
            <Button
              mode="text"
              textColor="#B00020"
              contentStyle={styles.tall}
              onPress={() => run.mutate('leave')}
            >
              Leave group
            </Button>
          </>
        ) : (
          <>
            <Text variant="bodyMedium">
              Link up so farms know you want to work together. One person creates a group and shares the code.
            </Text>
            <Button
              mode="contained"
              icon="account-multiple-plus"
              contentStyle={styles.tall}
              onPress={() => run.mutate('create')}
              loading={run.isPending && run.variables === 'create'}
            >
              Create a group
            </Button>
            <View style={styles.row}>
              <TextInput
                mode="outlined"
                label="Friend's group code"
                accessibilityLabel="Friend's group code"
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                autoCapitalize="characters"
                maxLength={6}
                style={styles.flex}
              />
              <Button
                mode="outlined"
                disabled={code.length < 6}
                onPress={() => run.mutate('join')}
                contentStyle={styles.tall}
                style={styles.join}
              >
                Join
              </Button>
            </View>
          </>
        )}
        <HelperText type="error" visible={error !== null}>
          {error}
        </HelperText>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: 8 },
  bold: { fontWeight: '700' },
  code: { fontWeight: '800', letterSpacing: 2, fontSize: 18 },
  tall: { minHeight: MIN_TAP },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  flex: { flex: 1 },
  join: { marginTop: 6 },
});
