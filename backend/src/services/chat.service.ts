import { AccountRole, Conversation, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError } from "../utils/app-error";
import { getPetPhotoUrl } from "./storage.service";
import { listConversationsSchema, listMessagesSchema, openConversationSchema, sendMessageSchema } from "../validation/chat.schemas";

const missing = () => new AppError(404, "Nie znaleziono rozmowy.", "CONVERSATION_NOT_FOUND");
const participantWhere = (id: string): Prisma.ConversationWhereInput => ({ OR: [{ firstAccountId: id }, { secondAccountId: id }] });
const participantSelect = {
  id: true, role: true, blockedAt: true, deactivatedAt: true, emailVerifiedAt: true,
  userProfile: { select: { fullName: true, photoKey: true } }, sitterProfile: { select: { photoKey: true } }
} as const;
const messageSelect = { id: true, conversationId: true, senderAccountId: true, clientMessageId: true, sequence: true, text: true, createdAt: true } as const;
const conversationInclude = {
  first: { select: participantSelect }, second: { select: participantSelect },
  messages: { orderBy: { sequence: "desc" as const }, take: 1, select: messageSelect }
};
type ConversationDetails = Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>;

function requireUser(role: AccountRole) {
  if (role !== "USER") throw new AppError(403, "Czat jest dostępny dla właścicieli i opiekunów.", "FORBIDDEN");
}
function readSequence(conversation: Conversation, accountId: string) {
  return conversation.firstAccountId === accountId ? conversation.firstReadSequence : conversation.secondReadSequence;
}
const available = (account: ConversationDetails["first"]) => account.role === "USER" && !account.blockedAt && !account.deactivatedAt && Boolean(account.emailVerifiedAt);

async function unreadFor(conversation: Conversation, accountId: string, client: Prisma.TransactionClient = prisma) {
  return client.chatMessage.count({ where: { conversationId: conversation.id, senderAccountId: { not: accountId }, sequence: { gt: readSequence(conversation, accountId) } } });
}
async function toConversation(conversation: ConversationDetails, accountId: string) {
  const mine = conversation.firstAccountId === accountId ? conversation.first : conversation.second;
  const other = conversation.firstAccountId === accountId ? conversation.second : conversation.first;
  return {
    id: conversation.id, myAccountId: accountId,
    otherParticipant: { id: other.id, displayName: other.userProfile?.fullName ?? "Użytkownik Pupply",
      photoUrl: await getPetPhotoUrl(other.userProfile?.photoKey ?? other.sitterProfile?.photoKey ?? null).catch(() => null), isAvailable: available(other) },
    canSend: available(mine) && available(other), createdAt: conversation.createdAt, lastActivityAt: conversation.lastActivityAt,
    lastSequence: conversation.lastSequence, readSequence: readSequence(conversation, accountId),
    lastMessage: conversation.messages[0] ?? null, unreadCount: await unreadFor(conversation, accountId)
  };
}

