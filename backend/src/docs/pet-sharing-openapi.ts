const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ description: "Success; Cache-Control: no-store", content: { "application/json": { schema } } });
const path = (name: string) => ({ name, in: "path", required: true, schema: { type: "string" } });
const tokenHeader = { name: "X-Pet-Share-Token", in: "header", required: true, description: "Opaque token from the shared URL fragment. No account login required.", schema: { type: "string", pattern: "^[A-Za-z0-9_-]{43}$" } };
const errors = Object.fromEntries([400, 401, 403, 404, 409, 429].map(status => [status, { description: "Request failed", content: { "application/json": { schema: ref("Error") } } }]));
const owner = { tags: ["Pet sharing"], security: [{ bearerAuth: [] }], parameters: [path("petId")] };
const publicRead = { tags: ["Pet sharing"], security: [], parameters: [tokenHeader] };

export const petSharingSchemas = {
  PetShare: { type: "object", required: ["id", "includeDocuments", "createdAt", "expiresAt"], properties: {
    id: { type: "string" }, label: { type: "string", nullable: true }, includeDocuments: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" }, expiresAt: { type: "string", format: "date-time" }, revokedAt: { type: "string", format: "date-time", nullable: true }
  } },
  SharedPetCard: { type: "object", required: ["pet", "documents", "includeDocuments", "expiresAt"], properties: {
    pet: { type: "object", description: "Explicit read-only projection; excludes account ID, owner contacts, storage keys and internal pet ID.", properties: {
      name: { type: "string" }, gender: { type: "string", enum: ["MALE", "FEMALE"] },
      age: { type: "integer", nullable: true }, weight: { type: "number", nullable: true },
      ...Object.fromEntries(["breed", "photoUrl", "illnesses", "allergies", "vaccines", "vet", "notes"].map(name => [name, { type: "string", nullable: true }]))
    } },
    includeDocuments: { type: "boolean" }, expiresAt: { type: "string", format: "date-time" },
    documents: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, sizeBytes: { type: "integer" }, expiresAt: { type: "string", format: "date-time", nullable: true } } } }
  } }
};

export const petSharingPaths = {
  "/api/pets/{petId}/shares": {
    get: { ...owner, summary: "Owner only: list active links first, then recent history (up to 100, without tokens)", responses: { "200": json({ type: "object", properties: { shares: { type: "array", items: ref("PetShare") } } }), ...errors } },
    post: { ...owner, summary: "Owner only: create a revocable 7-day link, up to 20 active links per pet", requestBody: {
      required: true, content: { "application/json": { schema: { type: "object", properties: { label: { type: "string", maxLength: 80 }, includeDocuments: { type: "boolean", default: false } } } } }
    }, responses: { "201": json({ type: "object", properties: { share: ref("PetShare"), url: { type: "string", description: "Returned once. /shared-pet#token=...; only a SHA-256 token hash is persisted." } } }), ...errors } }
  },
  "/api/pets/{petId}/shares/{shareId}": {
    delete: { ...owner, parameters: [...owner.parameters, path("shareId")], summary: "Owner only: revoke a link (idempotent)", responses: { "204": { description: "Revoked" }, ...errors } }
  },
  "/api/shared-pets/card": {
    get: { ...publicRead, summary: "Read current pet data through an active share; PDFs excluded by default", description: "Invalid, expired, revoked links and disabled owners return the same 404. No caching or indexing.", responses: { "200": json(ref("SharedPetCard")), ...errors } }
  },
  "/api/shared-pets/documents/{documentId}/download": {
    get: { ...publicRead, parameters: [...publicRead.parameters, path("documentId")], summary: "Read-only PDF download if the link explicitly includes documents", description: "Returns a private storage URL valid for up to 60 seconds, bounded by the share expiry. Revocation prevents issuing new URLs; it cannot remove saved files or invalidate URLs already issued.", responses: { "200": json({ type: "object", properties: { url: { type: "string", format: "uri" }, expiresIn: { type: "integer", minimum: 1, maximum: 60 } } }), ...errors } }
  }
};
