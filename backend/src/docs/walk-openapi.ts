const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ content: { "application/json": { schema } } });
const responses = { "400": { $ref: "#/components/responses/ValidationError" }, "401": { $ref: "#/components/responses/Unauthorized" },
  "403": { $ref: "#/components/responses/Forbidden" }, "404": { $ref: "#/components/responses/NotFound" }, "409": { $ref: "#/components/responses/Conflict" }, "429": { $ref: "#/components/responses/RateLimited" } };
const common = { tags: ["Walk GPS"], security: [{ bearerAuth: [] }], parameters: [{ name: "bookingId", in: "path", required: true, schema: { type: "string" } }] };
const point = { clientPointId: { type: "string", format: "uuid" }, latitude: { type: "number", minimum: -90, maximum: 90 },
  longitude: { type: "number", minimum: -180, maximum: 180 }, accuracy: { type: "number", minimum: 0, maximum: 100 }, capturedAt: { type: "string", format: "date-time" } };
const sessionResponse = { description: "Session (idempotent)", ...json({ type: "object", required: ["session"], properties: { session: ref("WalkSession") } }) };
export const walkPaths = {
  "/api/bookings/{bookingId}/walk": { get: {
    ...common, summary: "Participant-only route and actual walk summary",
    description: "Private; Cache-Control: no-store. Returns null session before the first start. Sequence cursor, 500 points per page. nextAfter is non-null only if more points remain; poll after the last received sequence for new positions. The session snapshot contains total distance and lastSequence. Limit: 120 requests/account/minute shared with walk writes. No route is returned by public sitter endpoints.",
    parameters: [...common.parameters, { name: "after", in: "query", schema: { type: "integer", minimum: 0, maximum: 20000, default: 0 } }],
    responses: { "200": { description: "Private route page", ...json({ type: "object", required: ["session", "points", "nextAfter", "bookingStatus"], properties: {
      session: { allOf: [ref("WalkSession")], nullable: true }, points: { type: "array", items: ref("WalkPoint") }, nextAfter: { type: "integer", nullable: true }, bookingStatus: { type: "string" }, paymentConfirmed: { type: "boolean" }
    } }) }, ...responses }
  } },
  "/api/bookings/{bookingId}/walk/start": { post: {
    ...common, summary: "Sitter starts an accepted DOG_WALK",
    description: "Active email-verified sitter only, 15 minutes before planned start through 2 hours after planned end. New positive-price bookings require a confirmed PayU payment before starting (PAYMENT_REQUIRED on 409); free and grandfathered bookings are exempt. Server records actual start time even when GPS is unavailable. One active walk per sitter, enforced in the database. Concurrent start retries return the same session and send WALK_STARTED once. A closed walk cannot be restarted.", responses: { "200": sessionResponse, ...responses }
  } },
  "/api/bookings/{bookingId}/walk/points": { post: {
    ...common, summary: "Sitter uploads 1–100 GPS samples atomically",
    description: "Only an active accepted walk, at most 20000 unique points. Supply UUID clientPointId and reuse it on retries; identical replay succeeds even after completion, changed payload returns POINT_ID_REUSED (409). New samples must follow saved timestamps, be no earlier than 10 seconds before actual start and no later than 30 seconds in the future. Batches are sorted by capturedAt. Invalid batches save nothing. Accuracy must be at most 100 m. Distance is calculated on the server (Haversine); gaps over 120 seconds or speed over 12 m/s start a separate segment and add no distance. Distance accumulates from a stable anchor once displacement reaches max(3 m, half the smaller accuracy); small consecutive steps are preserved across batches while stationary jitter is excluded. Offline points can be retried while the walk is active.",
    requestBody: { required: true, ...json({ type: "object", additionalProperties: false, required: ["points"], properties: { points: { type: "array", minItems: 1, maxItems: 100, items: ref("WalkPointInput") } } }) },
    responses: { "200": { description: "Saved or replayed samples", ...json({ type: "object", properties: { acceptedIds: { type: "array", items: { type: "string", format: "uuid" } }, session: ref("WalkSession") } }) }, ...responses }
  } },
  "/api/bookings/{bookingId}/walk/finish": { post: {
    ...common, summary: "Sitter stops a walk and completes its booking atomically",
    description: "Upload pending samples before finishing. Optional endedAt preserves the time the sitter stopped recording while offline; it must be no earlier than start or the last saved sample, and at most 30 seconds in the future. Without endedAt the server uses its clock, bounded by the last sample. The planned booking end does not change. Sends BOOKING_COMPLETED once. Idempotent; retries preserve the first saved end and a cancelled walk remains cancelled. No new points after closure. Cancelling the booking or deactivating a participant closes the walk with CANCELLED and retains its previous route. Legacy status completion is refused while a GPS walk is active.",
    requestBody: { required: false, ...json({ type: "object", additionalProperties: false, properties: { endedAt: { type: "string", format: "date-time" } } }) },
    responses: { "200": sessionResponse, ...responses }
  } }
};
export const walkSchemas = {
  WalkPointInput: { type: "object", additionalProperties: false, required: Object.keys(point), properties: point },
  WalkPoint: { type: "object", required: [...Object.keys(point), "sequence", "segmentStart"], properties: { ...point, sequence: { type: "integer", minimum: 1 }, segmentStart: { type: "boolean" } } },
  WalkSession: { type: "object", required: ["id", "bookingId", "sitterAccountId", "startedAt", "endedAt", "endReason", "distanceMeters", "lastSequence"], properties: {
    id: { type: "string" }, bookingId: { type: "string" }, sitterAccountId: { type: "string" }, startedAt: { type: "string", format: "date-time" },
    endedAt: { type: "string", format: "date-time", nullable: true }, endReason: { type: "string", enum: ["COMPLETED", "CANCELLED"], nullable: true },
    distanceMeters: { type: "number", minimum: 0 }, lastSequence: { type: "integer", minimum: 0, maximum: 20000 }
  } }
};
