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
| [0011](0011-dashboard-layout-customisation.md) | Dashboard layout customisation | Accepted |
| [0012](0012-individual-app-widgets.md) | Individual app dashboard widgets | Accepted |
| [0013](0013-app-icon-library.md) | App icon library & custom icons | Accepted |
| [0014](0014-icon-policy-and-pack-import.md) | Icon coverage policy & future icon-pack import | Accepted (import design realised by 0015) |
| [0015](0015-user-icon-pack-import.md) | User icon-pack import (as built) | Accepted |
| [0016](0016-icon-pack-app-matching.md) | Icon pack app matching (suggest, review, bulk apply) | Accepted |
| [0017](0017-infrastructure-hardware-telemetry.md) | Infrastructure & hardware telemetry (read-only, local) | Accepted |
| [0018](0018-truenas-readonly-telemetry.md) | TrueNAS read-only telemetry provider | Accepted |
