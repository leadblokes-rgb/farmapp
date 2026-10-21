import { Tabs } from 'expo-router';
import { tabIcon as icon, tabScreenOptions } from '@/components/tabOptions';
import { RequireSession } from '@/providers/AuthProvider';

export default function FarmTabs() {
  return (
    <RequireSession>
      <Tabs screenOptions={tabScreenOptions}>
        <Tabs.Screen name="index" options={{ title: 'Jobs', tabBarIcon: icon('briefcase') }} />
        <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: icon('chat') }} />
        <Tabs.Screen name="profile" options={{ title: 'Farm', tabBarIcon: icon('barn') }} />
      </Tabs>
    </RequireSession>
  );
}
