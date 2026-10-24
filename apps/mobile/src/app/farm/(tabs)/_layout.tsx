import { Tabs } from 'expo-router';
import { tabIcon as icon, tabScreenOptions } from '@/components/tabOptions';
import { useUnreadCount } from '@/features/chat/api';
import { t } from '@/i18n';

export default function FarmTabs() {
  const unread = useUnreadCount();
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="index" options={{ title: t('tabs.jobs'), tabBarIcon: icon('briefcase') }} />
      <Tabs.Screen
        name="messages"
        options={{ tabBarBadge: unread || undefined, title: t('tabs.messages'), tabBarIcon: icon('chat') }}
      />
      <Tabs.Screen name="profile" options={{ title: t('tabs.farm'), tabBarIcon: icon('barn') }} />
    </Tabs>
  );
}
