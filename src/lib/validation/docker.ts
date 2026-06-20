import { z } from "zod";
import { DOCKER_ACTIONS } from "@/lib/types/docker";

/**
 * Docker Command Centre request schemas (v0.2). Container identifiers are
 * validated strictly BEFORE any privileged Engine call: a container id is hex
 * (short 12 or full 64). Names are deliberately not accepted as action targets —
 * the id is unambiguous and trivially validatable. ⭐ Mirrors the architect-owned
 * validation convention (see ./apps).
 */

/** `:id` route param for a container — short or full Docker id. */
export const dockerContainerIdSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{12,64}$/, "Invalid container id"),
});

/** POST /api/docker/containers/:id/action body. */
export const dockerActionSchema = z.object({
  action: z.enum(DOCKER_ACTIONS),
});

export type DockerContainerIdParam = z.infer<typeof dockerContainerIdSchema>;
export type DockerActionInput = z.infer<typeof dockerActionSchema>;
