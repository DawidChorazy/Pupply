ALTER TYPE "NotificationType" ADD VALUE 'NEW_MESSAGE';

CREATE TABLE "Conversation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "firstAccountId" TEXT NOT NULL REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "secondAccountId" TEXT NOT NULL REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "firstReadSequence" INTEGER NOT NULL DEFAULT 0,
  "secondReadSequence" INTEGER NOT NULL DEFAULT 0,
  "lastSequence" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Conversation_distinct_ordered_participants" CHECK ("firstAccountId" COLLATE "C" < "secondAccountId" COLLATE "C"),
  CONSTRAINT "Conversation_read_bounds" CHECK (
    "lastSequence" >= 0 AND "firstReadSequence" BETWEEN 0 AND "lastSequence"
    AND "secondReadSequence" BETWEEN 0 AND "lastSequence"
  )
);
CREATE UNIQUE INDEX "Conversation_firstAccountId_secondAccountId_key" ON "Conversation"("firstAccountId", "secondAccountId");
CREATE INDEX "Conversation_firstAccountId_lastActivityAt_id_idx" ON "Conversation"("firstAccountId", "lastActivityAt", "id");
CREATE INDEX "Conversation_secondAccountId_lastActivityAt_id_idx" ON "Conversation"("secondAccountId", "lastActivityAt", "id");

CREATE TABLE "ChatMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "senderAccountId" TEXT NOT NULL REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "clientMessageId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL CHECK ("sequence" > 0),
  "text" TEXT NOT NULL CHECK (length(btrim("text")) BETWEEN 1 AND 4000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ChatMessage_conversationId_sequence_key" ON "ChatMessage"("conversationId", "sequence");
CREATE UNIQUE INDEX "ChatMessage_conversationId_senderAccountId_clientMessageId_key" ON "ChatMessage"("conversationId", "senderAccountId", "clientMessageId");

ALTER TABLE "Notification"
  ADD COLUMN "conversationId" TEXT REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD COLUMN "chatMessageId" TEXT REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Notification_chatMessageId_key" ON "Notification"("chatMessageId");
CREATE INDEX "Notification_conversationId_accountId_idx" ON "Notification"("conversationId", "accountId");
