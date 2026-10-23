import { StyleSheet } from 'react-native';
import { Snackbar } from 'react-native-paper';

interface Props {
  message: string | null;
  onDismiss: () => void;
  duration?: number;
  /**
   * Height of whatever sits at the bottom of the screen (bulk-action bar, swipe buttons, chat
   * composer), so the toast appears above it instead of covering buttons. Measure it with onLayout.
   */
  bottomOffset?: number;
}

/** A short confirmation message. Every screen uses this instead of a bare Snackbar. */
export function Toast({ message, onDismiss, duration = 3000, bottomOffset = 0 }: Props) {
  return (
    <Snackbar
      visible={message !== null}
      onDismiss={onDismiss}
      duration={duration}
      wrapperStyle={[styles.wrapper, { bottom: bottomOffset }]}
    >
      {message}
    </Snackbar>
  );
}

const styles = StyleSheet.create({
  wrapper: { zIndex: 10 },
});
