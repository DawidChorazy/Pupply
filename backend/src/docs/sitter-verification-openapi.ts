const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ content: { "application/json": { schema } } });
const body = (schema: object) => ({ required: true, ...json(schema) });
const id = (name: string) => ({ name, in: "path", required: true, schema: { type: "string" } });
const version = { type: "integer", minimum: 0, maximum: 2147483646 };
const status = { type: "string", enum: ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"] };
const common = { tags: ["Sitter verification"], security: [{ bearerAuth: [] }] };
const errors = { "400": { $ref: "#/components/responses/ValidationError" }, "401": { $ref: "#/components/responses/Unauthorized" },
  "403": { $ref: "#/components/responses/Forbidden" }, "404": { $ref: "#/components/responses/NotFound" }, "409": { $ref: "#/components/responses/Conflict" }, "429": { $ref: "#/components/responses/RateLimited" } };
const response = (description: string, schema: object = { type: "object" }) => ({ "200": { description, ...json(schema) }, ...errors });
const fileInput = { type: "object", additionalProperties: false, required: ["purpose", "contentType", "sizeBytes"], properties: {
  purpose: { type: "string", enum: ["IDENTITY_DOCUMENT", "FACE_PHOTO"] }, contentType: { type: "string", enum: ["image/jpeg", "image/png", "image/webp"] }, sizeBytes: { type: "integer", minimum: 12, maximum: 10000000 }
} };
const reviewProperties = { expectedVersion: version, reason: { type: "string", minLength: 3, maxLength: 1000 }, decision: { type: "string", enum: ["APPROVE", "REJECT"] }, documentConfirmed: { type: "boolean", enum: [true] }, faceConfirmed: { type: "boolean", enum: [true] } };
export const sitterVerificationPaths = {
  "/api/sitters/me/verification": {
    get: { ...common, summary: "Own identity status and private file metadata", description: "User account only; no-store. No object keys or permanent URLs are returned.", responses: response("Status and files") },
    post: { ...common, summary: "Submit document and face photos for manual review", description: "Verified email, editable status and two completed owned files with matching purposes required. expectedVersion prevents stale submissions. One submission binds an immutable image snapshot and account full name. Limit 10/account/15 minutes. Pending evidence expires after 30 days.",
      requestBody: body({ type: "object", additionalProperties: false, required: ["expectedVersion", "documentFileId", "faceFileId"], properties: { expectedVersion: version, documentFileId: { type: "string", format: "uuid" }, faceFileId: { type: "string", format: "uuid" } } }),
      responses: { "202": { description: "Submitted", ...json({ type: "object", properties: { verification: ref("SitterVerification") } }) }, ...errors } }
  },
  "/api/sitters/me/verification/files": { post: { ...common, summary: "Create a private image upload", description: "At most 12 unexpired files/profile; 20 upload links/account/15 minutes. Signed staging PUT expires after 600 seconds. Upload exact bytes and Content-Type, then call complete. Drafts expire after 24 hours. Uses private S3_DOCUMENT_BUCKET, never the public photo bucket.", requestBody: body(fileInput), responses: { "201": { description: "Staging upload", ...json({ type: "object", properties: { fileId: { type: "string", format: "uuid" }, uploadUrl: { type: "string", format: "uri" }, expiresIn: { type: "integer", enum: [600] } } }) }, ...errors } } },
  "/api/sitters/me/verification/files/{fileId}/complete": { post: { ...common, parameters: [id("fileId")], summary: "Validate and seal the uploaded image", description: "Checks size, MIME metadata, signature and ETag. Copies the validated bytes to a server-only key, so later PUT retries cannot alter submitted evidence. Idempotent. Owner only.", responses: response("Saved file metadata") } },
  "/api/sitters/me/verification/files/{fileId}": {
    get: { ...common, parameters: [id("fileId")], summary: "Owner opens a private image", description: "Returns a signed GET valid for 60 seconds, no-store. Every link request is audited.", responses: response("Temporary link") },
    delete: { ...common, parameters: [id("fileId")], summary: "Delete an unsubmitted draft image", description: "Expires the draft immediately; maintenance removes stored objects.", responses: { "204": { description: "Deletion scheduled" }, ...errors } }
  },
  "/api/admin/sitters": { get: { ...common, summary: "Administrator identity review queue", parameters: [{ name: "status", in: "query", schema: { ...status, default: "PENDING" } }, { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } }, { name: "pageSize", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } }], responses: response("Queue; no image keys or URLs") } },
  "/api/admin/sitters/{accountId}/verification": {
    get: { ...common, parameters: [id("accountId")], summary: "Administrator reads one verification snapshot", responses: response("Snapshot and pending file metadata") },
    post: { ...common, parameters: [id("accountId")], summary: "Administrator approves or rejects identity", description: "PENDING only; expectedVersion and reason required. APPROVE also requires documentConfirmed=true and faceConfirmed=true; REJECT must omit confirmation fields. Cannot self-approve. Concurrent decisions succeed once. The decision is audited and evidence expires immediately; maintenance deletes both image objects. Name/email changes invalidate approval. Existing sitters are not automatically approved by migration.",
      requestBody: body({ oneOf: [{ type: "object", additionalProperties: false, required: ["expectedVersion", "reason", "decision", "documentConfirmed", "faceConfirmed"], properties: { ...reviewProperties, decision: { type: "string", enum: ["APPROVE"] } } },
        { type: "object", additionalProperties: false, required: ["expectedVersion", "reason", "decision"], properties: { expectedVersion: version, reason: reviewProperties.reason, decision: { type: "string", enum: ["REJECT"] } } }] }), responses: response("Decision", { type: "object", properties: { verification: ref("SitterVerification") } }) }
  },
  "/api/admin/sitters/{accountId}/verification/files/{fileId}": { get: { ...common, parameters: [id("accountId"), id("fileId")], summary: "Administrator opens a pending image", description: "Only files bound to the current pending version. Every link request is audited. Returns a signed GET valid for 60 seconds, never a permanent public URL.", responses: response("Temporary link") } }
};
export const sitterVerificationSchemas = {
  SitterVerification: { type: "object", required: ["status", "version", "canAcceptBookings"], properties: { status, version, canAcceptBookings: { type: "boolean" },
    submittedAt: { type: "string", format: "date-time", nullable: true }, reviewedAt: { type: "string", format: "date-time", nullable: true }, reason: { type: "string", nullable: true } } }
};