async function findConversation(accountId: string, conversationId: string, client: Prisma.TransactionClient = prisma) {
  const conversation = await client.conversation.findFirst({ where: { id: conversationId, ...participantWhere(accountId) } });
  if (!conversation) throw missing();
  return conversation;
}
async function lockConversation(accountId: string, conversationId: string, tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Conversation" WHERE id = ${conversationId}
    AND ("firstAccountId" = ${accountId} OR "secondAccountId" = ${accountId}) FOR UPDATE`;
  if (!rows.length) throw missing();
  return findConversation(accountId, conversationId, tx);
}

async function lockAvailableParticipants(first: string, second: string, tx: Prisma.TransactionClient) {
  const accounts = await tx.$queryRaw<{ role: AccountRole; blockedAt: Date | null; deactivatedAt: Date | null; emailVerifiedAt: Date | null }[]>`
    SELECT role, "blockedAt", "deactivatedAt", "emailVerifiedAt" FROM "Account"
    WHERE id IN (${first}, ${second}) ORDER BY id COLLATE "C" FOR SHARE`;
  if (accounts.length !== 2 || accounts.some(account => account.role !== "USER" || account.blockedAt || account.deactivatedAt))
    throw new AppError(403, "Uczestnik rozmowy jest niedostępny.", "CHAT_UNAVAILABLE");
  if (accounts.some(account => !account.emailVerifiedAt))
    throw new AppError(403, "Wysyłanie wiadomości wymaga potwierdzonego adresu e-mail obu uczestników.", "EMAIL_NOT_VERIFIED");
}

export async function openConversation(accountId: string, role: AccountRole, input: z.infer<typeof openConversationSchema>) {
  requireUser(role);
  const id = await prisma.$transaction(async tx => {
    let recipientId: string;
    if ("bookingId" in input) {
      const booking = await tx.booking.findFirst({ where: { id: input.bookingId, OR: [{ ownerAccountId: accountId }, { sitterAccountId: accountId }] },
        select: { ownerAccountId: true, sitterAccountId: true } });
      if (!booking) throw new AppError(404, "Nie znaleziono rezerwacji.", "BOOKING_NOT_FOUND");
      recipientId = booking.ownerAccountId === accountId ? booking.sitterAccountId : booking.ownerAccountId;
    } else {
      const sitter = await tx.sitterProfile.findFirst({ where: { id: input.sitterProfileId, isActive: true,
        account: { role: "USER", blockedAt: null, deactivatedAt: null, emailVerifiedAt: { not: null } } }, select: { accountId: true } });
      if (!sitter) throw new AppError(404, "Opiekun jest niedostępny.", "SITTER_NOT_FOUND");
      recipientId = sitter.accountId;
    }
    if (recipientId === accountId) throw new AppError(409, "Nie możesz rozpocząć rozmowy ze sobą.", "SELF_CHAT_NOT_ALLOWED");
    const [firstAccountId, secondAccountId] = [accountId, recipientId].sort();
    await lockAvailableParticipants(firstAccountId, secondAccountId, tx);
    await tx.conversation.createMany({ data: [{ firstAccountId, secondAccountId }], skipDuplicates: true });
    return (await tx.conversation.findUniqueOrThrow({ where: { firstAccountId_secondAccountId: { firstAccountId, secondAccountId } }, select: { id: true } })).id;
  });
  return getConversation(accountId, role, id);
}

export async function getConversation(accountId: string, role: AccountRole, conversationId: string) {
  requireUser(role);
  const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, ...participantWhere(accountId) }, include: conversationInclude });
  if (!conversation) throw missing();
  return toConversation(conversation, accountId);
}

export async function listConversations(accountId: string, role: AccountRole, input: z.infer<typeof listConversationsSchema>) {
  requireUser(role);
  let boundary: Prisma.ConversationWhereInput = {};
  if (input.cursor) {
    try {
      const cursor = z.object({ id: z.string().min(1).max(100), at: z.iso.datetime() }).parse(JSON.parse(Buffer.from(input.cursor, "base64url").toString()));
      boundary = { OR: [{ lastActivityAt: { lt: new Date(cursor.at) } }, { lastActivityAt: new Date(cursor.at), id: { lt: cursor.id } }] };
    } catch { throw new AppError(400, "Nieprawidłowy kursor rozmów.", "INVALID_CURSOR"); }
  }
  const rows = await prisma.conversation.findMany({ where: { AND: [participantWhere(accountId), boundary] },
    orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }], take: input.limit + 1, include: conversationInclude });
  const page = rows.slice(0, input.limit), last = page.at(-1);
  return { items: await Promise.all(page.map(row => toConversation(row, accountId))),
    nextCursor: rows.length > input.limit && last ? Buffer.from(JSON.stringify({ id: last.id, at: last.lastActivityAt.toISOString() })).toString("base64url") : null };
}

export async function listMessages(accountId: string, role: AccountRole, conversationId: string, input: z.infer<typeof listMessagesSchema>) {
  requireUser(role);
  const conversation = await findConversation(accountId, conversationId);
  const forward = input.after !== undefined;
  const rows = await prisma.chatMessage.findMany({ where: { conversationId,
    sequence: { lte: conversation.lastSequence, ...(forward ? { gt: input.after } : input.before !== undefined ? { lt: input.before } : {}) } },
    orderBy: { sequence: forward ? "asc" : "desc" }, take: input.limit + 1, select: messageSelect });
  const items = rows.slice(0, input.limit);
  if (!forward) items.reverse();
  return { items, hasMore: rows.length > input.limit, latestSequence: conversation.lastSequence,
    nextBefore: items.length && items[0].sequence > 1 ? items[0].sequence : null,
    nextAfter: items.at(-1)?.sequence ?? input.after ?? 0 };
}

export async function sendMessage(accountId: string, role: AccountRole, conversationId: string, input: z.infer<typeof sendMessageSchema>) {
  requireUser(role);
  return prisma.$transaction(async tx => {
    const initial = await findConversation(accountId, conversationId, tx);
    await lockAvailableParticipants(initial.firstAccountId, initial.secondAccountId, tx);
    const conversation = await lockConversation(accountId, conversationId, tx);
    const existing = await tx.chatMessage.findUnique({ where: { conversationId_senderAccountId_clientMessageId: {
      conversationId, senderAccountId: accountId, clientMessageId: input.clientMessageId
    } }, select: messageSelect });
    if (existing) {
      if (existing.text !== input.text) throw new AppError(409, "Identyfikator wysyłki został już użyty dla innej wiadomości.", "MESSAGE_KEY_REUSED");
      return existing;
    }
    const updated = await tx.conversation.update({ where: { id: conversationId }, data: { lastSequence: { increment: 1 }, lastActivityAt: new Date() } });
    const message = await tx.chatMessage.create({ data: { conversationId, senderAccountId: accountId,
      clientMessageId: input.clientMessageId, text: input.text, sequence: updated.lastSequence }, select: messageSelect });
    await tx.notification.create({ data: { accountId: conversation.firstAccountId === accountId ? conversation.secondAccountId : conversation.firstAccountId,
      type: "NEW_MESSAGE", conversationId, chatMessageId: message.id, title: "Nowa wiadomość", message: "Masz nową wiadomość w czacie." } });
    return message;
  });
}

export async function markConversationRead(accountId: string, role: AccountRole, conversationId: string, throughSequence: number) {
  requireUser(role);
  return prisma.$transaction(async tx => {
    const conversation = await lockConversation(accountId, conversationId, tx);
    if (throughSequence > conversation.lastSequence) throw new AppError(400, "Wiadomość nie istnieje w tej rozmowie.", "INVALID_READ_SEQUENCE");
    const sequence = Math.max(readSequence(conversation, accountId), throughSequence);
    const updated = await tx.conversation.update({ where: { id: conversationId }, data: conversation.firstAccountId === accountId
      ? { firstReadSequence: sequence } : { secondReadSequence: sequence } });
    await tx.notification.updateMany({ where: { accountId, conversationId, type: "NEW_MESSAGE", readAt: null,
      chatMessage: { sequence: { lte: sequence } } }, data: { readAt: new Date() } });
    return { readSequence: sequence, unreadCount: await unreadFor(updated, accountId, tx) };
  });
}

export async function unreadMessageCount(accountId: string, role: AccountRole) {
  requireUser(role);
  const [row] = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) AS count FROM "ChatMessage" m
    JOIN "Conversation" c ON c.id = m."conversationId"
    WHERE m."senderAccountId" <> ${accountId} AND (
      (c."firstAccountId" = ${accountId} AND m.sequence > c."firstReadSequence") OR
      (c."secondAccountId" = ${accountId} AND m.sequence > c."secondReadSequence")
    )`;
  return Number(row.count);
}
