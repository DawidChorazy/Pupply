import crypto from "node:crypto";
import { RequestHandler } from "express";
import { env } from "../config/env";
import { prisma } from "../config/prisma";

const totals = new Map<string, { count: number; seconds: number }>();
let maintenanceSuccess = 0;
let maintenanceFailures = 0;
export function recordMaintenance(success: boolean) {
  if (success) maintenanceSuccess = Date.now() / 1000;
  else maintenanceFailures++;
}
export const collectMetrics: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const route = typeof req.route?.path === "string" ? req.route.path : "unmatched";
    // Route templates avoid storing user IDs, queries or tokens as metric labels.
    const key = JSON.stringify({ method: req.method, route, status: String(res.statusCode) });
    const value = totals.get(key) ?? { count: 0, seconds: 0 };
    value.count++; value.seconds += Number(process.hrtime.bigint() - start) / 1e9;
    totals.set(key, value);
  });
  next();
};
export const metrics: RequestHandler = async (req, res) => {
  const token = req.header("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!env.METRICS_TOKEN || Buffer.byteLength(token) !== Buffer.byteLength(env.METRICS_TOKEN) || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(env.METRICS_TOKEN))) {
    res.sendStatus(404); return;
  }
  const lines = [
    "# TYPE pupply_http_requests_total counter", "# TYPE pupply_http_request_duration_seconds_sum counter",
    `pupply_process_uptime_seconds ${process.uptime()}`, `pupply_process_resident_memory_bytes ${process.memoryUsage().rss}`,
    `pupply_maintenance_last_success_timestamp_seconds ${maintenanceSuccess}`, `pupply_maintenance_failures_total ${maintenanceFailures}`
  ];
  const [pending, failed, oldest] = await Promise.all([
    prisma.notificationDelivery.count({ where: { sentAt: null, failedAt: null } }),
    prisma.notificationDelivery.count({ where: { failedAt: { not: null } } }),
    prisma.notificationDelivery.aggregate({ where: { sentAt: null, failedAt: null }, _min: { createdAt: true } })
  ]);
  lines.push(`pupply_notification_delivery_pending ${pending}`, `pupply_notification_delivery_failed ${failed}`,
    `pupply_notification_delivery_oldest_pending_age_seconds ${oldest._min.createdAt ? Math.max(0, (Date.now() - oldest._min.createdAt.getTime()) / 1000) : 0}`);
  for (const [key, value] of totals) {
    const labels = Object.entries(JSON.parse(key)).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join(",");
    lines.push(`pupply_http_requests_total{${labels}} ${value.count}`, `pupply_http_request_duration_seconds_sum{${labels}} ${value.seconds}`);
  }
  res.type("text/plain; version=0.0.4").send(`${lines.join("\n")}\n`);
};
