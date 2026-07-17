import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: process.env.NODE_ENV === "test" });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  ACTION_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(30),
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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
