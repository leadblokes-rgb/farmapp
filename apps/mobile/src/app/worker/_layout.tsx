import { Tabs } from 'expo-router';
import { tabIcon as icon, tabScreenOptions } from '@/components/tabOptions';

export default function WorkerTabs() {
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="index" options={{ title: 'Discover', tabBarIcon: icon('cards') }} />
      <Tabs.Screen name="matches" options={{ title: 'Matches', tabBarIcon: icon('chat') }} />
      <Tabs.Screen name="days" options={{ title: 'Days', tabBarIcon: icon('calendar-check') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('account') }} />
    </Tabs>
  );
}
