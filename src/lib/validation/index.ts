/**
 * Shared zod schemas. ⭐ ARCHITECT-OWNED barrel.
 *
 * Used by API route handlers (server) and forms (client). Primitives live in
 * ./common; one file per resource. Inferred input types are exported alongside
 * each schema. Entity/response shapes live in `@/lib/types`.
 */
export * from "./common";
export * from "./settings";
export * from "./categories";
export * from "./apps";
export * from "./health";
export * from "./widgets";
export * from "./metrics";
export * from "./notifications";
