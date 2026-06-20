# Health checks

Bally's Dashboard can monitor each app with a periodic HTTP(S) health check and
show an Up / Degraded / Down status. This page explains how checks behave and how
to make them work for common homelab / NAS deployments.

> These checks are designed to be generic. Replace any example hostnames, IPs, or
> domains below with your own — nothing here is tied to a specific NAS, domain, or
> network.

## Health URL behaviour

- **The Health URL is optional.** If you leave it blank, the dashboard uses the
  app's main URL for the health check.
- You can set a dedicated Health URL (for example a lightweight `/health` or
  `/api/health` endpoint) when the main page is heavy or always redirects.
- A check counts as **Up** for a `2xx`/`3xx` response, **Degraded** for `4xx`,
  and **Down** for `5xx` or a connection/TLS failure.

### Checks run from the server, not your browser

Health checks are performed **from inside the Bally's Dashboard container/server
runtime**, not from your browser. This is the single most common source of
confusion:

> A URL that opens fine in your browser can still fail the health check.

Your browser and the dashboard container can resolve names and reach the network
differently. A check that works in the browser but fails here is usually caused
by one of:

- **DNS** — the container can't resolve the hostname (see *Local DNS* below).
- **Routing / firewall** — the target isn't reachable from the container's
  network.
- **TLS** — the certificate isn't trusted inside the container (see
  *Self-signed / internal TLS* below).
- **Docker networking** — `localhost` inside the container is the container
  itself, not your host. Use a LAN IP or a resolvable hostname instead of
  `localhost`/`127.0.0.1` for services running outside this container.

## Local DNS / `extra_hosts`

If your services use local-only domain names (e.g. a `*.local` or internal
domain) that the container can't resolve, you can map those names to IPs for the
dashboard container using Docker Compose's `extra_hosts`.

This is a **per-deployment workaround**, not a product default — only add it if
your container genuinely can't resolve a name it needs.

```yaml
# docker-compose.yml (example only — use your own hostname and IP)
services:
  ballys-dashboard:
    extra_hosts:
      - "nas.example.local:192.168.1.10"
```

Replace `nas.example.local` and `192.168.1.10` with your own service's hostname
and IP address. Add one line per name you need to resolve. The dashboard does not
ship any `extra_hosts` entries by default.

## Self-signed / internal TLS

Secure TLS verification is **on by default**, and that default should stay on for
anything reachable over the public internet.

However, many NAS boxes and admin panels serve HTTPS with a **self-signed or
internal certificate** that the container won't trust. For those, enable the
per-app option in the app's edit form:

> **Allow self-signed TLS for this health check**

Guidelines:

- It is a **per-app** setting — it only affects that one app's health check.
- It skips certificate verification for **that check only**. Every other app's
  check keeps full TLS verification.
- Use it **only for trusted internal services** you control.
- It is never the default, and it never affects apps reachable over the internet.

For services reachable over the **public internet**, leave this option off and
keep strict TLS verification — a self-signed/untrusted cert there is a real
warning sign, not something to bypass.

**Do not** globally disable TLS verification (for example by setting
`NODE_TLS_REJECT_UNAUTHORIZED=0`). That would weaken *every* outbound check and
defeats the purpose of the per-app option.

### Other options for internal certs

- You don't have to turn off health checks just because a service uses a
  self-signed or privately-signed certificate — the per-app option above exists
  precisely so monitoring keeps working. Disabling an app's health check is still
  available, but it's a fallback, not the only workaround.
- **Future:** support for a custom trusted CA certificate is planned, so services
  signed by your own private CA can be verified properly (strict verification)
  instead of skipping checks. Until then, use the per-app self-signed option for
  trusted internal services.

## Health diagnostics

When a check fails, the dashboard records a short, safe reason so you can tell
*why* it failed. Common reasons:

| Reason                  | What it usually means                                                        |
| ----------------------- | ---------------------------------------------------------------------------- |
| **DNS lookup failed**   | The container can't resolve the hostname. See *Local DNS / `extra_hosts`*.   |
| **Connection refused**  | Nothing is listening on that host/port, or a firewall rejected the request.  |
| **Connection timed out**| No response within the timeout — host unreachable, wrong port, or filtered.  |
| **TLS/certificate error** | The certificate couldn't be validated (expired, wrong hostname, untrusted CA). |
| **Self-signed certificate** | The endpoint uses a self-signed cert. Enable *Allow self-signed TLS* if you trust it. |
| **Non-2xx HTTP response** | The service responded but with an error status (e.g. `404`, `502`).        |
| **Invalid URL**         | The URL couldn't be parsed, or uses an unsupported scheme (only `http`/`https`). |

Diagnostic messages are intentionally concise and never include secrets, API
keys, raw stack traces, or internal network details.
