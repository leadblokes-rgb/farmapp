import { VISA_TYPE_LABELS } from '@croppr/shared';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Checkbox, Icon, Text } from 'react-native-paper';
import { MIN_TAP } from '@/theme';
import type { Applicant, FactorScore } from './shortlistApi';

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');
}

export function VisaBadge({ a }: { a: Pick<Applicant, 'visa_type' | 'visa_valid_through_job_end'> }) {
  if (!a.visa_type) return null;
  const ok = a.visa_valid_through_job_end;
  const label =
    a.visa_type === 'citizen_pr' ? 'Citizen / PR' : `${a.visa_type === 'other' ? 'Other visa' : a.visa_type}`;
  return (
    <View
      style={[styles.badge, ok ? styles.ok : styles.warn]}
      accessibilityLabel={`${VISA_TYPE_LABELS[a.visa_type]}: ${ok ? 'covers the job dates' : 'ends before the job ends'}`}
    >
      <Icon source={ok ? 'check-circle' : 'alert'} size={16} color={ok ? '#17482F' : '#8D5A00'} />
      <Text style={styles.badgeText}>
        {ok ? `${label} · visa covers job` : `${label} · visa ends before job end`}
      </Text>
    </View>
  );
}

interface Props {
  a: Applicant;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  groupNote?: string;
}

export function ApplicantCard({ a, selectable, selected, onToggle, onOpen, groupNote }: Props) {
  const b = (a.score_breakdown ?? {}) as Record<string, FactorScore>;
  return (
    <View style={[styles.card, selected && styles.selected, a.group_id && styles.grouped]}>
      {selectable ? (
        <Pressable
          onPress={onToggle}
          style={styles.check}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          accessibilityLabel={`Select ${a.full_name}`}
        >
          <Checkbox.Android status={selected ? 'checked' : 'unchecked'} onPress={onToggle} />
        </Pressable>
      ) : null}
      <Pressable onPress={onOpen} style={styles.body} accessibilityHint="Opens applicant details">
        <View style={styles.row}>
          {a.photoUrl ? (
            <Image source={{ uri: a.photoUrl }} style={styles.photo} />
          ) : (
            <Avatar.Text size={52} label={initials(a.full_name)} />
          )}
          <View style={styles.flex}>
            <Text variant="titleMedium" style={styles.name} numberOfLines={2}>
              {a.full_name}
            </Text>
            <Text variant="bodyMedium">{[a.locality, b.distance?.note].filter(Boolean).join(' · ')}</Text>
          </View>
          {a.match_score != null ? (
            <View
              style={styles.score}
              accessibilityLabel={`Match score ${Math.round(Number(a.match_score))}`}
            >
              <Text style={styles.scoreText}>{Math.round(Number(a.match_score))}</Text>
            </View>
          ) : null}
        </View>
        <Text variant="bodyMedium">{b.availability?.note ?? ''}</Text>
        <View style={styles.tags}>
          <Tag icon={a.has_car ? 'car' : 'car-off'} text={a.has_car ? 'Has car' : 'No car'} />
          {a.needs_accommodation ? <Tag icon="home" text="Needs accommodation" /> : null}
          <Tag icon="sprout" text={`${a.years_experience} season${a.years_experience === 1 ? '' : 's'}`} />
          {a.rating_count > 0 && a.reliability_avg != null ? (
            <Tag
              icon="star"
              text={`${Number(a.reliability_avg).toFixed(1)} reliability (${a.rating_count} rating${a.rating_count === 1 ? '' : 's'})`}
            />
          ) : (
            <Tag icon="star-outline" text="No ratings yet" />
          )}
          {a.no_show_count > 0 ? (
            <Tag
              icon="alert-circle-outline"
              text={`${a.no_show_count} no-show${a.no_show_count === 1 ? '' : 's'}`}
              warn
            />
          ) : null}
        </View>
        <VisaBadge a={a} />
        {groupNote ? (
          <Text variant="bodyMedium" style={styles.group}>
            👥 {groupNote}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

function Tag({ icon, text, warn }: { icon: string; text: string; warn?: boolean }) {
  return (
    <View style={[styles.tag, warn && styles.warn]}>
      <Icon source={icon} size={16} color={warn ? '#8D5A00' : '#333333'} />
      <Text style={styles.tagText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#BDBDBD',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  selected: { borderColor: '#17482F', borderWidth: 3, backgroundColor: '#F1F8E9' },
  grouped: { borderLeftWidth: 6, borderLeftColor: '#8D5A00' },
  check: { width: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, padding: 12, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  photo: { width: 52, height: 52, borderRadius: 26 },
  name: { fontWeight: '700' },
  score: {
    minWidth: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#17482F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: { color: '#FFFFFF', fontWeight: '800', fontSize: 18 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F2F2F2',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: 14 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ok: { backgroundColor: '#E8F5E9' },
  warn: { backgroundColor: '#FFF3D6' },
  badgeText: { fontSize: 14, fontWeight: '600' },
  group: { color: '#5C3B00', fontWeight: '600' },
});
