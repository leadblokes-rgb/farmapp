import { ConversationList } from '@/features/chat/ConversationList';

export default function Messages() {
  return (
    <ConversationList
      basePath="/farm/chat"
      emptyText="No conversations yet. Message an applicant from your shortlist, or accept them to start a chat."
    />
  );
}
