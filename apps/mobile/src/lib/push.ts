import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Show notifications while the app is open, too (e.g. a new message on another screen).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let currentToken: string | null = null;

/**
 * Asks for permission and stores this device's Expo push token for the signed-in user.
 * Needs a physical device and an EAS project id (run `npx eas-cli init` once; see README).
 * Expo Go on Android doesn't support remote push from SDK 53+, so use a development build.
 */
export async function registerForPush(userId: string): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Croppr',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const status = existing.granted ? 'granted' : (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('Push disabled: no EAS projectId. Run `npx eas-cli init` in apps/mobile.');
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    currentToken = token;
    await supabase.from('push_tokens').upsert({
      expo_token: token,
      user_id: userId,
      platform: Platform.OS as 'ios' | 'android',
      updated_at: new Date().toISOString(),
    });
    return token;
  } catch (e) {
    console.warn('Could not get a push token', e);
    return null;
  }
}

/** Remove this device's token on sign-out so a shared phone stops getting the last user's alerts. */
export async function unregisterPush() {
  if (!currentToken) return;
  await supabase.from('push_tokens').delete().eq('expo_token', currentToken);
  currentToken = null;
}

/** Opens the screen a tapped notification points at (data.url, e.g. "/worker/chat/<id>"). */
export function useNotificationDeepLinks(enabled: boolean) {
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    const open = (response: Notifications.NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as Href);
    };
    Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [enabled]);
}
