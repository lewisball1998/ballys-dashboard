# 0010 — Auth, CSRF, and readiness enforcement model

**Status:** Accepted · 2026-06-20

## Context
v0.1 hardening needs optional single-user auth, CSRF protection, and a readiness
signal. `better-sqlite3` is a native, Node-only module, so Next.js **Edge
middleware cannot validate DB-backed sessions**.

## Decision
- **Enforce in the Node runtime, never in middleware.** API protection lives in
  `route()` / `protectedRoute()` (route handlers run in Node); page protection is
  a client-side gate (`AuthGate`) using `GET /api/auth/session`.
- **Auth:** single admin, optional via the `authEnabled` setting (on by default,
  skippable in setup). scrypt password hashing (node:crypto — zero deps,
  multi-arch). Cookie carries a random token; the DB stores `sha256(token)`.
  30-day sliding expiry. Auth is *active* only when enabled **and** an admin
  exists **and** `AUTH_DISABLE` is unset — preventing lockout in the bootstrap
  state. `AUTH_DISABLE=1` is a recovery escape hatch (CSRF still applies).
- **CSRF:** same-origin check in `route()` for `POST`/`PATCH`/`DELETE` (Origin host
  vs `x-forwarded-host` ?? `host` ?? URL host) → `403`. Combined with
  `SameSite=Lax` cookies. No token plumbing.
- **Readiness:** `/api/health/ready` runs `SELECT 1` (200/503); `/api/health`
  stays dependency-free liveness. Docker `HEALTHCHECK` targets readiness.

## Consequences
- Secure-by-default without forcing friction on trusted LANs.
- Cookies are only `Secure` over HTTPS, so plain-HTTP LAN logins work; remote
  access should use Tailscale/VPN or a TLS proxy.
- scrypt (not Argon2id) for v0.1; revisitable later with `@node-rs/argon2`.
