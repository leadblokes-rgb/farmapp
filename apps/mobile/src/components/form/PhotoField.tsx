import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Button, Text } from 'react-native-paper';

export interface PickedImage {
  uri: string;
  base64: string;
  mimeType: string;
}

interface Props {
  /** URL of the saved photo (signed URL), if any. */
  currentUrl?: string | null;
  picked: PickedImage | null;
  onPick: (img: PickedImage) => void;
  initials: string;
}

export function PhotoField({ currentUrl, picked, onPick, initials }: Props) {
  async function pick(source: 'library' | 'camera') {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    };
    const result =
      source === 'camera'
        ? await (async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            return perm.granted ? ImagePicker.launchCameraAsync(options) : null;
          })()
        : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result && !result.canceled ? result.assets[0] : null;
    if (asset?.base64)
      onPick({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' });
  }

  const uri = picked?.uri ?? currentUrl ?? null;
  return (
    <View style={styles.row}>
      <Pressable onPress={() => pick('library')} accessibilityLabel="Choose profile photo">
        {uri ? (
          <Image source={{ uri }} style={styles.photo} contentFit="cover" />
        ) : (
          <Avatar.Text size={96} label={initials || '?'} />
        )}
      </Pressable>
      <View style={styles.actions}>
        <Text variant="bodyMedium">A clear photo of your face helps farms recognise you on day one.</Text>
        <Button mode="outlined" icon="image" onPress={() => pick('library')}>
          Choose photo
        </Button>
        <Button mode="text" icon="camera" onPress={() => pick('camera')}>
          Take photo
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  photo: { width: 96, height: 96, borderRadius: 48 },
  actions: { flex: 1, gap: 4 },
});
