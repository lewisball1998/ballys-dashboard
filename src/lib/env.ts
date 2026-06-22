import { z } from "zod";

/**
 * Deployment-level environment. Product configuration lives in the database,
 * not here — these are only the values needed to boot the process.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().min(1).default("./data/ballys.db"),
  // Where uploaded custom icon files are stored (v0.2.6). Optional: when unset it
  // derives from DATABASE_PATH (an `icons/` dir next to the SQLite file) so it
  // lives on the same mounted data volume. Files are served by opaque id only.
  ICONS_DIR: z.string().min(1).optional(),
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
  // TrueNAS read-only telemetry provider (v0.3.2). OPTIONAL + server-side only:
  // when URL or key is absent the Infrastructure page reports TrueNAS as "not
  // configured" and renders exactly as before. The URL is a plain string (NOT
  // z.url()) so a malformed value degrades to a calm "unavailable" state rather
  // than crashing process boot. The key is NEVER sent to the client or logged.
  // See docs/truenas-telemetry.md.
  TRUENAS_URL: z.string().min(1).optional(),
  TRUENAS_API_KEY: z.string().min(1).optional(),
  // JSON-RPC 2.0 WebSocket path on the TrueNAS host. Default targets the current
  // TrueNAS SCALE middleware API; older REST-only routes are intentionally avoided.
  TRUENAS_API_PATH: z.string().min(1).default("/api/current"),
  // TLS verification escape hatch for self-signed / trusted-local TrueNAS only.
  // "true" skips certificate verification for the TrueNAS connection ALONE — it
  // never affects global TLS and never uses NODE_TLS_REJECT_UNAUTHORIZED. Unset
  // is treated as false. Keep false when TrueNAS has a valid/proxied cert.
  TRUENAS_ALLOW_INSECURE: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
