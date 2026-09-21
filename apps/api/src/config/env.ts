import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/*
 * Local monorepo development:
 *
 * apps/api/src/config/env.ts
 * apps/api/dist/config/env.js
 *
 * Both resolve four levels up to the repository root,
 * where the canonical local .env file lives.
 *
 * In production, platform-injected environment variables
 * already present in process.env take precedence because
 * dotenv does not override them by default.
 */
const currentDirectory = dirname(
  fileURLToPath(import.meta.url),
);

const rootEnvPath = resolve(
  currentDirectory,
  "../../../../.env",
);

config({
  path: rootEnvPath,
  override: false,
});

const schema = z.object({
  NODE_ENV: z
    .enum([
      "development",
      "test",
      "production",
    ])
    .default("development"),

  API_PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(4000),

  CLIENT_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),

  SUPABASE_URL: z
    .string()
    .url(),

  SUPABASE_SECRET_KEY: z
    .string()
    .min(20),
});

export const env =
  schema.parse(process.env);
