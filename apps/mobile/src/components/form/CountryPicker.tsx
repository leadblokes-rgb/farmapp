import { COUNTRIES, countryName } from '@croppr/shared';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, List, Modal, Portal, Searchbar, Text } from 'react-native-paper';
import { MIN_TAP } from '@/theme';
import { FieldMessage } from './TextField';

interface Props {
  label: string;
  value: string;
  onChange: (code: string) => void;
  error?: string;
}

export function CountryPicker({ label, value, onChange, error }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => COUNTRIES.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())),
    [query],
  );

  return (
    <View>
      <Text variant="bodyMedium">{label}</Text>
      <Button
        mode="outlined"
        icon="earth"
        onPress={() => setOpen(true)}
        contentStyle={styles.button}
        textColor={error ? '#B00020' : undefined}
      >
        {value ? countryName(value) : 'Choose…'}
      </Button>
      <FieldMessage error={error} />
      <Portal>
        <Modal visible={open} onDismiss={() => setOpen(false)} contentContainerStyle={styles.modal}>
          <Searchbar placeholder="Search" value={query} onChangeText={setQuery} autoFocus />
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <List.Item
                title={item.name}
                titleStyle={styles.item}
                style={styles.row}
                right={(p) => (item.code === value ? <List.Icon {...p} icon="check" /> : null)}
                onPress={() => {
                  onChange(item.code);
                  setOpen(false);
                  setQuery('');
                }}
              />
            )}
          />
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: MIN_TAP, justifyContent: 'flex-start' },
  modal: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 12,
    maxHeight: '85%',
    flex: 1,
    gap: 8,
  },
  row: { minHeight: MIN_TAP, justifyContent: 'center' },
  item: { fontSize: 18 },
});
