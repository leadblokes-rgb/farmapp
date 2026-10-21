import { Tabs } from 'expo-router';
import { tabIcon as icon, tabScreenOptions } from '@/components/tabOptions';

export default function FarmTabs() {
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="index" options={{ title: 'Jobs', tabBarIcon: icon('briefcase') }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: icon('chat') }} />
      <Tabs.Screen name="profile" options={{ title: 'Farm', tabBarIcon: icon('barn') }} />
    </Tabs>
  );
}
