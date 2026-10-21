import { Tabs } from 'expo-router';
import { tabIcon as icon, tabScreenOptions } from '@/components/tabOptions';
import { useUnreadCount } from '@/features/chat/api';

export default function WorkerTabs() {
  const unread = useUnreadCount();
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="index" options={{ title: 'Discover', tabBarIcon: icon('cards') }} />
      <Tabs.Screen
        name="matches"
        options={{ tabBarBadge: unread || undefined, title: 'Matches', tabBarIcon: icon('chat') }}
      />
      <Tabs.Screen name="days" options={{ title: 'Days', tabBarIcon: icon('calendar-check') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('account') }} />
    </Tabs>
  );
}
