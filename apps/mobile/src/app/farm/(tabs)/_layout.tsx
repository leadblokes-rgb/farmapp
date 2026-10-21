import { Tabs } from 'expo-router';
import { tabIcon as icon, tabScreenOptions } from '@/components/tabOptions';
import { useUnreadCount } from '@/features/chat/api';

export default function FarmTabs() {
  const unread = useUnreadCount();
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="index" options={{ title: 'Jobs', tabBarIcon: icon('briefcase') }} />
      <Tabs.Screen
        name="messages"
        options={{ tabBarBadge: unread || undefined, title: 'Messages', tabBarIcon: icon('chat') }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Farm', tabBarIcon: icon('barn') }} />
    </Tabs>
  );
}
