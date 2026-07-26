import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  API_JWT_SECRET: z.string().min(1, "API_JWT_SECRET is required"),
  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN is required"),
  X402_NETWORK: z.string().min(1, "X402_NETWORK is required"),
  APPROVAL_EXPIRY_MINUTES: z.coerce.number().default(30),
  DUPLICATE_GUARD_TTL_SECONDS: z.coerce.number().default(600),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("❌ Environment validation failed:", result.error.format());
  throw new Error(`Environment validation error: ${result.error.message}`);
}

export const env = result.data;
