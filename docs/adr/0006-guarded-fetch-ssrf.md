# 0006 — Guarded fetch as the single SSRF chokepoint

**Status:** Accepted · 2026-06-20

## Context
The product makes outbound HTTP requests to user-supplied URLs (app health
checks now; module APIs later). That is an SSRF surface. But its core purpose is
reaching LAN services, so naively blocking private IPs would break the product.

## Decision
Route every user-influenced outbound request through one wrapper
(`src/server/http/guarded-fetch.ts`). It ALWAYS enforces: http(s)-only protocol,
a total timeout, a redirect cap with per-hop re-validation, and a response-size
cap. Private/reserved-IP blocking is OPT-IN (`privateNetwork: "block"`) because
admin-entered LAN URLs are expected; remote/untrusted fetches opt into blocking.

## Consequences
- One auditable place for all egress policy; QA's primary review target.
- Default `allow` keeps LAN health checks working; stricter contexts tighten
  per-call.
- Known limitation: DNS is resolved at validation then fetched by hostname, so a
  rebinding race is possible in `block` mode. Documented; pinning to the resolved
  IP is future hardening.
