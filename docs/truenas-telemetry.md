# TrueNAS telemetry (read-only)

Bally's Dashboard can enrich the **Infrastructure** page with **read-only**
telemetry from a TrueNAS host. It is fully **optional**: when it is not
configured, the page works exactly as before and TrueNAS is shown as
*not configured*.

> **Read-only by design.** This provider only *reads* telemetry. It performs **no**
> write actions, pool/dataset management, SMART test triggering, scrub triggering,
> alert acknowledgement, shell commands, or host-filesystem browsing.

## What it shows

Where your TrueNAS version exposes it:

- **NAS pools** — name, health/status (e.g. `ONLINE` / `DEGRADED`), and used / free
  / total capacity.
- **Datasets** — dataset label (e.g. `tank/media`) with used / total capacity where
  available. (Host mountpoints such as `/mnt/...` are never shown.)
- **Disk inventory** — device name, model, size, and type.
- **Drive temperatures** — where TrueNAS reports them, using the same severity
  bands as the rest of the page (normal `<45°C`, warning `45–54°C`, critical `≥55°C`).
- **SMART-style health** — overall passed / failing status and the last test time
  where available.
- **Masked disk serials only** — e.g. `WD…4567`. Full serial numbers are **never**
  sent to the browser.
- **Source status & last refresh** — the TrueNAS telemetry source is shown as
  *Connected*, *Partial*, *Unavailable*, or *Not configured*, with the time of the
  last successful read.

NAS storage is shown in its **own section**, kept clearly separate from the
app/container (local) storage above it.

## What it does **not** do

- ❌ No write actions of any kind.
- ❌ No pool creation / deletion / editing.
- ❌ No dataset creation / deletion / editing.
- ❌ No disk operations.
- ❌ No SMART test triggering.
- ❌ No scrub triggering.
- ❌ No alert acknowledgement.
- ❌ No shell command execution.
- ❌ No host-filesystem browsing.

## Configuration

Set these environment variables on the **Bally's Dashboard** server/container
(see [`.env.example`](../.env.example)). Use **placeholders / your own values** —
never commit a real key.

| Variable                | Required | Default        | Purpose                                                                 |
| ----------------------- | -------- | -------------- | ----------------------------------------------------------------------- |
| `TRUENAS_URL`           | yes      | —              | TrueNAS Web UI/API URL reachable from the dashboard server.             |
| `TRUENAS_API_KEY`       | yes      | —              | API key (read-only / least-privilege). **Server-side only.**            |
| `TRUENAS_API_PATH`      | no       | `/api/current` | JSON-RPC WebSocket path on the TrueNAS host.                            |
| `TRUENAS_ALLOW_INSECURE`| no       | `false`        | Skip TLS verification for the TrueNAS connection only (self-signed).    |

Example (placeholders only):

```bash
TRUENAS_URL=https://your-truenas-host:443
TRUENAS_API_KEY=replace-with-your-key
TRUENAS_API_PATH=/api/current
TRUENAS_ALLOW_INSECURE=false
```

`TRUENAS_URL` should normally point at the TrueNAS Web UI / API endpoint reachable
from wherever Bally's Dashboard runs. The dashboard converts it to the matching
WebSocket endpoint internally (`https → wss`, `http → ws`) and appends
`TRUENAS_API_PATH`.

**After changing any environment variable, restart / redeploy Bally's Dashboard.**

## How to create a TrueNAS API key

1. Sign in to the TrueNAS web UI.
2. Open the **top-right** settings / account menu.
3. Open **API Keys** (or **My API Keys**, depending on your TrueNAS version).
4. Choose **Add** / **Create API Key**.
5. Give it a descriptive name, e.g. `Ballys Dashboard Read-only Telemetry`.
6. Create the key.
7. **Copy the key immediately and store it securely** — TrueNAS only displays the
   key string **once**.
8. Add it to the Bally's Dashboard environment as `TRUENAS_API_KEY`.
9. Restart / redeploy Bally's Dashboard after changing env vars.

## Security guidance

- Prefer a **dedicated service account** for Bally's Dashboard where possible.
- Use the **least privileges** that still allow read-only telemetry.
- Treat the API key **like a password**.
- **Do not commit** the API key to git, and do not paste it into screenshots,
  logs, examples, tests, or support chats.
- **Rotate / delete** the API key immediately if it is ever exposed.
- The dashboard never sends the API key, the TrueNAS URL, or raw backend errors to
  the browser, and never logs the key.
- Full disk serial numbers are never shown in the UI — only masked serials.

### TLS / self-signed certificates

TLS certificates are **verified by default**. TrueNAS ships a self-signed
certificate out of the box, so a default install will not verify.

- **Best:** install a trusted certificate on TrueNAS, or front it with a reverse
  proxy that terminates TLS with a valid cert, and keep `TRUENAS_ALLOW_INSECURE=false`.
- **Trusted local / homelab only:** set `TRUENAS_ALLOW_INSECURE=true` to skip
  certificate verification. This bypass applies to the **TrueNAS connection only**
  — it never weakens TLS for anything else and never uses
  `NODE_TLS_REJECT_UNAUTHORIZED`. Only use it on a network you trust.

## API compatibility & supported versions

- The provider uses the **current TrueNAS SCALE middleware API** — JSON-RPC 2.0
  over a WebSocket at `/api/current` (the default `TRUENAS_API_PATH`).
- The legacy `/api/v2.0` REST routes are intentionally **not** used; TrueNAS REST
  compatibility has changed across versions and those routes are not future-proof.
- **Known-tested against:** modern TrueNAS SCALE (24.10 *Electric Eel* and later,
  including 25.x). Earlier versions that pre-date the JSON-RPC `/api/current`
  endpoint are not supported and will report the source as *unavailable*.
- The provider is **defensive**: if a method or field is missing on your version,
  it returns whatever it could read and shows the source as **partial** rather than
  failing the page.

## Troubleshooting

| Symptom                                   | What it means / what to do                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| Source shows **Not configured**           | `TRUENAS_URL` and/or `TRUENAS_API_KEY` are unset. Set both and restart.                 |
| Source shows **Unavailable**              | Wrong URL/port/path, the host is unreachable, or (on a default install) a self-signed cert is being rejected. Check the URL and consider `TRUENAS_ALLOW_INSECURE=true` for trusted local use. |
| Source shows **Unavailable** (auth)       | The API key was rejected. Recreate a read-only key and update `TRUENAS_API_KEY`.        |
| Source shows **Partial**                  | Connected, but some telemetry isn't exposed on your TrueNAS version. This is expected and safe. |
| No pool / SMART data, page still fine     | TrueNAS didn't return that data; the page renders with a calm unavailable state.        |

Missing or unknown telemetry is always treated as **unavailable** — never a false
**critical**.
