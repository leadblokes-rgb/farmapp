import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { ChipSelect } from '@/components/form/ChipSelect';
import { MIN_TAP } from '@/theme';
import { useRegions } from './api';

interface Props {
  selected: string[];
  onChange: (ids: string[]) => void;
}

/** Region chips with loading and retry states, so the list is never silently empty. */
export function RegionSelect({ selected, onChange }: Props) {
  const regions = useRegions();
  if (regions.isPending) {
    return (
      <View style={styles.row} accessibilityLabel="Loading regions">
        <ActivityIndicator />
        <Text variant="bodyLarge">Loading regions…</Text>
      </View>
    );
  }
  if (regions.isError) {
    return (
      <View style={styles.row}>
        <Text variant="bodyLarge" style={styles.flex}>
          Couldn’t load regions.
        </Text>
        <Button mode="outlined" icon="refresh" contentStyle={styles.tall} onPress={() => regions.refetch()}>
          Try again
        </Button>
      </View>
    );
  }
  return (
    <ChipSelect
      options={regions.data.map((r) => ({ key: r.id, label: r.name }))}
      selected={selected}
      onChange={onChange}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TAP },
  flex: { flex: 1 },
  tall: { minHeight: MIN_TAP },
});
