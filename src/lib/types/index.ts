/**
 * Shared, transport-safe types (DTOs). ⭐ ARCHITECT-OWNED barrel.
 *
 * Backend and Frontend import from `@/lib/types` so they build against the same
 * shapes in parallel. Primitives live in ./common; one file per resource.
 * Request/response *payload* validation lives alongside in `@/lib/validation`.
 */
export * from "./common";
export * from "./settings";
export * from "./categories";
export * from "./apps";
export * from "./health";
export * from "./widgets";
export * from "./metrics";
export * from "./notifications";
export * from "./setup";
export * from "./auth";
