# Docker Command Centre

The **Docker** page lets you view your Docker containers and perform safe
lifecycle actions — **start**, **stop**, and **restart** — without leaving the
dashboard. It is designed to be useful out of the box once Docker access is
granted, and to fail gracefully (with a clear message) when it is not.

> **Privileged feature, opt-in by design.** Talking to Docker means mounting the
> Docker socket, which grants **root-equivalent control of the host**. For that
> reason it is **off by default** (see [ADR 0008](adr/0008-container-metrics-and-docker-socket.md)).
> Only enable it on hosts you trust, behind authentication / a private network.

## What it shows

Containers are grouped by Compose project (standalone containers are grouped
last). For each container you see:

- **Name** and **image**
- **State** — running · exited · restarting · paused · created · dead · unknown
- **Health** — healthy · unhealthy · health: starting (only when the image
  defines a `HEALTHCHECK`)
- **Published ports** (e.g. `8080→80/tcp`)
- **Compose service** label, when present
- **Status / created** text from the daemon (e.g. "Up 3 hours")

A summary strip shows totals for running / stopped / restarting / unhealthy so
you can scan health at a glance.

## What it can do (and deliberately cannot)

**Allowed actions:** start, stop, restart a container. Stop and restart require
an explicit in-card confirmation.

**Intentionally not included** (and not reachable through the API):

- No container terminal / `exec`
- No arbitrary shell or command execution
- No image pull / update / delete / prune
- No volume or network creation / deletion
- No Compose stack deletion
- No host filesystem browsing
- No other host controls

All Docker logic runs **server-side only**. The browser only ever receives a
safe subset of fields — never the socket path, host IP bindings, mounts /
filesystem paths, environment variables, or full command lines.

## Import apps from Docker (v0.2.1)

The **Apps** page has an **Import from Docker** button that turns detected
containers into launcher entries. It reuses the same read-only container data as
the Command Centre — it adds **no** new Docker capability (no lifecycle, exec,
image, volume, network, or stack operations); it only reads metadata and creates
app rows.

The flow is deliberately **selective** — nothing is imported automatically:

1. Containers are listed as **import candidates** with read-only hints (name,
   image, state, health, published ports, compose project/service).
2. For each candidate the server suggests an **app name** and, when a port is
   published, a **suggested URL**. Suggestions use `localhost` and are **just a
   guess** — you are expected to edit them (e.g. to a reverse-proxy URL like
   `https://plex.example.com`). When no clear port exists the URL is left blank
   and you must fill it in (a valid `http(s)` URL is required to import).
3. Nothing is selected by default. Tick the containers you want (or **Select
   all**), then edit each one's **name, URL, health URL, category, favourite,
   health-checks, and trusted-internal TLS** before importing.
4. A **review step** lists exactly what will be created; apps are only created
   after you confirm.
5. A **result summary** reports imported / skipped (duplicate) / failed counts.

**Likely-internal hint.** Databases, caches, and other helper/infrastructure
containers are flagged "Likely internal service" (by image or name) so you don't
import them by accident — but they are **never hidden**; you can still select
them.

**Duplicate protection.** An app that matches an existing app by URL or name
(case-insensitive) is flagged "Already in Apps" and is **skipped** at import
rather than silently duplicated — both against existing apps and against other
items in the same batch. (Duplicate detection is by name/URL only: v0.2.1 does
not add a DB column to persist the source container id, so re-importing a
container whose app you later renamed is not detected. Importing remains
reversible only through normal app management — there is no bulk delete.)

## Enabling Docker access (Docker Compose)

The socket is **not** mounted by default. To turn the feature on, mount it into
the dashboard container. Because the container runs non-root with all Linux
capabilities dropped, it must also join the host's `docker` group.

1. Find your host's `docker` group id:

   ```bash
   getent group docker | cut -d: -f3
   ```

2. In `docker-compose.yml`, add the socket mount and `group_add` (see the
   commented block in that file). A read-only mount (`:ro`) is sufficient for
   list + start/stop/restart:

   ```yaml
   services:
     ballys-dashboard:
       volumes:
         - ./data:/app/data
         - /var/run/docker.sock:/var/run/docker.sock:ro
       group_add:
         - "999" # <- your docker GID from step 1
   ```

3. Recreate the container:

   ```bash
   docker compose up -d --force-recreate
   ```

Open the **Docker** page — your containers should now be listed.

### Custom socket path

If your socket lives elsewhere (e.g. rootless Docker, or a proxy), set
`DOCKER_SOCKET_PATH` and mount that path into the container:

```yaml
environment:
  DOCKER_SOCKET_PATH: /run/user/1000/docker.sock
```

Default: `/var/run/docker.sock`.

### Safer alternative: a socket proxy

For least privilege, put a read-only Docker **socket proxy** (e.g.
`tecnativa/docker-socket-proxy`) in front of the daemon, allow only the
container + start/stop/restart endpoints, and point `DOCKER_SOCKET_PATH` /
mount at the proxy instead of the raw socket.

## Unavailable & error states

The page always renders a clear state rather than a blank screen or a raw error:

| State | When | What you see |
| --- | --- | --- |
| **Not configured** | Socket missing (`ENOENT`) | Guidance to mount the socket |
| **Permission denied** | Socket present but not allowed (`EACCES`) | Guidance to add the `docker` group |
| **Unreachable** | Daemon not responding / timed out | Prompt to check Docker is running |
| **Error** | Unexpected daemon response | Generic error with details |
| **No containers** | Connected, nothing to show | Empty state with refresh |

The container list endpoint returns HTTP 200 with an `availability` field even
when Docker is down, so the UI can explain *why* rather than just failing.

## Security summary

- Off by default; mounting the socket is an explicit, documented opt-in.
- Read-only socket mount is sufficient for the supported actions.
- All actions are **POST**, **same-origin (CSRF) protected**, and require auth
  when auth is enabled.
- Container identifiers are validated (`^[a-f0-9]{12,64}$`) before any action.
- Only start/stop/restart are exposed — no destructive or host-level operations.
