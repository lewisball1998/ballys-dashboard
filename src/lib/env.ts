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
  // Recovery escape hatch: set to "1" to bypass auth enforcement (CSRF still
  // applies). The auth guard reads process.env directly so this can be toggled
  // without a rebuild.
  AUTH_DISABLE: z.string().optional(),
  // Docker Command Centre (v0.2). Path to the Docker Engine API unix socket the
  // server talks to for container list/control. PRIVILEGED + opt-in: the socket
  // is not mounted by default (ADR 0008 / docs/DOCKER.md). When it is absent the
  // Docker page degrades to a clear "not configured" state. Never sent to the
  // client.
  DOCKER_SOCKET_PATH: z.string().min(1).default("/var/run/docker.sock"),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
