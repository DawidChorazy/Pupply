import { authenticatedApiRequest } from "@/shared/api/api-client";
import { ChatMessage, Conversation, ConversationPage, MessagePage } from "../types/chat";

const root = "/conversations";
const conversationPath = (id: string) => `${root}/${encodeURIComponent(id)}`;
async function chatRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try { return await authenticatedApiRequest<T>(path, { ...options, signal: controller.signal }); }
  catch (error) {
    if (controller.signal.aborted) throw new Error("Połączenie z czatem trwa zbyt długo. Spróbuj ponownie.");
    throw error;
  } finally { clearTimeout(timer); }
}
export function openConversation(input: { bookingId: string } | { sitterProfileId: string }) {
  return chatRequest<{ conversation: Conversation }>(root, { method: "POST", body: JSON.stringify(input) });
}
export function listConversations(cursor?: string) {
  return chatRequest<ConversationPage>(`${root}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
}
export function getConversation(id: string) {
  return chatRequest<{ conversation: Conversation }>(conversationPath(id));
}
export function getMessages(id: string, params: { before?: number; after?: number } = {}) {
  const query = new URLSearchParams();
  if (params.before !== undefined) query.set("before", String(params.before));
  if (params.after !== undefined) query.set("after", String(params.after));
  return chatRequest<MessagePage>(`${conversationPath(id)}/messages?${query}`);
}
export function sendMessage(id: string, input: { text: string; clientMessageId: string }) {
  return chatRequest<{ message: ChatMessage }>(`${conversationPath(id)}/messages`, { method: "POST", body: JSON.stringify(input) });
}
export function markConversationRead(id: string, throughSequence: number) {
  return chatRequest<{ readSequence: number; unreadCount: number }>(`${conversationPath(id)}/read`, {
    method: "PATCH", body: JSON.stringify({ throughSequence })
  });
}
export function getUnreadMessageCount() {
  return chatRequest<{ count: number }>(`${root}/unread-count`);
}
