import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Text } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { DateField } from '@/components/form/DateField';
import { MoneyField } from '@/components/form/MoneyField';
import { SwitchRow } from '@/components/form/SwitchRow';
import { RegionSelect } from '@/features/common/RegionSelect';
import { NO_FILTERS, type FeedFilters } from './feedApi';
import { t } from '@/i18n';

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
        {t('filters.title')}
      </Text>
      <Text variant="titleMedium">{t('filters.regions')}</Text>
      <RegionSelect selected={f.regionIds} onChange={(ids) => set('regionIds', ids)} />
      <Text variant="titleMedium">{t('filters.available')}</Text>
      <View style={styles.row}>
        <DateField label={t('filters.from')} value={f.from} onChange={(v) => set('from', v)} />
        <DateField label={t('filters.to')} value={f.to} minDate={f.from} onChange={(v) => set('to', v)} />
      </View>
      <MoneyField
        label={t('filters.minPay')}
        suffix={t('form.perHour')}
        value={f.minHourlyCents}
        onChange={(v) => set('minHourlyCents', v)}
        hint={t('filters.minPayHint')}
      />
      <SwitchRow
        label={t('alerts.accommodationOnly')}
        value={f.accommodationOnly}
        onChange={(v) => set('accommodationOnly', v)}
      />
      <BigButton onPress={() => onApply(f)}>{t('filters.show')}</BigButton>
      <Button mode="text" onPress={() => onApply(NO_FILTERS)} contentStyle={styles.tall}>
        {t('filters.clear')}
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
