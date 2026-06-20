# Agent Ownership & Contract Rules

Four specialist roles split the work behind a **contract-first** model: the
Architect owns the seams; Backend and Frontend build on opposite sides of those
seams in parallel; QA/Security gates each phase.

## ⭐ Contract files (Architect-owned)

Only the Product Architect edits these. Changes are versioned and broadcast
because they ripple to every other agent:

- `src/lib/types/**` — shared DTOs (response/entity shapes)
- `src/lib/validation/**` — zod request/query schemas
- `src/modules/types.ts`, `src/modules/registry.ts` — plugin contract
- `src/db/schema/**` + `src/db/migrations/**` — DB schema (migrations serialised)
- `docs/architecture/api-contract.md` — the API contract
- root config (`next/tailwind/tsconfig/eslint`)

## Ownership map

| Agent | Owns | Avoids |
|---|---|---|
| **Product Architect** | the ⭐ contract files above, ADRs, docs | feature implementations |
| **Backend** | `src/server/**`, `src/app/api/**`, `src/modules/*/` (server), `src/db/index.ts`, `src/db/seed.ts`, `src/instrumentation*.ts` | `src/components/**`, dashboard pages, ⭐ contract files |
| **Frontend** | `src/app/(dashboard)/**`, `src/app/setup/**`, `src/components/**`, `src/hooks/**`, `src/stores/**`, `public/icons/**`, Tailwind theme | `src/server/**`, `src/app/api/**`, `src/db/**`, ⭐ contract files |
| **QA / Security** | `tests/**`, CI, security review, prod Docker image | feature source (reviews/tests it) |

## Conflict-avoidance rules

1. **Contracts before code** — nobody builds against an unpublished DTO/schema.
2. **One editor per ⭐ contract file** — the Architect. Others propose.
3. **Backend and Frontend never write the same files** — the API boundary is the
   wall; Frontend uses mock data shaped to the published DTOs until endpoints land.
4. **Migrations are serialised** — only the Architect runs `pnpm db:generate`.
5. **QA owns `tests/` exclusively** — no source merge conflicts from test churn.

## Phase 1 status

Contracts are **published** (this commit): settings, categories, apps, app
health, and dashboard widget DTOs + zod schemas, plus
`docs/architecture/api-contract.md`. Backend and Frontend may now proceed in
parallel per the roadmap (`docs/roadmap.md`).
