const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const content = (schema: object) => ({ "application/json": { schema } });
const body = (schema: object) => ({ required: true, content: content(schema) });
const response = (description: string, schema: object) => ({ description, content: content(schema) });
const security = [{ bearerAuth: [] }];
const errors = Object.fromEntries([["400", "ValidationError"], ["401", "Unauthorized"], ["403", "Forbidden"], ["404", "NotFound"], ["409", "Conflict"], ["429", "RateLimited"], ["500", "InternalError"]]
  .map(([code, name]) => [code, { $ref: `#/components/responses/${name}` }]));
const id = { name: "conversationId", in: "path", required: true, schema: { type: "string", minLength: 1, maxLength: 100 } };
const integer = { type: "integer", minimum: 0 };
const date = { type: "string", format: "date-time" };
const string = { type: "string" };

export const chatPaths = {
  "/api/conversations": {
    get: { tags: ["Chat"], security, summary: "List own conversations, latest activity first",
      parameters: [{ name: "cursor", in: "query", schema: { type: "string", maxLength: 400 } }, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } }],
      responses: { "200": response("Conversation page", { type: "object", required: ["items", "nextCursor"], properties: {
        items: { type: "array", items: ref("Conversation") }, nextCursor: { type: "string", nullable: true }
      } }), ...errors } },
    post: { tags: ["Chat"], security, summary: "Open or reuse the conversation with a sitter or booking participant",
      description: "One conversation per unordered account pair. No accepted booking is required. Both accounts must be active USER accounts with confirmed emails. A public contact must target an active sitter; a booking contact must be a participant in that booking. Self-contact is rejected. Limit: 10 attempts/account/minute.",
      requestBody: body({ oneOf: [
        { type: "object", additionalProperties: false, required: ["sitterProfileId"], properties: { sitterProfileId: string } },
        { type: "object", additionalProperties: false, required: ["bookingId"], properties: { bookingId: string } }
      ] }), responses: { "200": response("Existing or new conversation", ref("ConversationEnvelope")), ...errors } }
  },
  "/api/conversations/unread-count": { get: { tags: ["Chat"], security, summary: "Count own incoming unread messages",
    responses: { "200": response("Unread message count", { type: "object", required: ["count"], properties: { count: integer } }), ...errors } } },
  "/api/conversations/{conversationId}": { get: { tags: ["Chat"], security, parameters: [id], summary: "Get conversation metadata (participants only)",
    responses: { "200": response("Conversation", ref("ConversationEnvelope")), ...errors } } },
  "/api/conversations/{conversationId}/messages": {
    get: { tags: ["Chat"], security, summary: "Read message history or messages newer than a sequence", parameters: [id,
      { name: "before", in: "query", schema: { type: "integer", minimum: 1 } }, { name: "after", in: "query", schema: integer },
      { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } }],
      description: "Do not combine before and after. Default/before returns the latest older page; after returns the earliest newer page. Items are always ordered by ascending conversation sequence. Poll after=nextAfter while the screen is visible. hasMore indicates more records in the requested direction. Fetch remaining forward pages before advancing a read marker beyond the displayed messages.",
      responses: { "200": response("Messages", ref("MessagePage")), ...errors } },
    post: { tags: ["Chat"], security, parameters: [id], summary: "Send a text message idempotently",
      description: "Limit: 30 attempts/account/minute. Sender comes exclusively from JWT. The UUID is scoped to conversation and sender; a repeated UUID with the same trimmed text replays the original message without another notification. Different text returns 409 MESSAGE_KEY_REUSED. Messages and notifications commit atomically. Active and verified participants are required.",
      requestBody: body({ type: "object", additionalProperties: false, required: ["clientMessageId", "text"], properties: {
        clientMessageId: { type: "string", format: "uuid" }, text: { type: "string", minLength: 1, maxLength: 4000 }
      } }), responses: { "201": response("Sent or replayed message", { type: "object", required: ["message"], properties: { message: ref("ChatMessage") } }), ...errors } }
  },
  "/api/conversations/{conversationId}/read": { patch: { tags: ["Chat"], security, parameters: [id], summary: "Mark displayed messages read through an existing sequence",
    description: "Markers only advance. A sequence beyond the conversation's latest message returns 400. New messages above the marker remain unread. Related in-app notifications are marked read; their unread pushes/emails are skipped when possible. Reading never changes the conversation's activity order.",
    requestBody: body({ type: "object", additionalProperties: false, required: ["throughSequence"], properties: { throughSequence: integer } }),
    responses: { "200": response("Current read marker", { type: "object", required: ["readSequence", "unreadCount"], properties: { readSequence: integer, unreadCount: integer } }), ...errors } } }
};

export const chatSchemas = {
  ChatMessage: { type: "object", required: ["id", "conversationId", "senderAccountId", "clientMessageId", "sequence", "text", "createdAt"], properties: {
    id: string, conversationId: string, senderAccountId: string, clientMessageId: { type: "string", format: "uuid" }, sequence: { type: "integer", minimum: 1 }, text: string, createdAt: date
  } },
  Conversation: { type: "object", required: ["id", "myAccountId", "otherParticipant", "canSend", "createdAt", "lastActivityAt", "lastSequence", "readSequence", "lastMessage", "unreadCount"], properties: {
    id: string, myAccountId: string, otherParticipant: { type: "object", required: ["id", "displayName", "photoUrl", "isAvailable"], properties: {
      id: string, displayName: string, photoUrl: { type: "string", format: "uri", nullable: true }, isAvailable: { type: "boolean" }
    } }, canSend: { type: "boolean" }, createdAt: date, lastActivityAt: date, lastSequence: integer, readSequence: integer,
    lastMessage: { allOf: [ref("ChatMessage")], nullable: true }, unreadCount: integer
  } },
  ConversationEnvelope: { type: "object", required: ["conversation"], properties: { conversation: ref("Conversation") } },
  MessagePage: { type: "object", required: ["items", "nextBefore", "nextAfter", "hasMore", "latestSequence"], properties: {
    items: { type: "array", items: ref("ChatMessage") }, nextBefore: { type: "integer", nullable: true, minimum: 1 }, nextAfter: integer,
    hasMore: { type: "boolean" }, latestSequence: integer
  } }
};
