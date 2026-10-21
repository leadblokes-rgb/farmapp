import { StyleSheet } from 'react-native';
import { Button, type ButtonProps } from 'react-native-paper';
import { MIN_TAP } from '@/theme';

/** Paper Button with a full-width, glove-friendly tap target. */
export function BigButton({ contentStyle, style, mode = 'contained', ...props }: ButtonProps) {
  return (
    <Button
      mode={mode}
      style={[styles.button, style]}
      contentStyle={[styles.content, contentStyle]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  button: { alignSelf: 'stretch' },
  content: { minHeight: MIN_TAP },
});
