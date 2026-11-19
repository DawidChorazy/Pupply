const bearer = [{ bearerAuth: [] }];
const id = (name: string) => ({ name, in: "path", required: true, schema: { type: "string" } });
const json = (schema: object) => ({ content: { "application/json": { schema } } });
const body = (schema: object) => ({ required: true, ...json(schema) });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const errors = Object.fromEntries([400, 401, 403, 404, 409, 429].map(status => [status, { description: "Request rejected", ...json(ref("Error")) }]));
const envelope = { type: "object", properties: { issue: { allOf: [ref("BookingIssue")], nullable: true } } };
export const issuePaths = {
  "/api/bookings/{bookingId}/issue": {
    get: { tags: ["Issues"], security: bearer, parameters: [id("bookingId")], summary: "Owner-only private report, null if none", responses: { "200": { description: "Report", ...json(envelope) }, ...errors } },
    post: { tags: ["Issues"], security: bearer, parameters: [id("bookingId")], summary: "Report a service problem; identical retries return the same report",
      description: "Verified owner only. Available for cancelled/completed services or accepted bookings from their start time. One report per booking; differing retries return 409. Private to owner and administrator. Does not initiate a refund or change the booking status. 10 requests/account/minute. No-store.",
      requestBody: body({ type: "object", additionalProperties: false, required: ["category", "description"], properties: { category: ref("BookingIssueCategory"), description: { type: "string", minLength: 10, maxLength: 4000 } } }),
      responses: { "201": { description: "Created or replayed", ...json(envelope) }, ...errors } }
  },
  "/api/admin/issues": { get: { tags: ["Issues"], security: bearer, summary: "Administrator report queue, oldest first, 20 items/page", parameters: [
    { name: "status", in: "query", schema: ref("BookingIssueStatus") }, { name: "page", in: "query", schema: { type: "integer", minimum: 1, maximum: 100000, default: 1 } }],
    responses: { "200": { description: "Private queue with participant contact emails", ...json({ type: "object", properties: { items: { type: "array", items: ref("BookingIssue") }, pagination: ref("Pagination") } }) }, ...errors } } },
  "/api/admin/issues/{issueId}": { patch: { tags: ["Issues"], security: bearer, parameters: [id("issueId")], summary: "Versioned and audited report decision",
    description: "Only OPEN/IN_REVIEW reports may change. Current version required; stale and terminal reports return 409. Sends an in-app notification to the owner. Does not execute financial adjustments.",
    requestBody: body({ type: "object", additionalProperties: false, required: ["version", "status", "resolution"], properties: { version: { type: "integer", minimum: 1 }, status: { type: "string", enum: ["IN_REVIEW", "RESOLVED", "REJECTED"] }, resolution: { type: "string", minLength: 10, maxLength: 2000 } } }),
    responses: { "200": { description: "Updated", ...json(envelope) }, ...errors } } }
};
export const issueSchemas = {
  BookingIssueCategory: { type: "string", enum: ["NO_SHOW", "EARLY_FINISH", "PET_SAFETY", "OTHER"] },
  BookingIssueStatus: { type: "string", enum: ["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"] },
  BookingIssue: { type: "object", required: ["id", "bookingId", "category", "description", "status", "version"], properties: {
    id: { type: "string" }, bookingId: { type: "string" }, category: ref("BookingIssueCategory"), description: { type: "string" }, status: ref("BookingIssueStatus"),
    version: { type: "integer" }, resolution: { type: "string", nullable: true }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }
  } }
};
