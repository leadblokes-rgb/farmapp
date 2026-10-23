import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, HelperText, Modal, Portal, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { BigButton } from '@/components/BigButton';
import { StarInput } from '@/components/Stars';
import { friendlyError } from '@/lib/errors';
import { MIN_TAP } from '@/theme';
import { useRateFarm, useRateWorker, type PendingReview } from './api';

interface Props {
  review: PendingReview | null;
  onDismiss: () => void;
  onDone: (message: string) => void;
}

/** Rate a farm (worker) or a worker (farm). Ratings stay hidden until both sides have rated. */
export function RatingSheet({ review, onDismiss, onDone }: Props) {
  return (
    <Portal>
      <Modal visible={review !== null} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        {review ? (
          review.kind === 'farm' ? (
            <FarmForm review={review} onDismiss={onDismiss} onDone={onDone} />
          ) : (
            <WorkerForm review={review} onDismiss={onDismiss} onDone={onDone} />
          )
        ) : null}
      </Modal>
    </Portal>
  );
}

type FormProps = { review: PendingReview; onDismiss: () => void; onDone: (message: string) => void };

const BLIND_NOTE =
  'Ratings are blind: they can’t see yours until they’ve rated you too, or 14 days have passed. You can’t change it later.';

function FarmForm({ review, onDismiss, onDone }: FormProps) {
  const rate = useRateFarm();
  const [overall, setOverall] = useState<number | null>(null);
  const [accommodation, setAccommodation] = useState<number | null>(null);
  const [again, setAgain] = useState<'yes' | 'no' | ''>('');
  const [comment, setComment] = useState('');

  const submit = () =>
    overall &&
    again &&
    rate.mutate(
      {
        applicationId: review.application_id,
        overall,
        accommodation,
        wouldWorkAgain: again === 'yes',
        comment,
      },
      { onSuccess: () => onDone(`Thanks for rating ${review.subject_name}`) },
    );

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text variant="headlineSmall" style={styles.bold}>
        How was {review.subject_name}?
      </Text>
      <Text variant="bodyLarge">{review.job_title}</Text>
      <StarInput label="Overall" value={overall} onChange={setOverall} />
      <StarInput
        label="Accommodation (only if you stayed there)"
        value={accommodation}
        onChange={setAccommodation}
      />
      {accommodation ? (
        <Button compact style={styles.left} onPress={() => setAccommodation(null)}>
          I didn’t stay in their accommodation
        </Button>
      ) : null}
      <Text variant="titleMedium">Would you work here again?</Text>
      <SegmentedButtons
        value={again}
        onValueChange={(v) => setAgain(v as 'yes' | 'no')}
        buttons={[
          { value: 'yes', label: 'Yes', icon: 'thumb-up-outline', style: styles.segment },
          { value: 'no', label: 'No', icon: 'thumb-down-outline', style: styles.segment },
        ]}
      />
      <Comment value={comment} onChange={setComment} placeholder="Pay, hours, supervisors, conditions…" />
      <Text variant="bodySmall" style={styles.note}>
        Shown to other workers with your first name. {BLIND_NOTE}
      </Text>
      <HelperText type="error" visible={rate.isError}>
        {rate.error ? friendlyError(rate.error) : ''}
      </HelperText>
      <BigButton
        icon="star"
        disabled={!overall || !again || rate.isPending}
        loading={rate.isPending}
        onPress={submit}
      >
        Submit rating
      </BigButton>
      <Button mode="text" contentStyle={styles.tall} onPress={onDismiss}>
        Later
      </Button>
    </ScrollView>
  );
}

function WorkerForm({ review, onDismiss, onDone }: FormProps) {
  const rate = useRateWorker();
  const [reliability, setReliability] = useState<number | null>(null);
  const [quality, setQuality] = useState<number | null>(null);
  const [comment, setComment] = useState('');

  const submit = () =>
    reliability &&
    quality &&
    rate.mutate(
      { applicationId: review.application_id, reliability, quality, comment },
      { onSuccess: () => onDone(`Thanks for rating ${review.subject_name}`) },
    );

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text variant="headlineSmall" style={styles.bold}>
        Rate {review.subject_name}
      </Text>
      <Text variant="bodyLarge">{review.job_title}</Text>
      <StarInput label="Reliability (on time, turned up)" value={reliability} onChange={setReliability} />
      <StarInput label="Quality of work" value={quality} onChange={setQuality} />
      <Comment value={comment} onChange={setComment} placeholder="Anything other farms should know?" />
      <Text variant="bodySmall" style={styles.note}>
        Only farms this worker applies to can see it. {BLIND_NOTE}
      </Text>
      <HelperText type="error" visible={rate.isError}>
        {rate.error ? friendlyError(rate.error) : ''}
      </HelperText>
      <BigButton
        icon="star"
        disabled={!reliability || !quality || rate.isPending}
        loading={rate.isPending}
        onPress={submit}
      >
        Submit rating
      </BigButton>
      <Button mode="text" contentStyle={styles.tall} onPress={onDismiss}>
        Later
      </Button>
    </ScrollView>
  );
}

function Comment({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <TextInput
      mode="outlined"
      label="Comment (optional)"
      accessibilityLabel="Comment"
      placeholder={placeholder}
      value={value}
      onChangeText={onChange}
      multiline
      numberOfLines={3}
      maxLength={500}
    />
  );
}

const styles = StyleSheet.create({
  modal: { backgroundColor: 'white', margin: 12, borderRadius: 16, maxHeight: '92%' },
  body: { padding: 20, gap: 12 },
  bold: { fontWeight: '700' },
  left: { alignSelf: 'flex-start' },
  segment: { minHeight: 48 },
  note: { opacity: 0.75 },
  tall: { minHeight: MIN_TAP },
});
