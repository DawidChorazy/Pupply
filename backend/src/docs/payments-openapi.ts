const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ content: { "application/json": { schema } } });
const errors = Object.fromEntries([400, 401, 403, 404, 409, 429, 503, 500].map(status => [String(status), { description: "Request rejected", ...json(ref("Error")) }]));
const bearer = [{ bearerAuth: [] }];
const id = (name: string) => [{ name, in: "path", required: true, schema: { type: "string" } }];
const paymentResponse = { description: "Private payment (Cache-Control: no-store)", ...json({ type: "object", required: ["payment"], properties: { payment: ref("Payment") } }) };
const status = { type: "string", enum: ["CREATING", "PENDING", "AUTHORIZED", "COMPLETED", "CANCELED", "FAILED"] };
export const paymentPaths = {
  "/api/bookings/{bookingId}/payment": { post: {
    tags: ["Payments"], security: bearer, parameters: id("bookingId"), summary: "Create or resume the owner's PayU hosted checkout",
    description: "Verified owner only, after sitter acceptance and before paymentDueAt. All new positive-price bookings require payment; existing bookings are grandfathered, free services do not. Amount is copied from the immutable booking in grosz. Empty JSON only. Concurrent requests share one persisted payment attempt and external order ID. Unknown transport outcomes retain that ID, never create another charge. PayU OAuth stays on the server. A 200 response can contain CREATING and lastErrorCode while recovery is pending. Checkout URL is returned only to the owner and restricted to exact PayU checkout hosts for the stored environment. Limit 12 requests/account/minute.",
    requestBody: { required: false, ...json({ type: "object", additionalProperties: false, properties: {} }) }, responses: { "200": paymentResponse, ...errors }
  } },
  "/api/bookings/{bookingId}/cancellation-quote": { get: {
    tags: ["Payments"], security: bearer, parameters: id("bookingId"), summary: "Preview cancellation fee and refund",
    description: "Participants only. Paid accepted bookings cancelled by the owner less than 24 hours before the start retain 50% (rounded up to a grosz); earlier, sitter, account-block and unpaid cancellations have no fee. The status PATCH must carry expectedCancellationFeeCents when a fee applies. A changed fee requires another confirmation. Refunds are asynchronous. Additional sitter-cancellation compensation to a wallet is outside this integration.",
    responses: { "200": { description: "Current cancellation quote", ...json(ref("CancellationQuote")) }, ...errors }
  } },
  "/api/payments": { get: {
    tags: ["Payments"], security: bearer, summary: "Own payment or service-settlement history",
    parameters: [{ name: "perspective", in: "query", schema: { type: "string", enum: ["owner", "sitter"], default: "owner" } }, { name: "page", in: "query", schema: { type: "integer", minimum: 1, maximum: 10000, default: 1 } }],
    description: "Participant-only, newest first, 30 items/page. No buyer email, IP, worker lease or OAuth data. Sitter does not receive checkout URLs. grossSettledCents contains production gross service/cancellation-fee records; sandboxGrossSettledCents is separate. These are local records, not bank payouts or a withdrawable wallet. Payouts require a separate PayU Marketplace integration.",
    responses: { "200": { description: "Private history", ...json({ type: "object", properties: { items: { type: "array", items: ref("Payment") }, pagination: ref("Pagination"), grossSettledCents: { type: "integer", minimum: 0 }, sandboxGrossSettledCents: { type: "integer", minimum: 0 }, payoutsSupported: { type: "boolean", enum: [false] } } }) }, ...errors }
  } },
  "/api/payments/{paymentId}": { get: { tags: ["Payments"], security: bearer, parameters: id("paymentId"), summary: "Read a participant's payment", responses: { "200": paymentResponse, ...errors } } },
  "/api/payments/{paymentId}/sync": { post: {
    tags: ["Payments"], security: bearer, parameters: id("paymentId"), summary: "Reconcile status directly with PayU",
    description: "Never accepts a status or amount from the client. Used after returning from hosted checkout, also when a local sandbox cannot receive webhooks. Provider requests run outside DB transactions and use a lease. Accepts repeated calls; unknown creation/refund outcomes reuse the original IDs. Automatically captures WAITING_FOR_CONFIRMATION payments before service start; an expired/cancelled or duplicate order is cancelled or refunded. Limit 20/account/minute. The maintenance worker also retries independently every 15 seconds with per-payment backoff.",
    responses: { "200": paymentResponse, ...errors }
  } },
  "/api/payments/payu/notify": { post: {
    tags: ["Payments"], security: [], summary: "PayU signed order/refund notification",
    description: "Exact raw JSON bytes are verified with MD5(body + second key), using constant-time comparison. Accepts OpenPayu-Signature or X-OpenPayu-Signature, algorithm=MD5, content=DOCUMENT. Validates external ID, stored order ID, POS, amount and PLN. Unknown external IDs belonging to another deployment are acknowledged and ignored. Completed payments cannot be downgraded by stale notifications. Repeated notifications do not duplicate confirmations or refunds. A late payment queues a full refund and never resurrects its booking. A refund is final only on FINALIZED. Returns HTTP 200 after transaction commit; rejected requests can be retried by PayU. 64 KiB body limit.",
    parameters: [{ name: "OpenPayu-Signature", in: "header", schema: { type: "string" } }],
    requestBody: { required: true, ...json({ oneOf: [{ type: "object", required: ["order"], properties: { order: ref("PayuOrderNotification") } }, { type: "object", required: ["orderId", "extOrderId", "refund"], properties: { orderId: { type: "string" }, extOrderId: { type: "string" }, refund: ref("PayuRefundNotification") } }] }) },
    responses: { "200": { description: "Committed or already processed" }, "413": { description: "Body too large" }, ...errors }
  } },
  "/api/admin/payments/{paymentId}/recover": { post: {
    tags: ["Admin"], security: bearer, parameters: id("paymentId"), summary: "Recover a lost creation result using the PayU panel order ID",
    description: "ADMIN only. When creation committed at PayU but its response was lost and no webhook bound the order, extOrderId remains locked to the attempt. An administrator may obtain orderId from the POS panel. The server retrieves the order and validates external ID, POS and amount before binding. Audited. A recovered unpaid order with no usable checkout URL is cancelled by the worker before a new attempt is allowed. Never bind an order supplied solely by an unverified client.",
    requestBody: { required: true, ...json({ type: "object", additionalProperties: false, required: ["orderId"], properties: { orderId: { type: "string", minLength: 1, maxLength: 128 } } }) }, responses: { "200": { description: "Recovered and audited" }, ...errors }
  } }
};
export const paymentSchemas = {
  PaymentRefund: { type: "object", required: ["id", "amountCents", "status"], properties: { id: { type: "string" }, amountCents: { type: "integer", minimum: 1 }, status: { type: "string", enum: ["REQUESTED", "PENDING", "FINALIZED", "CANCELED"] } } },
  PaymentSummary: { type: "object", properties: { id: { type: "string" }, environment: { type: "string", enum: ["sandbox", "production"] }, status, amountCents: { type: "integer", minimum: 1 }, currency: { type: "string", enum: ["PLN"] }, createdAt: { type: "string", format: "date-time" }, completedAt: { type: "string", format: "date-time", nullable: true }, refund: { allOf: [ref("PaymentRefund")], nullable: true } } },
  Payment: { allOf: [ref("PaymentSummary"), { type: "object", properties: { bookingId: { type: "string" }, payuOrderId: { type: "string", nullable: true }, checkoutUrl: { type: "string", format: "uri", nullable: true }, lastErrorCode: { type: "string", nullable: true }, booking: { type: "object", properties: { id: { type: "string" }, status: ref("BookingStatus"), ownerAccountId: { type: "string" }, sitterAccountId: { type: "string" }, startsAt: { type: "string", format: "date-time" }, endsAt: { type: "string", format: "date-time" }, pet: { type: "object", properties: { name: { type: "string" } } }, settlement: { allOf: [ref("PaymentSettlement")], nullable: true } } } } }] },
  PaymentSettlement: { type: "object", description: "Local gross accounting record; no bank transfer or wallet credit is performed.", properties: { amountCents: { type: "integer", minimum: 1 }, kind: { type: "string", enum: ["SERVICE", "CANCELLATION_FEE"] }, createdAt: { type: "string", format: "date-time" } } },
  CancellationQuote: { type: "object", required: ["feeCents", "refundCents", "currency"], properties: { feeCents: { type: "integer", minimum: 0 }, refundCents: { type: "integer", minimum: 0 }, currency: { type: "string", enum: ["PLN"] } } },
  PayuOrderNotification: { type: "object", required: ["orderId", "extOrderId", "merchantPosId", "totalAmount", "currencyCode", "status"], properties: { orderId: { type: "string" }, extOrderId: { type: "string" }, merchantPosId: { type: "string" }, totalAmount: { type: "string", pattern: "^[1-9]\\d{0,9}$" }, currencyCode: { type: "string", enum: ["PLN"] }, status: { type: "string", enum: ["NEW", "PENDING", "WAITING_FOR_CONFIRMATION", "COMPLETED", "CANCELED"] } } },
  PayuRefundNotification: { type: "object", required: ["refundId", "extRefundId", "amount", "currencyCode", "status"], properties: { refundId: { type: "string" }, extRefundId: { type: "string" }, amount: { oneOf: [{ type: "string", pattern: "^[1-9]\\d{0,9}$" }, { type: "integer", minimum: 1 }] }, currencyCode: { type: "string", enum: ["PLN"] }, status: { type: "string", enum: ["PENDING", "FINALIZED", "CANCELED"] } } }
};
