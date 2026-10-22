import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabNavigationOptions } from 'expo-router/tabs';
import type { ColorValue } from 'react-native';
import { theme } from '@/theme';

// Tall tab bar with large labels for outdoor, one-handed use.
export const tabScreenOptions: BottomTabNavigationOptions = {
  tabBarActiveTintColor: theme.colors.primary,
  tabBarInactiveTintColor: '#444444',
  tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
  tabBarStyle: { minHeight: 64 },
  tabBarIconStyle: { marginTop: 4 },
  headerTitleStyle: { fontSize: 20, fontWeight: '700' },
};

export function tabIcon(name: keyof typeof MaterialCommunityIcons.glyphMap) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <MaterialCommunityIcons name={name} color={color as string} size={size} />;
  };
}
