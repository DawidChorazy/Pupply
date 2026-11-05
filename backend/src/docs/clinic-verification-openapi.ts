const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ "application/json": { schema } });
const body = (schema: object) => ({ required: true, content: json(schema) });
const response = (description: string, schema: object) => ({ description, content: json(schema) });
const errors = Object.fromEntries([
  ["400", "ValidationError"], ["401", "Unauthorized"], ["403", "Forbidden"],
  ["404", "NotFound"], ["409", "Conflict"], ["429", "RateLimited"], ["500", "InternalError"]
].map(([code, name]) => [code, { $ref: `#/components/responses/${name}` }]));
const security = [{ bearerAuth: [] }];
const accountId = { in: "path", name: "accountId", required: true, schema: { type: "string" } };
const version = { type: "integer", minimum: 0, maximum: 2147483646, description: "Current verification version; stale submissions or decisions return 409." };
const reason = { type: "string", minLength: 3, maxLength: 1000, description: "Visible to the clinic and recorded in the administrator audit." };
const reviewFields = { expectedVersion: version, reason };

export const clinicVerificationPaths = {
  "/api/clinics/me/verification": {
    post: {
      tags: ["Clinics"], security, summary: "Submit own clinic for manual verification",
      description: "Requires confirmed email, valid NIP, address and veterinary registry entry number. Only UNVERIFIED and REJECTED clinics can submit. Limited to 10 attempts per account per authentication rate-limit window.",
      requestBody: body({ type: "object", additionalProperties: false, required: ["expectedVersion"], properties: { expectedVersion: version } }),
      responses: { "202": response("Submitted for review", ref("ClinicVerificationEnvelope")), ...errors }
    }
  },
  "/api/admin/clinics": {
    get: {
      tags: ["Admin"], security, summary: "List clinics by verification status (administrator only)",
      parameters: [
        { in: "query", name: "status", schema: { ...ref("ClinicVerificationStatus"), default: "PENDING" } },
        { in: "query", name: "page", schema: { type: "integer", minimum: 1, maximum: 100000, default: 1 } },
        { in: "query", name: "pageSize", schema: { type: "integer", minimum: 1, maximum: 50, default: 20 } }
      ],
      responses: { "200": response("Clinic review queue", { type: "object", required: ["items", "pagination"], properties: {
        items: { type: "array", items: ref("AdminClinicVerification") }, pagination: ref("Pagination")
      } }), ...errors }
    }
  },
  "/api/admin/clinics/{accountId}/verification": {
    get: {
      tags: ["Admin"], security, summary: "Inspect current clinic details before reviewing", parameters: [accountId],
      responses: { "200": response("Clinic details", { type: "object", required: ["profile"], properties: { profile: ref("AdminClinicVerification") } }), ...errors }
    },
    post: {
      tags: ["Admin"], security, parameters: [accountId], summary: "Approve or reject a pending clinic",
      description: "Approval requires the administrator to independently confirm the veterinary registry entry and the applicant's authority to represent the clinic. Registry source URL, reason, profile snapshot and confirmations are audited. The backend does not fetch or verify that URL automatically. Changes to profile data or confirmed email invalidate verification.",
      requestBody: body({ oneOf: [ref("ClinicVerificationApproval"), ref("ClinicVerificationRejection")] }),
      responses: { "200": response("Review completed", ref("ClinicVerificationEnvelope")), ...errors }
    }
  }
};

export const clinicVerificationSchemas = {
  PolishNip: { type: "string", maxLength: 30, description: "Polish NIP with a valid checksum. Spaces and hyphens are removed; stored as 10 digits. Repeated identical digits are rejected." },
  ClinicVerificationStatus: { type: "string", enum: ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"] },
  ClinicProfileUpdate: { type: "object", minProperties: 1, additionalProperties: false, properties: {
    clinicName: { type: "string", minLength: 2, maxLength: 120 }, phone: { type: "string", pattern: "^\\+?[0-9]{9,15}$" },
    nip: ref("PolishNip"), address: { type: "string", minLength: 5, maxLength: 500 },
    registrationNumber: { type: "string", minLength: 1, maxLength: 100, description: "Entry number in the veterinary establishment registry; not REGON or KRS." }
  } },
  ClinicVerification: { type: "object", required: ["status", "version", "submittedAt", "reviewedAt", "reason", "canPublishServices", "canAcceptBookings"], properties: {
    status: ref("ClinicVerificationStatus"), version: { type: "integer", minimum: 0 },
    submittedAt: { type: "string", format: "date-time", nullable: true }, reviewedAt: { type: "string", format: "date-time", nullable: true },
    reason: { type: "string", nullable: true }, canPublishServices: { type: "boolean" }, canAcceptBookings: { type: "boolean" }
  } },
  ClinicVerificationEnvelope: { type: "object", required: ["verification"], properties: { verification: ref("ClinicVerification") } },
  ClinicProfileEnvelope: { type: "object", required: ["profile"], properties: { profile: {
    type: "object", required: ["id", "email", "clinicName", "nip", "phone", "verification"], properties: {
      id: { type: "string" }, email: { type: "string", format: "email" }, emailVerifiedAt: { type: "string", format: "date-time", nullable: true },
      clinicName: { type: "string" }, nip: ref("PolishNip"), phone: { type: "string" }, address: { type: "string", nullable: true },
      registrationNumber: { type: "string", nullable: true }, verification: ref("ClinicVerification")
    }
  } } },
  ClinicVerificationApproval: { type: "object", additionalProperties: false,
    required: ["decision", "expectedVersion", "reason", "registryConfirmed", "representativeConfirmed", "evidenceUrl"], properties: {
      ...reviewFields, decision: { type: "string", enum: ["APPROVE"] }, registryConfirmed: { type: "boolean", enum: [true] },
      representativeConfirmed: { type: "boolean", enum: [true] }, evidenceUrl: { type: "string", format: "uri", pattern: "^https://", maxLength: 1000 }
    }
  },
  ClinicVerificationRejection: { type: "object", additionalProperties: false, required: ["decision", "expectedVersion", "reason"],
    properties: { ...reviewFields, decision: { type: "string", enum: ["REJECT"] } }
  },
  AdminClinicVerification: { type: "object", required: ["id", "accountId", "clinicName", "nip", "phone", "verificationStatus", "verificationVersion", "account"], properties: {
    id: { type: "string" }, accountId: { type: "string" }, clinicName: { type: "string" }, nip: { type: "string" }, phone: { type: "string" },
    address: { type: "string", nullable: true }, registrationNumber: { type: "string", nullable: true },
    verificationStatus: ref("ClinicVerificationStatus"), verificationVersion: { type: "integer" },
    verificationSubmittedAt: { type: "string", format: "date-time", nullable: true }, verificationReviewedAt: { type: "string", format: "date-time", nullable: true },
    verificationReviewedBy: { type: "string", nullable: true }, verificationReason: { type: "string", nullable: true }, verificationEvidenceUrl: { type: "string", nullable: true },
    account: { type: "object", properties: {
      email: { type: "string", format: "email" }, emailVerifiedAt: { type: "string", format: "date-time", nullable: true },
      blockedAt: { type: "string", format: "date-time", nullable: true }, deactivatedAt: { type: "string", format: "date-time", nullable: true }
    } }
  } }
};
