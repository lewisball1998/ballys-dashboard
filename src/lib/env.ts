import { z } from "zod";

/**
 * Deployment-level environment. Product configuration lives in the database,
 * not here — these are only the values needed to boot the process.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().min(1).default("./data/ballys.db"),
  // Optional in v0.1 (no module secrets yet); required once modules store
  // credentials in v0.2. Validated lazily where it is actually used.
  APP_ENCRYPTION_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
