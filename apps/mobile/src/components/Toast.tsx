import { StyleSheet } from 'react-native';
import { Snackbar } from 'react-native-paper';

interface Props {
  message: string | null;
  onDismiss: () => void;
  duration?: number;
}

/**
 * A short confirmation message at the top of the screen, so it never covers the swipe buttons,
 * bulk-action bars or the chat composer at the bottom. Every screen uses this, not a bare Snackbar.
 */
export function Toast({ message, onDismiss, duration = 3000 }: Props) {
  return (
    <Snackbar
      visible={message !== null}
      onDismiss={onDismiss}
      duration={duration}
      wrapperStyle={styles.wrapper}
    >
      {message}
    </Snackbar>
  );
}

const styles = StyleSheet.create({
  wrapper: { top: 0, bottom: undefined, zIndex: 10 },
});
