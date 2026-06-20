# 0007 — Optional single-user auth (on by default)

**Status:** Accepted · 2026-06-20

## Context
A command centre may be exposed via reverse proxy or Tailscale. It needs
protection by default, but some users run it only on a trusted network and want
no login. v0.1 is single-user (no multi-user/RBAC).

## Decision
Ship optional single-admin auth: a username + Argon2id password hash, cookie
sessions. On by default; skippable during setup for trusted networks. The schema
(`users`, `sessions`) is present from v0.1; enforcement (middleware + login UI)
lands in the v0.1 hardening phase. All state-changing API routes get same-origin
+ CSRF protection regardless of whether auth is enabled.

## Consequences
- Secure-by-default without forcing friction on LAN-only users.
- No multi-user, roles, or SSO in v0.1 — explicitly deferred.
