const bearer = [{ bearerAuth: [] }];
const parameter = (name: string) => ({ name, in: "path", required: true, schema: { type: "string" } });
const body = (schema: object) => ({ required: true, content: { "application/json": { schema } } });
const response = (schema: object) => ({ description: "Success", content: { "application/json": { schema } } });
const errors = Object.fromEntries([400, 401, 403, 404, 409, 413, 429, 503].map(status => [String(status), { description: "Request failed", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }]));
const actionResponse = response({ type: "object", properties: { accepted: { type: "boolean" }, debugToken: { type: "string", description: "Development/test only" } } });
const documentMeta = { type: "object", properties: { expiresAt: { type: "string", format: "date", nullable: true }, reminderDaysBefore: { type: "integer", minimum: 0, maximum: 365 } } };
const petParameters = [parameter("petId")];
const documentParameters = [...petParameters, parameter("documentId")];
const preferences = { type: "object", required: ["emailNotifications"], properties: { emailNotifications: { type: "boolean" } } };
const deviceBody = body({ type: "object", required: ["token"], properties: { token: { type: "string", description: "ExpoPushToken or ExponentPushToken" } } });

export const reliabilityPaths = {
  "/api/pets/{petId}/documents": {
    get: { tags: ["Documents"], security: bearer, parameters: petParameters, summary: "List completed PDF uploads owned by the current account", responses: { "200": response({ type: "object", properties: { documents: { type: "array", items: { $ref: "#/components/schemas/PetDocument" } } } }), ...errors } }
  },
  "/api/pets/{petId}/documents/upload": {
    post: { tags: ["Documents"], security: bearer, parameters: petParameters, summary: "Prepare a private PDF upload; upload to the returned URL, then PATCH to confirm", requestBody: body({ type: "object", required: ["name", "sizeBytes"], properties: { name: { type: "string", maxLength: 255 }, sizeBytes: { type: "integer", minimum: 1, description: "Limited by DOCUMENT_MAX_BYTES (10 MB by default)" } } }), responses: { "201": response({ type: "object", properties: { document: { $ref: "#/components/schemas/PetDocument" }, uploadUrl: { type: "string", format: "uri" }, expiresIn: { type: "integer" } } }), ...errors } }
  },
  "/api/pets/{petId}/documents/{documentId}": {
    patch: { tags: ["Documents"], security: bearer, parameters: documentParameters, summary: "Confirm PDF signature/size/type and save expiration/reminder settings", requestBody: body(documentMeta), responses: { "200": response({ type: "object", properties: { document: { $ref: "#/components/schemas/PetDocument" } } }), ...errors } },
    delete: { tags: ["Documents"], security: bearer, parameters: documentParameters, summary: "Delete PDF from private storage and database", responses: { "204": { description: "Deleted" }, ...errors } }
  },
  "/api/pets/{petId}/documents/{documentId}/download": {
    get: { tags: ["Documents"], security: bearer, parameters: documentParameters, summary: "Get an authorized download URL valid for 300 seconds", responses: { "200": response({ type: "object", properties: { url: { type: "string", format: "uri" }, expiresIn: { type: "integer" } } }), ...errors } }
  },
  "/api/account/password": {
    post: { tags: ["Account"], security: bearer, summary: "Change password and revoke all sessions", requestBody: body({ type: "object", required: ["currentPassword", "password"], properties: { currentPassword: { type: "string" }, password: { type: "string", minLength: 8 } } }), responses: { "204": { description: "Password changed; log in again" }, ...errors } }
  },
  "/api/account/email": {
    post: { tags: ["Account"], security: bearer, summary: "Request email change after confirming the current password", requestBody: body({ type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string" } } }), responses: { "202": actionResponse, ...errors } }
  },
  "/api/auth/email-change/confirm": {
    post: { tags: ["Account"], summary: "Confirm new email, unlink Google and revoke all sessions", requestBody: body({ type: "object", required: ["token"], properties: { token: { type: "string" } } }), responses: { "204": { description: "Email changed; log in again" }, ...errors } }
  },
  "/api/account/deactivate": {
    post: { tags: ["Account"], security: bearer, summary: "Deactivate account, hide sitter profile, cancel active bookings and revoke sessions", requestBody: body({ type: "object", required: ["confirmation"], properties: { confirmation: { type: "string", enum: ["DEACTIVATE"] } } }), responses: { "204": { description: "Account deactivated" }, ...errors } }
  },
  "/api/account/preferences": {
    get: { tags: ["Account"], security: bearer, responses: { "200": response(preferences), ...errors } },
    patch: { tags: ["Account"], security: bearer, summary: "Opt in or out of notification emails; verified email required to opt in", requestBody: body(preferences), responses: { "200": response(preferences), ...errors } }
  },
  "/api/notifications/push-config": {
    get: { tags: ["Notifications"], security: bearer, responses: { "200": response({ type: "object", properties: { enabled: { type: "boolean" } } }), ...errors } }
  },
  "/api/notifications/devices": {
    post: { tags: ["Notifications"], security: bearer, summary: "Register an Expo token for the current login session", requestBody: deviceBody, responses: { "204": { description: "Registered" }, ...errors } },
    delete: { tags: ["Notifications"], security: bearer, summary: "Unregister an owned Expo token", requestBody: deviceBody, responses: { "204": { description: "Unregistered" }, ...errors } }
  },
  "/api/notifications/devices/all": {
    delete: { tags: ["Notifications"], security: bearer, summary: "Disable push on all account devices", responses: { "204": { description: "Unregistered" }, ...errors } }
  },
  "/api/admin/accounts/{accountId}/state": {
    post: { tags: ["Admin"], security: bearer, parameters: [parameter("accountId")], summary: "ADMIN only: block or restore a non-admin account and create an audit entry", requestBody: body({ type: "object", required: ["action", "reason"], properties: { action: { type: "string", enum: ["BLOCK", "RESTORE"] }, reason: { type: "string", minLength: 3, maxLength: 500 } } }), responses: { "204": { description: "State changed" }, ...errors } }
  },
  "/api/admin/audit": {
    get: { tags: ["Admin"], security: bearer, summary: "ADMIN only: paginated account audit history", parameters: [{ name: "accountId", in: "query", schema: { type: "string" } }, { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } }], responses: { "200": response({ type: "object", properties: { items: { type: "array", items: { type: "object", properties: { id: { type: "string" }, actorAccountId: { type: "string" }, targetAccountId: { type: "string" }, action: { type: "string" }, reason: { type: "string", nullable: true }, createdAt: { type: "string", format: "date-time" } } } } } }), ...errors } }
  }
};
export const reliabilitySchemas = {
  PetDocument: { type: "object", required: ["id", "petId", "name", "sizeBytes", "reminderDaysBefore"], properties: {
    id: { type: "string" }, petId: { type: "string" }, name: { type: "string" }, sizeBytes: { type: "integer" },
    expiresAt: { type: "string", format: "date-time", nullable: true }, reminderDaysBefore: { type: "integer" },
    uploadedAt: { type: "string", format: "date-time", nullable: true }, createdAt: { type: "string", format: "date-time" }
  } }
};
