import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Text } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { DateField } from '@/components/form/DateField';
import { MoneyField } from '@/components/form/MoneyField';
import { SwitchRow } from '@/components/form/SwitchRow';
import { RegionSelect } from '@/features/common/RegionSelect';
import { NO_FILTERS, type FeedFilters } from './feedApi';

interface Props {
  visible: boolean;
  value: FeedFilters;
  onApply: (f: FeedFilters) => void;
  onDismiss: () => void;
}

export function FiltersSheet({ visible, value, onApply, onDismiss }: Props) {
  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        {/* Re-mount the form each time it opens so it starts from the applied filters. */}
        {visible ? <FiltersForm initial={value} onApply={onApply} /> : null}
      </Modal>
    </Portal>
  );
}

function FiltersForm({ initial, onApply }: { initial: FeedFilters; onApply: (f: FeedFilters) => void }) {
  const [f, setF] = useState(initial);
  const set = <K extends keyof FeedFilters>(k: K, v: FeedFilters[K]) => setF((prev) => ({ ...prev, [k]: v }));

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text variant="headlineSmall" style={styles.bold}>
        Filter jobs
      </Text>
      <Text variant="titleMedium">Regions</Text>
      <RegionSelect selected={f.regionIds} onChange={(ids) => set('regionIds', ids)} />
      <Text variant="titleMedium">I&apos;m available</Text>
      <View style={styles.row}>
        <DateField label="From" value={f.from} onChange={(v) => set('from', v)} />
        <DateField label="To" value={f.to} minDate={f.from} onChange={(v) => set('to', v)} />
      </View>
      <MoneyField
        label="Minimum hourly pay"
        suffix="/hr"
        value={f.minHourlyCents}
        onChange={(v) => set('minHourlyCents', v)}
        hint="For piece-rate jobs this uses the guaranteed hourly minimum."
      />
      <SwitchRow
        label="Only jobs with accommodation"
        value={f.accommodationOnly}
        onChange={(v) => set('accommodationOnly', v)}
      />
      <BigButton onPress={() => onApply(f)}>Show jobs</BigButton>
      <Button mode="text" onPress={() => onApply(NO_FILTERS)} contentStyle={styles.tall}>
        Clear all filters
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  modal: { backgroundColor: 'white', margin: 12, borderRadius: 16, maxHeight: '92%' },
  body: { padding: 20, gap: 12 },
  bold: { fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
  tall: { minHeight: 56 },
});
