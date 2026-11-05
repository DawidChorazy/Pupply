export interface ChatMessage {
  id: string;
  conversationId: string;
  senderAccountId: string;
  clientMessageId: string;
  sequence: number;
  text: string;
  createdAt: string;
}
export interface Conversation {
  id: string;
  myAccountId: string;
  otherParticipant: { id: string; displayName: string; photoUrl: string | null; isAvailable: boolean };
  canSend: boolean;
  createdAt: string;
  lastActivityAt: string;
  lastSequence: number;
  readSequence: number;
  lastMessage: ChatMessage | null;
  unreadCount: number;
}
export interface ConversationPage { items: Conversation[]; nextCursor: string | null }
export interface MessagePage { items: ChatMessage[]; nextBefore: number | null; nextAfter: number; hasMore: boolean; latestSequence: number }
