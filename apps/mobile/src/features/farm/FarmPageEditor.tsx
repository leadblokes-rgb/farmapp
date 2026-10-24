import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, HelperText, Icon, IconButton, Text, TextInput } from 'react-native-paper';
import { Section } from '@/components/form/Section';
import { friendlyError } from '@/lib/errors';
import { farmImageUrl, uploadUserImage } from '@/lib/storage';
import { MIN_TAP } from '@/theme';
import { initials } from './ApplicantCard';
import { useSaveFarmPage, type useMyFarm } from './api';
import { t } from '@/i18n';

type Farm = NonNullable<ReturnType<typeof useMyFarm>['data']>;

const MAX_PHOTOS = 6;

async function pickImage(aspect: [number, number]) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 0.6,
    base64: true,
  });
  const a = !result.canceled ? result.assets[0] : null;
  return a?.base64 ? { base64: a.base64, mimeType: a.mimeType ?? 'image/jpeg' } : null;
}

/** What workers see on the farm page: logo, photos, website and accommodation details. */
export function FarmPageEditor({
  farm,
  userId,
  onSaved,
}: {
  farm: Farm;
  userId: string;
  onSaved: (message: string) => void;
}) {
  const save = useSaveFarmPage(userId);
  const [website, setWebsite] = useState(farm.website ?? '');
  const [accommodation, setAccommodation] = useState(farm.accommodation_details);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<void>, done: string) {
    setBusy(label);
    setError(null);
    try {
      await fn();
      onSaved(done);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  const changeLogo = () =>
    run(
      'logo',
      async () => {
        const img = await pickImage([1, 1]);
        if (!img) return;
        const path = await uploadUserImage({ bucket: 'farm-logos', userId, name: 'logo', ...img });
        await save.mutateAsync({ logo_path: path });
      },
      t('farmPageEditor.logoUpdated'),
    );

  const addPhoto = () =>
    run(
      'photo',
      async () => {
        const img = await pickImage([4, 3]);
        if (!img) return;
        const path = await uploadUserImage({ bucket: 'farm-logos', userId, name: 'photo', ...img });
        await save.mutateAsync({ photos: [...farm.photos, path].slice(0, MAX_PHOTOS) });
      },
      t('farmPageEditor.photoAdded'),
    );

  const removePhoto = (path: string) =>
    run(
      'photo',
      () => save.mutateAsync({ photos: farm.photos.filter((p) => p !== path) }),
      t('farmPageEditor.photoRemoved'),
    );

  const website_ = website.trim();
  const websiteInvalid = website_ !== '' && !/^https?:\/\/\S+$/i.test(website_);
  const saveText = () =>
    run(
      'text',
      () =>
        save.mutateAsync({
          website: website_ || null,
          accommodation_details: accommodation.trim(),
        }),
      t('farmPageEditor.saved'),
    );

  const logo = farmImageUrl(farm.logo_path);
  return (
    <Section title={t('farmPageEditor.title')}>
      <Text variant="bodyMedium" style={styles.muted}>
        {t('farmPageEditor.intro')}
      </Text>
      <View style={styles.logoRow}>
        <Pressable
          onPress={changeLogo}
          accessibilityRole="button"
          accessibilityLabel={t('farmPageEditor.changeLogoLabel')}
        >
          {logo ? (
            <Image source={{ uri: logo }} style={styles.logo} contentFit="cover" />
          ) : (
            <Avatar.Text size={72} label={initials(farm.business_name)} />
          )}
        </Pressable>
        <Button mode="outlined" icon="image" loading={busy === 'logo'} disabled={!!busy} onPress={changeLogo}>
          {logo ? t('farmPageEditor.changeLogo') : t('farmPageEditor.addLogo')}
        </Button>
      </View>

      <Text variant="titleMedium">
        {t('farmPageEditor.photos', { count: farm.photos.length, max: MAX_PHOTOS })}
      </Text>
      <ScrollView horizontal contentContainerStyle={styles.photos} showsHorizontalScrollIndicator={false}>
        {farm.photos.map((p) => (
          <View key={p}>
            <Image source={{ uri: farmImageUrl(p)! }} style={styles.photo} contentFit="cover" />
            <IconButton
              icon="close"
              mode="contained"
              size={18}
              style={styles.remove}
              disabled={!!busy}
              onPress={() => removePhoto(p)}
              accessibilityLabel={t('farmPageEditor.removePhoto')}
            />
          </View>
        ))}
        {farm.photos.length < MAX_PHOTOS ? (
          <Pressable
            onPress={addPhoto}
            disabled={!!busy}
            style={[styles.photo, styles.add]}
            accessibilityRole="button"
            accessibilityLabel={t('farmPageEditor.addPhoto')}
          >
            <Icon source="plus" size={32} color="#17482F" />
            <Text>{busy === 'photo' ? t('farmPageEditor.uploading') : t('farmPageEditor.addPhoto')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <TextInput
        mode="outlined"
        label={t('farmPageEditor.website')}
        accessibilityLabel={t('farmPageEditor.websiteLabel')}
        placeholder={t('farmPageEditor.websitePlaceholder')}
        value={website}
        onChangeText={setWebsite}
        autoCapitalize="none"
        keyboardType="url"
        error={websiteInvalid}
      />
      <HelperText type="error" visible={websiteInvalid}>
        {t('farmPageEditor.websiteError')}
      </HelperText>
      <TextInput
        mode="outlined"
        label={t('farmPageEditor.accommodation')}
        accessibilityLabel={t('farmPageEditor.accommodationLabel')}
        placeholder={t('farmPageEditor.accommodationPlaceholder')}
        value={accommodation}
        onChangeText={setAccommodation}
        multiline
        numberOfLines={3}
        maxLength={1000}
      />
      <HelperText type="error" visible={!!error}>
        {error}
      </HelperText>
      <Button
        mode="contained"
        contentStyle={styles.tall}
        loading={busy === 'text'}
        disabled={!!busy || websiteInvalid}
        onPress={saveText}
      >
        {t('farmPageEditor.save')}
      </Button>
    </Section>
  );
}

const styles = StyleSheet.create({
  muted: { opacity: 0.75 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  logo: { width: 72, height: 72, borderRadius: 36 },
  photos: { gap: 8, paddingVertical: 4 },
  photo: { width: 128, height: 96, borderRadius: 10 },
  remove: { position: 'absolute', top: -4, right: -4, margin: 0 },
  add: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#17482F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tall: { minHeight: MIN_TAP },
});
