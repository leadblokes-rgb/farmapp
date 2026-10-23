import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Divider, Modal, Portal, Text } from 'react-native-paper';
import { FarmReviews } from '@/features/ratings/Reviews';
import { MIN_TAP } from '@/theme';
import type { RankedFeedJob } from './feedApi';
import { JobCardContent } from './JobCardContent';
import type { SwipeDirection } from './SwipeDeck';

interface Props {
  item: RankedFeedJob | null;
  onDismiss: () => void;
  onDecide: (direction: SwipeDirection) => void;
  onReport: (item: RankedFeedJob) => void;
  /** Shown as "Save for later" when given (Discover). */
  onSave?: () => void;
  /** Label for the left button, e.g. "Remove" on the saved list. */
  skipLabel?: string;
}

export function JobDetailSheet({ item, onDismiss, onDecide, onReport, onSave, skipLabel = 'Skip' }: Props) {
  return (
    <Portal>
      <Modal visible={item !== null} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        {item ? (
          <>
            <ScrollView contentContainerStyle={styles.body}>
              <JobCardContent item={item} />
              <Button
                mode="outlined"
                icon="storefront-outline"
                style={styles.report}
                onPress={() => {
                  onDismiss();
                  router.push(`/worker/farm/${item.job.farm_id}`);
                }}
              >
                About {item.job.farm_name}
              </Button>
              <Divider />
              <Text variant="titleMedium" style={styles.bold}>
                About the job
              </Text>
              <Text variant="bodyLarge">{item.job.description || 'No description given.'}</Text>
              <Divider />
              <FarmReviews farmId={item.job.farm_id} />
              <Divider />
              <Text variant="titleMedium" style={styles.bold}>
                Why you&apos;re seeing this ({Math.round(item.score)}% match)
              </Text>
              {Object.entries(item.breakdown).map(([key, b]) => (
                <Text key={key} variant="bodyMedium">
                  • {b.note}
                </Text>
              ))}
              <Button
                mode="text"
                icon="flag-outline"
                textColor="#B00020"
                onPress={() => onReport(item)}
                style={styles.report}
              >
                Report this job
              </Button>
              {onSave ? (
                <Button mode="text" icon="bookmark-outline" onPress={onSave} style={styles.report}>
                  Save for later
                </Button>
              ) : null}
            </ScrollView>
            <View style={styles.actions}>
              <Button
                mode="outlined"
                icon="close"
                textColor="#B00020"
                style={styles.flex}
                contentStyle={styles.tall}
                onPress={() => onDecide('pass')}
              >
                {skipLabel}
              </Button>
              <Button
                mode="contained"
                icon="check"
                style={styles.flex}
                contentStyle={styles.tall}
                onPress={() => onDecide('like')}
              >
                Apply
              </Button>
            </View>
          </>
        ) : null}
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: { backgroundColor: 'white', margin: 12, borderRadius: 16, maxHeight: '92%', overflow: 'hidden' },
  body: { padding: 20, gap: 12 },
  bold: { fontWeight: '700' },
  report: { alignSelf: 'flex-start' },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#CCCCCC',
  },
  flex: { flex: 1 },
  tall: { minHeight: MIN_TAP },
});
