import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';
import { MoneyField } from '@/components/form/MoneyField';
import { Section } from '@/components/form/Section';
import { SwitchRow } from '@/components/form/SwitchRow';
import { RegionSelect } from '@/features/common/RegionSelect';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { MIN_TAP } from '@/theme';

interface Alert {
  enabled: boolean;
  regionIds: string[];
  minHourlyCents: number | null;
  accommodationOnly: boolean;
}

/** The worker's saved alert, or defaults from their preferred regions (alerts are off until saved). */
function useJobAlert(userId: string) {
  return useQuery({
    queryKey: ['job-alert', userId],
    queryFn: async (): Promise<Alert & { exists: boolean }> => {
      const [alert, regions] = await Promise.all([
        supabase.from('job_alerts').select('*').eq('worker_id', userId).maybeSingle(),
        supabase.from('worker_regions').select('region_id').eq('worker_id', userId),
      ]);
      if (alert.error) throw alert.error;
      const a = alert.data;
      return a
        ? {
            exists: true,
            enabled: a.enabled,
            regionIds: a.region_ids,
            minHourlyCents: a.min_hourly_cents,
            accommodationOnly: a.accommodation_only,
          }
        : {
            exists: false,
            enabled: false,
            regionIds: (regions.data ?? []).map((r) => r.region_id),
            minHourlyCents: null,
            accommodationOnly: false,
          };
    },
  });
}

export function JobAlertsCard({ userId, onSaved }: { userId: string; onSaved: (m: string) => void }) {
  const alert = useJobAlert(userId);
  if (!alert.data) return null;
  return <Form key={alert.dataUpdatedAt} userId={userId} initial={alert.data} onSaved={onSaved} />;
}

function Form({
  userId,
  initial,
  onSaved,
}: {
  userId: string;
  initial: Alert;
  onSaved: (m: string) => void;
}) {
  const qc = useQueryClient();
  const [a, setA] = useState<Alert>(initial);
  const set = <K extends keyof Alert>(k: K, v: Alert[K]) => setA((x) => ({ ...x, [k]: v }));
  const save = useMutation({
    mutationFn: async (v: Alert) => {
      const { error } = await supabase.from('job_alerts').upsert({
        worker_id: userId,
        enabled: v.enabled,
        region_ids: v.regionIds,
        min_hourly_cents: v.minHourlyCents,
        accommodation_only: v.accommodationOnly,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['job-alert', userId] });
      onSaved(v.enabled ? 'Job alerts on' : 'Job alerts off');
    },
  });

  return (
    <Section title="Job alerts" note="Get a notification when a new job matches. At most 3 a day.">
      <SwitchRow label="Tell me about new jobs" value={a.enabled} onChange={(v) => set('enabled', v)} />
      {a.enabled ? (
        <>
          <Text variant="bodyLarge">Regions (none selected = anywhere)</Text>
          <RegionSelect selected={a.regionIds} onChange={(ids) => set('regionIds', ids)} />
          <MoneyField
            label="Minimum hourly pay (optional)"
            suffix="/hr"
            value={a.minHourlyCents}
            onChange={(v) => set('minHourlyCents', v)}
          />
          <SwitchRow
            label="Only jobs with accommodation"
            value={a.accommodationOnly}
            onChange={(v) => set('accommodationOnly', v)}
          />
        </>
      ) : null}
      <HelperText type="error" visible={save.isError}>
        {save.error ? friendlyError(save.error) : ''}
      </HelperText>
      <Button
        mode="contained"
        contentStyle={styles.tall}
        loading={save.isPending}
        onPress={() => save.mutate(a)}
      >
        Save job alerts
      </Button>
    </Section>
  );
}

const styles = StyleSheet.create({
  tall: { minHeight: MIN_TAP },
});
