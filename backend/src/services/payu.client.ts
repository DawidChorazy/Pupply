import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";

export const payuOrderSchema = z.object({
  orderId: z.string().min(1).max(128), extOrderId: z.string().min(1).max(100), merchantPosId: z.string(),
  totalAmount: z.string().regex(/^[1-9]\d{0,9}$/), currencyCode: z.literal("PLN"),
  status: z.enum(["NEW", "PENDING", "WAITING_FOR_CONFIRMATION", "COMPLETED", "CANCELED"])
});
export const payuRefundSchema = z.object({
  refundId: z.string().min(1).max(128), extRefundId: z.string().min(1).max(100),
  amount: z.union([z.string().regex(/^[1-9]\d{0,9}$/), z.number().int().positive()]).transform(Number),
  currencyCode: z.literal("PLN"), status: z.enum(["PENDING", "FINALIZED", "CANCELED"])
});
export type PayuOrder = z.infer<typeof payuOrderSchema>;
export type PayuRefund = z.infer<typeof payuRefundSchema>;
export class PayuError extends Error {
  constructor(public code: string, public retryable = true) { super("Operator płatności jest chwilowo niedostępny. Spróbuj ponownie."); }
}
const base = () => env.PAYU_ENVIRONMENT === "sandbox" ? "https://secure.snd.payu.com" : "https://secure.payu.com";
let cachedToken: { value: string; expires: number; scope: string } | undefined;
let pendingToken: Promise<string> | undefined;
export function clearPayuToken() { cachedToken = undefined; pendingToken = undefined; }
function requireConfiguration() {
  if (!env.PAYU_POS_ID || !env.PAYU_CLIENT_ID || !env.PAYU_CLIENT_SECRET || !env.PAYU_SECOND_KEY)
    throw new AppError(503, "Płatności PayU nie zostały skonfigurowane.", "PAYMENTS_UNAVAILABLE");
}
export function safeCheckoutUrl(value: string) {
  const url = new URL(value);
  const origins = env.PAYU_ENVIRONMENT === "sandbox" ? ["https://secure.snd.payu.com", "https://merch-prod.snd.payu.com"] : ["https://secure.payu.com", "https://merch-prod.payu.com"];
  if (!origins.includes(url.origin) || url.username || url.password) throw new PayuError("INVALID_CHECKOUT_URL", false);
  return url.toString();
}
async function token() {
  requireConfiguration();
  const scope = `${base()}/${env.PAYU_CLIENT_ID}/${env.PAYU_CLIENT_SECRET}`;
  if (cachedToken?.scope === scope && cachedToken.expires > Date.now()) return cachedToken.value;
  if (pendingToken) return pendingToken;
  pendingToken = (async () => {
    try {
      const response = await fetch(`${base()}/pl/standard/user/oauth/authorize`, { method: "POST", redirect: "manual", signal: AbortSignal.timeout(12_000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: env.PAYU_CLIENT_ID!, client_secret: env.PAYU_CLIENT_SECRET! }) });
      if (!response.ok) throw new PayuError("PAYU_AUTH_FAILED");
      const data = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() }).parse(await response.json());
      cachedToken = { value: data.access_token, expires: Date.now() + Math.max(0, data.expires_in - 60) * 1000, scope };
      return data.access_token;
    } catch (error) { if (error instanceof PayuError) throw error; throw new PayuError("PAYU_AUTH_UNAVAILABLE"); }
  })().finally(() => { pendingToken = undefined; });
  return pendingToken;
}
async function call(path: string, method = "GET", body?: object | null, retried = false): Promise<unknown> {
  try {
    const access = await token();
    const response = await fetch(`${base()}/api/v2_1${path}`, { method, redirect: "manual", signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json", Accept: "application/json" },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    if (response.status === 401 && !retried) { clearPayuToken(); return call(path, method, body, true); }
    const data: unknown = await response.json();
    const status = z.object({ status: z.object({ statusCode: z.string() }).optional() }).passthrough().safeParse(data);
    const code = status.success ? status.data.status?.statusCode : undefined;
    if (![200, 201, 302].includes(response.status) || (code && !["SUCCESS", "WARNING_CONTINUE_REDIRECT"].includes(code)))
      throw new PayuError(code === "ERROR_ORDER_NOT_UNIQUE" ? "PAYU_ORDER_EXISTS" : "PAYU_REJECTED", response.status >= 500 || response.status === 429 || response.status === 408 || code === "ERROR_ORDER_NOT_UNIQUE");
    return data;
  } catch (error) {
    if (error instanceof PayuError || error instanceof AppError) throw error;
    throw new PayuError("PAYU_UNAVAILABLE");
  }
}

export const payuClient = {
  async createOrder(input: { id: string; amountCents: number; email: string; customerIp: string; validitySeconds: number }) {
    const continueUrl = new URL(env.PAYU_CONTINUE_URL!); continueUrl.searchParams.set("paymentId", input.id);
    const data = z.object({ orderId: z.string().min(1).max(128), extOrderId: z.string().optional(), redirectUri: z.string().url() }).parse(await call("/orders", "POST", {
      merchantPosId: env.PAYU_POS_ID, extOrderId: input.id, notifyUrl: env.PAYU_NOTIFY_URL, continueUrl: continueUrl.toString(),
      customerIp: input.customerIp, description: "Usługa opieki Petify", currencyCode: "PLN", totalAmount: String(input.amountCents),
      validityTime: String(input.validitySeconds), buyer: { email: input.email, language: "pl" },
      products: [{ name: "Usługa opieki Petify", unitPrice: String(input.amountCents), quantity: "1" }]
    }));
    if (data.extOrderId && data.extOrderId !== input.id) throw new PayuError("PAYU_ORDER_MISMATCH", false);
    return { orderId: data.orderId, checkoutUrl: safeCheckoutUrl(data.redirectUri) };
  },
  async getOrder(orderId: string) {
    const data = z.object({ orders: z.array(payuOrderSchema).length(1) }).parse(await call(`/orders/${encodeURIComponent(orderId)}`));
    if (data.orders[0].orderId !== orderId) throw new PayuError("PAYU_ORDER_MISMATCH", false);
    return data.orders[0];
  },
  async cancelOrder(orderId: string) { await call(`/orders/${encodeURIComponent(orderId)}`, "DELETE"); },
  async captureOrder(orderId: string) { await call(`/orders/${encodeURIComponent(orderId)}/captures`, "POST", null); },
  async refund(orderId: string, refundId: string, amountCents: number) {
    const data = z.object({ orderId: z.string(), refund: payuRefundSchema }).parse(await call(`/orders/${encodeURIComponent(orderId)}/refunds`, "POST", {
      refund: { description: "Zwrot za anulowaną rezerwację Petify", amount: String(amountCents), currencyCode: "PLN", extRefundId: refundId }
    }));
    if (data.orderId !== orderId) throw new PayuError("PAYU_ORDER_MISMATCH", false);
    return data.refund;
  },
  async getRefunds(orderId: string) {
    const data = await call(`/orders/${encodeURIComponent(orderId)}/refunds`);
    return z.union([z.array(payuRefundSchema), z.object({ refunds: z.array(payuRefundSchema) }).transform(value => value.refunds)]).parse(data);
  }
};

export function verifyPayuSignature(body: Buffer, signatureHeader?: string) {
  requireConfiguration();
  const parts = (signatureHeader ?? "").split(";").map(part => part.trim().split("="));
  const fields = Object.fromEntries(parts);
  if (fields.algorithm?.toUpperCase() !== "MD5" || fields.content !== "DOCUMENT" || !/^[a-f\d]{32}$/i.test(fields.signature ?? "")
    || parts.filter(([key]) => key === "signature").length !== 1)
    throw new AppError(401, "Nieprawidłowy podpis powiadomienia PayU.", "INVALID_PAYU_SIGNATURE");
  const expected = createHash("md5").update(body).update(env.PAYU_SECOND_KEY!).digest();
  if (!timingSafeEqual(expected, Buffer.from(fields.signature, "hex"))) throw new AppError(401, "Nieprawidłowy podpis powiadomienia PayU.", "INVALID_PAYU_SIGNATURE");
}
