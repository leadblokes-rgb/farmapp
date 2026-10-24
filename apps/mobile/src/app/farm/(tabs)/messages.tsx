import { ConversationList } from '@/features/chat/ConversationList';
import { t } from '@/i18n';

export default function Messages() {
  return <ConversationList basePath="/farm/chat" emptyText={t('chat.farmEmpty')} />;
}
