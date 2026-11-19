import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../config/env";
import { clearPayuToken, payuClient, safeCheckoutUrl, verifyPayuSignature } from "./payu.client";
const initial = { ...env };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const input = { id: "payment-123", amountCents: 1234, email: "buyer@example.test", customerIp: "127.0.0.1", validitySeconds: 1800 };
beforeEach(() => { clearPayuToken(); Object.assign(env, { PAYU_ENABLED: true, PAYU_ENVIRONMENT: "sandbox", PAYU_POS_ID: "999001", PAYU_CLIENT_ID: "999001", PAYU_CLIENT_SECRET: "test-secret", PAYU_SECOND_KEY: "test-second-key", PAYU_NOTIFY_URL: "https://app.example/api/payments/payu/notify", PAYU_CONTINUE_URL: "https://app.example/marketplace/payment" }); });
afterEach(() => { vi.unstubAllGlobals(); Object.assign(env, initial); clearPayuToken(); });
describe("PayU HTTP contract", () => {
  it("uses OAuth and a manual 302 redirect, server amount, safe callback and cached tokens", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ access_token: "token", expires_in: 3600 }))
      .mockResolvedValueOnce(json({ status: { statusCode: "SUCCESS" }, orderId: "order-123", extOrderId: input.id, redirectUri: "https://secure.snd.payu.com/checkout" }, 302))
      .mockResolvedValueOnce(json({ orders: [{ orderId: "order-123", extOrderId: input.id, merchantPosId: "999001", totalAmount: "1234", currencyCode: "PLN", status: "NEW" }] }));
    vi.stubGlobal("fetch", fetcher);
    expect((await payuClient.createOrder(input)).checkoutUrl).toBe("https://secure.snd.payu.com/checkout");
    expect(fetcher.mock.calls[0][0]).toBe("https://secure.snd.payu.com/pl/standard/user/oauth/authorize");
    const request = fetcher.mock.calls[1][1], payload = JSON.parse(request.body);
    expect(request.redirect).toBe("manual"); expect(payload).toMatchObject({ extOrderId: input.id, totalAmount: "1234", merchantPosId: "999001", notifyUrl: env.PAYU_NOTIFY_URL });
    expect(new URL(payload.continueUrl).searchParams.get("paymentId")).toBe(input.id);
    expect((await payuClient.getOrder("order-123")).status).toBe("NEW"); expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[2][1]).not.toHaveProperty("body");
  });
  it("renews OAuth once on a 401 without following any redirects", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ access_token: "old", expires_in: 3600 })).mockResolvedValueOnce(json({ status: { statusCode: "UNAUTHORIZED" } }, 401))
      .mockResolvedValueOnce(json({ access_token: "new", expires_in: 3600 })).mockResolvedValueOnce(json({ status: { statusCode: "SUCCESS" } }));
    vi.stubGlobal("fetch", fetcher); await payuClient.cancelOrder("order-123");
    expect(fetcher).toHaveBeenCalledTimes(4); expect(fetcher.mock.calls[3][1].headers.Authorization).toBe("Bearer new");
  });
  it("preserves an ambiguous duplicate-order failure for recovery and never leaks provider responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ access_token: "t", expires_in: 3600 })).mockResolvedValueOnce(json({ status: { statusCode: "ERROR_ORDER_NOT_UNIQUE", statusDesc: "private buyer details" } }, 400)));
    await expect(payuClient.createOrder(input)).rejects.toMatchObject({ code: "PAYU_ORDER_EXISTS", retryable: true });
  });
  it("verifies notification signatures over exact raw UTF-8 bytes and rejects altered bodies or algorithms", () => {
    const raw = Buffer.from('{ "opis": "Zażółć gęślą", "order": {} }\n');
    const signature = createHash("md5").update(raw).update(env.PAYU_SECOND_KEY!).digest("hex");
    const header = `sender=checkout; signature=${signature}; algorithm=MD5; content=DOCUMENT`;
    expect(() => verifyPayuSignature(raw, header)).not.toThrow();
    expect(() => verifyPayuSignature(Buffer.from(raw.toString().trim()), header)).toThrow();
    expect(() => verifyPayuSignature(raw, header.replace("MD5", "SHA1"))).toThrow();
    expect(() => verifyPayuSignature(raw, `${header};signature=${signature}`)).toThrow();
    expect(() => verifyPayuSignature(raw)).toThrow();
  });
  it("rejects foreign checkout hosts, credentials and non-HTTPS schemes", () => {
    for (const url of ["http://secure.snd.payu.com/", "https://secure.snd.payu.com.evil.example/", "https://evil.example/", "https://user:pass@secure.snd.payu.com/", "javascript:alert(1)"])
      expect(() => safeCheckoutUrl(url)).toThrow();
    expect(safeCheckoutUrl("https://secure.snd.payu.com/checkout")).toBe("https://secure.snd.payu.com/checkout");
    expect(safeCheckoutUrl("https://merch-prod.snd.payu.com/pay/")).toBe("https://merch-prod.snd.payu.com/pay/");
    expect(() => safeCheckoutUrl("https://merch-prod.payu.com/pay/")).toThrow();
  });
  it("accepts both documented refund-list envelopes and reuses the external refund ID", async () => {
    const refund = { refundId: "provider-refund", extRefundId: "refund-123", amount: "100", currencyCode: "PLN", status: "PENDING" };
    const fetcher = vi.fn().mockResolvedValueOnce(json({ access_token: "t", expires_in: 3600 }))
      .mockResolvedValueOnce(json({ refunds: [refund] })).mockResolvedValueOnce(json([refund])).mockResolvedValueOnce(json({ status: { statusCode: "SUCCESS" }, orderId: "order", refund }));
    vi.stubGlobal("fetch", fetcher);
    expect((await payuClient.getRefunds("order"))[0].amount).toBe(100);
    expect((await payuClient.getRefunds("order"))[0].amount).toBe(100);
    await payuClient.refund("order", "refund-123", 100);
    expect(JSON.parse(fetcher.mock.calls[3][1].body)).toMatchObject({ refund: { extRefundId: "refund-123", amount: "100", currencyCode: "PLN" } });
  });
});
