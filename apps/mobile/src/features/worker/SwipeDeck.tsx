import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { RankedFeedJob } from './feedApi';
import { JobCardContent } from './JobCardContent';
import { t } from '@/i18n';

/** Right applies, left skips, up saves for later. */
export type SwipeDirection = 'like' | 'pass' | 'save';

export interface SwipeDeckHandle {
  /** Animate the top card off-screen, as if swiped (used by the big buttons). */
  swipe(direction: SwipeDirection): void;
}

interface Props {
  items: RankedFeedJob[];
  onSwiped: (item: RankedFeedJob, direction: SwipeDirection) => void;
  onOpen: (item: RankedFeedJob) => void;
}

const SWIPE_THRESHOLD = 0.3; // fraction of screen width
const SAVE_THRESHOLD = 0.18; // fraction of screen height, swiping up

export const SwipeDeck = forwardRef<SwipeDeckHandle, Props>(function SwipeDeck(
  { items, onSwiped, onOpen },
  ref,
) {
  const { width, height } = useWindowDimensions();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const top = items[0];
  const next = items[1];

  // Each new top card starts centred.
  useEffect(() => {
    tx.value = 0;
    ty.value = 0;
  }, [top?.job.id, tx, ty]);

  function finish(direction: SwipeDirection) {
    if (top) onSwiped(top, direction);
  }

  function flyOut(direction: SwipeDirection) {
    'worklet';
    const done = (finished?: boolean) => {
      if (finished) scheduleOnRN(finish, direction);
    };
    if (direction === 'save') {
      tx.value = withTiming(0, { duration: 220 });
      ty.value = withTiming(-height * 1.2, { duration: 220 }, done);
    } else {
      tx.value = withTiming((direction === 'like' ? 1 : -1) * width * 1.5, { duration: 220 }, done);
    }
  }

  useImperativeHandle(ref, () => ({ swipe: (d) => top && flyOut(d) }));

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .activeOffsetY([-12, 12])
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = Math.min(0, e.translationY);
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > width * SWIPE_THRESHOLD || Math.abs(e.velocityX) > 900) {
        flyOut(e.translationX > 0 ? 'like' : 'pass');
      } else if (-e.translationY > height * SAVE_THRESHOLD || e.velocityY < -900) {
        flyOut('save');
      } else {
        tx.value = withSpring(0);
        ty.value = withSpring(0);
      }
    });

  const topStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${interpolate(tx.value, [-width, width], [-12, 12])}deg` },
    ],
  }));
  const nextStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(Math.abs(tx.value), [0, width * SWIPE_THRESHOLD], [0.95, 1], 'clamp') }],
  }));
  const applyLabel = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [20, width * 0.25], [0, 1], 'clamp'),
  }));
  const saveLabel = useAnimatedStyle(() => ({
    opacity: interpolate(ty.value, [-height * 0.15, -20], [1, 0], 'clamp'),
  }));
  const skipLabel = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [-width * 0.25, -20], [1, 0], 'clamp'),
  }));

  if (!top) return null;

  return (
    <View style={styles.deck}>
      {next ? (
        <Animated.View key={next.job.id} style={[styles.card, nextStyle]} pointerEvents="none">
          <View style={styles.clip}>
            <JobCardContent item={next} compact />
          </View>
        </Animated.View>
      ) : null}
      <GestureDetector gesture={pan}>
        <Animated.View key={top.job.id} style={[styles.card, topStyle]} testID="swipe-card">
          <Pressable
            onPress={() => onOpen(top)}
            accessibilityHint={t('swipe.opensDetails')}
            style={styles.fill}
          >
            {/* On short screens the card clips its last facts; "Tap for details" stays visible. */}
            <View style={styles.clip}>
              <JobCardContent item={top} compact />
            </View>
            <Text style={styles.more}>{t('swipe.tapForDetails')}</Text>
          </Pressable>
          <Animated.View style={[styles.stamp, styles.applyStamp, applyLabel]} pointerEvents="none">
            <Text style={[styles.stampText, styles.applyText]}>{t('swipe.apply')}</Text>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.saveStamp, saveLabel]} pointerEvents="none">
            <Text style={[styles.stampText, styles.saveText]}>{t('swipe.saved')}</Text>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.skipStamp, skipLabel]} pointerEvents="none">
            <Text style={[styles.stampText, styles.skipText]}>{t('swipe.skip')}</Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  deck: { flex: 1 },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#C8E6C9',
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fill: { flex: 1 },
  clip: { flex: 1, overflow: 'hidden' },
  more: { paddingTop: 6, textAlign: 'center', fontSize: 15, color: '#555555' },
  stamp: {
    position: 'absolute',
    top: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 4,
    borderRadius: 10,
  },
  applyStamp: { left: 20, borderColor: '#17482F', transform: [{ rotate: '-12deg' }] },
  skipStamp: { right: 20, borderColor: '#B00020', transform: [{ rotate: '12deg' }] },
  saveStamp: { alignSelf: 'center', top: 60, borderColor: '#8D5A00' },
  stampText: { fontSize: 30, fontWeight: '900' },
  applyText: { color: '#17482F' },
  skipText: { color: '#B00020' },
  saveText: { color: '#8D5A00' },
});
