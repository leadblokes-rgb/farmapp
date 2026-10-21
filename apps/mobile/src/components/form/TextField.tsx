import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { HelperText, TextInput, type TextInputProps } from 'react-native-paper';

type Props<T extends FieldValues> = Omit<TextInputProps, 'value' | 'onChangeText' | 'error'> & {
  control: Control<T>;
  name: Path<T>;
  hint?: string;
};

export function TextField<T extends FieldValues>({ control, name, hint, ...input }: Props<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View>
          <TextInput
            mode="outlined"
            value={(field.value as string | undefined) ?? ''}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={!!fieldState.error}
            style={styles.input}
            {...input}
          />
          <FieldMessage error={fieldState.error?.message} hint={hint} />
        </View>
      )}
    />
  );
}

export function FieldMessage({ error, hint }: { error?: string; hint?: string }) {
  if (!error && !hint) return null;
  return (
    <HelperText type={error ? 'error' : 'info'} visible style={styles.helper}>
      {error ?? hint}
    </HelperText>
  );
}

const styles = StyleSheet.create({
  input: { fontSize: 18 },
  helper: { fontSize: 14 },
});
