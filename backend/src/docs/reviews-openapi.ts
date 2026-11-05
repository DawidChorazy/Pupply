const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const response = (description: string, schema: object) => ({ description, content: { "application/json": { schema } } });
const errors = Object.fromEntries([400, 401, 403, 404, 409, 429, 500].map(code => [String(code), response("Request rejected", ref("Error"))]));
const score = { type: "integer", minimum: 1, maximum: 5 };
const criteria = { punctuality: score, communication: score, quality: score };
const reviewProperties = { id: { type: "string" }, ...criteria, comment: { type: "string", nullable: true, maxLength: 2000 }, createdAt: { type: "string", format: "date-time" } };
const average = { type: "number", minimum: 1, maximum: 5, nullable: true };

export const reviewPaths = {
  "/api/bookings/{bookingId}/review": { post: {
    tags: ["Reviews"], security: [{ bearerAuth: [] }], summary: "Publish a walker review after a completed walk",
    description: "Only the active, email-verified booking owner may review a completed DOG_WALK whose end time has passed. One immutable review per booking. All three integer criteria are required; text is optional and trimmed. Repeating the same content returns the original review (201), including concurrent retries. Different content returns 409 REVIEW_ALREADY_EXISTS. Limit: 10 attempts per account per minute. Author and sitter IDs are derived from the booking.",
    parameters: [{ name: "bookingId", in: "path", required: true, schema: { type: "string" } }],
    requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: false,
      required: ["punctuality", "communication", "quality"], properties: { ...criteria, comment: { type: "string", maxLength: 2000 } } } } } },
    responses: { "201": response("Created or replayed review", { type: "object", required: ["review"], properties: { review: ref("SitterReview") } }), ...errors }
  } },
  "/api/sitters/{profileId}/reviews": { get: {
    tags: ["Reviews"], security: [], summary: "Public walker reviews and aggregate ratings",
    description: "Newest first, ordered by createdAt and ID. Paused offers retain their reviews; blocked, deactivated or unverified sitters are unavailable. Authors are shown by first name and last initial, or anonymized when inactive. No booking, pet, email or account IDs are exposed in review items. Rating averages use all three criteria, rounded to two decimals; no reviews means null averages. completedWalkCount counts completed DOG_WALK bookings, independently of reviews. Limit: 60 requests per IP per minute.",
    parameters: [{ name: "profileId", in: "path", required: true, schema: { type: "string" } },
      { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } },
      { name: "cursor", in: "query", schema: { type: "string", maxLength: 400 }, description: "nextCursor from the previous page." }],
    responses: { "200": response("Public review page", ref("SitterReviewPage")), ...errors }
  } }
};
export const reviewSchemas = {
  SitterReview: { type: "object", required: ["id", "punctuality", "communication", "quality", "comment", "createdAt"], properties: {
    ...reviewProperties, bookingId: { type: "string" }, authorAccountId: { type: "string" }, sitterAccountId: { type: "string" }
  } },
  PublicSitterReview: { type: "object", additionalProperties: false, required: [...Object.keys(reviewProperties), "rating", "authorName"], properties: {
    ...reviewProperties, rating: { type: "number", minimum: 1, maximum: 5 }, authorName: { type: "string" }
  } },
  ReviewSummary: { type: "object", required: ["reviewCount", "averageRating", "averagePunctuality", "averageCommunication", "averageQuality", "completedWalkCount"], properties: {
    reviewCount: { type: "integer", minimum: 0 }, averageRating: average, averagePunctuality: average,
    averageCommunication: average, averageQuality: average, completedWalkCount: { type: "integer", minimum: 0 }
  } },
  SitterReviewPage: { type: "object", required: ["sitter", "summary", "items", "nextCursor"], properties: {
    sitter: { type: "object", properties: { id: { type: "string" }, displayName: { type: "string" }, city: { type: "string" }, photoUrl: { type: "string", format: "uri", nullable: true } } },
    summary: ref("ReviewSummary"), items: { type: "array", items: ref("PublicSitterReview") }, nextCursor: { type: "string", nullable: true }
  } }
};
