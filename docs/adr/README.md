# Architecture Decision Records

Lightweight ADRs (one decision per file). Status is one of
`Accepted` / `Superseded` / `Proposed`.

| # | Decision | Status |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-fullstack-nextjs-monolith.md) | Full-stack Next.js monolith (no microservices) | Accepted |
| [0003](0003-sqlite-drizzle.md) | SQLite + Drizzle + better-sqlite3 | Accepted |
| [0004](0004-in-process-scheduler.md) | In-process scheduler via instrumentation | Accepted |
| [0005](0005-module-provider-contract.md) | Module / provider plugin contract | Accepted |
| [0006](0006-guarded-fetch-ssrf.md) | Guarded fetch as the single SSRF chokepoint | Accepted |
| [0007](0007-optional-single-user-auth.md) | Optional single-user auth (on by default) | Accepted |
| [0008](0008-container-metrics-and-docker-socket.md) | Container-visible metrics; opt-in Docker socket | Accepted |
| [0009](0009-multi-arch-image.md) | Multi-arch image, amd64-first | Accepted |
| [0010](0010-auth-csrf-readiness.md) | Auth/CSRF/readiness enforcement (Node-runtime, no middleware) | Accepted |
