import { z } from "zod";
import { appCreateSchema } from "./apps";

/**
 * Import-from-Docker request schema (v0.2.1). Each item is a normal app-create
 * payload (so it reuses ALL app validation — required http(s) URL, name length,
 * health fields, trusted-internal TLS) plus the source `containerId`, which is
 * only echoed back in the result and used for duplicate reporting. The container
 * id is validated with the same strict hex rule as the Command Centre.
 */
export const dockerImportItemSchema = appCreateSchema.extend({
  containerId: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{12,64}$/, "Invalid container id"),
});

export const dockerImportSchema = z.object({
  items: z.array(dockerImportItemSchema).min(1).max(100),
});

export type DockerImportItemInput = z.infer<typeof dockerImportItemSchema>;
export type DockerImportInput = z.infer<typeof dockerImportSchema>;
