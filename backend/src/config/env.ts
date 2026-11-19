import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: process.env.NODE_ENV === "test" ? ".env.test" : ".env", quiet: process.env.NODE_ENV === "test" });
const optionalPayuText = z.preprocess(value => value === "" ? undefined : value, z.string().min(1).optional());
const optionalPayuUrl = z.preprocess(value => value === "" ? undefined : value, z.string().url().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  PAYU_ENABLED: z.enum(["true", "false"]).default("false").transform(value => value === "true"),
  PAYU_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  PAYU_POS_ID: optionalPayuText.refine(value => !value || /^\d+$/.test(value)),
  PAYU_CLIENT_ID: optionalPayuText,
  PAYU_CLIENT_SECRET: optionalPayuText,
  PAYU_SECOND_KEY: optionalPayuText,
  PAYU_NOTIFY_URL: optionalPayuUrl,
  PAYU_CONTINUE_URL: optionalPayuUrl,
  PAYMENT_TIMEOUT_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  ACTION_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  BOOKING_REQUEST_TTL_HOURS: z.coerce.number().positive().max(168).default(24),
  MAINTENANCE_INTERVAL_SECONDS: z.coerce.number().int().min(10).default(60),
  S3_DOCUMENT_BUCKET: z.string().min(1).default("pupply-documents"),
  DOCUMENT_MAX_BYTES: z.coerce.number().int().positive().max(25_000_000).default(10_000_000),
  PUSH_ENABLED: z.enum(["true", "false"]).default("false").transform(value => value === "true"),
  EXPO_PUSH_ACCESS_TOKEN: z.string().optional(),
  METRICS_TOKEN: z.string().min(32).optional(),
  CORS_ORIGIN: z.string().default("*"),
  APP_PUBLIC_URL: z.string().url().default("http://localhost:8081"),
  API_PUBLIC_URL: z.string().url().default("http://localhost:4000"),
  AUTH_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default("Pupply <no-reply@pupply.local>"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_PUBLIC_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  S3_PUBLIC_BASE_URL: z.string().url().optional(),
  PET_PHOTO_MAX_BYTES: z.coerce.number().int().positive().max(25_000_000).default(10_000_000),
  GOOGLE_CLIENT_IDS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((clientId) => clientId.trim())
        .filter(Boolean)
    )
}).refine(value => !value.S3_BUCKET || value.S3_BUCKET !== value.S3_DOCUMENT_BUCKET, {
  path: ["S3_DOCUMENT_BUCKET"], message: "Private documents must use a separate bucket from public photos"
}).superRefine((value, context) => {
  if (!value.PAYU_ENABLED) return;
  for (const key of ["PAYU_POS_ID", "PAYU_CLIENT_ID", "PAYU_CLIENT_SECRET", "PAYU_SECOND_KEY", "PAYU_NOTIFY_URL", "PAYU_CONTINUE_URL"] as const)
    if (!value[key]) context.addIssue({ code: "custom", path: [key], message: "Required when PayU is enabled" });
  if (value.PAYU_POS_ID !== value.PAYU_CLIENT_ID) context.addIssue({ code: "custom", path: ["PAYU_CLIENT_ID"], message: "POS and OAuth client must match" });
  if (value.PAYU_ENVIRONMENT === "production") {
    for (const key of ["PAYU_NOTIFY_URL", "PAYU_CONTINUE_URL"] as const)
      if (value[key] && new URL(value[key]).protocol !== "https:") context.addIssue({ code: "custom", path: [key], message: "Production requires HTTPS" });
    if (["300746", "145227", "404815", "491057"].includes(value.PAYU_POS_ID ?? "")) context.addIssue({ code: "custom", path: ["PAYU_POS_ID"], message: "Public test POS cannot be used in production" });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
