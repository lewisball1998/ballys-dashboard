import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { zipSync } from "fflate";
import { db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { appHealth, apps, iconPacks, iconPackIcons } from "@/db/schema";
import { applyPackMatches, importIconPack } from "@/server/services/icon-packs";
import { createApp, getApp } from "@/server/services/apps";
import { POST as applyRoute } from "@/app/api/icons/packs/[packId]/apply/route";

let iconsDir: string;

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
function png(tag: number): Uint8Array {
  return new Uint8Array([...PNG_MAGIC, tag, tag + 1]);
}
function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** A small "home" pack with plex (+4k variant) and sonarr. */
function homePack(): Buffer {
  return Buffer.from(
    zipSync({
      "assets/plex.png": png(1),
      "assets/plex-4k.png": png(2),
      "assets/sonarr.png": png(3),
      "manifest.json": utf8(
        JSON.stringify({
          manifestVersion: 1,
          id: "home",
          name: "Home",
          version: "1.0.0",
          icons: [
            { key: "plex", label: "Plex", file: "assets/plex.png", variants: { "4k": "assets/plex-4k.png" } },
            { key: "sonarr", label: "Sonarr", file: "assets/sonarr.png" },
          ],
        }),
      ),
    }),
  );
}

beforeAll(() => {
  iconsDir = mkdtempSync(join(tmpdir(), "ballys-match-"));
  process.env.ICONS_DIR = iconsDir;
  runMigrations();
});

afterAll(() => {
  rmSync(iconsDir, { recursive: true, force: true });
  delete process.env.ICONS_DIR;
});

beforeEach(() => {
  db.delete(appHealth).run();
  db.delete(apps).run();
  db.delete(iconPackIcons).run();
  db.delete(iconPacks).run();
  rmSync(join(iconsDir, "packs"), { recursive: true, force: true });
  importIconPack(homePack());
});

describe("applyPackMatches service", () => {
  it("applies only the selected assignment and leaves other apps untouched", () => {
    const plex = createApp({ name: "Plex", url: "https://plex.test" });
    const sonarr = createApp({ name: "Sonarr", url: "https://sonarr.test" });

    const res = applyPackMatches("home", { assignments: [{ appId: plex.id, iconKey: "plex" }] });

    expect(res?.applied).toBe(1);
    expect(res?.skipped).toBe(0);
    expect(res?.failed).toBe(0);
    expect(res?.outcomes[0]).toMatchObject({ appId: plex.id, status: "applied", icon: "pack:home/plex" });
    expect(getApp(plex.id)?.icon).toBe("pack:home/plex");
    expect(getApp(sonarr.id)?.icon).toBeNull();
  });

  it("skips an app with an existing icon unless overwriteCustomised is set", () => {
    const app = createApp({ name: "Plex", url: "https://plex.test", icon: "builtin:media" });

    const skip = applyPackMatches("home", { assignments: [{ appId: app.id, iconKey: "plex" }] });
    expect(skip?.applied).toBe(0);
    expect(skip?.skipped).toBe(1);
    expect(skip?.outcomes[0]?.status).toBe("skipped");
    expect(getApp(app.id)?.icon).toBe("builtin:media");

    const force = applyPackMatches("home", {
      assignments: [{ appId: app.id, iconKey: "plex" }],
      overwriteCustomised: true,
    });
    expect(force?.applied).toBe(1);
    expect(getApp(app.id)?.icon).toBe("pack:home/plex");
  });

  it("treats an app already on the exact ref as a no-op (already set)", () => {
    const app = createApp({ name: "Plex", url: "https://plex.test", icon: "pack:home/plex" });
    const res = applyPackMatches("home", { assignments: [{ appId: app.id, iconKey: "plex" }] });
    expect(res?.applied).toBe(0);
    expect(res?.skipped).toBe(1);
    expect(res?.outcomes[0]?.message).toBe("Already set");
    expect(getApp(app.id)?.icon).toBe("pack:home/plex");
  });

  it("skips an unknown icon key", () => {
    const app = createApp({ name: "Ghost", url: "https://ghost.test" });
    const res = applyPackMatches("home", { assignments: [{ appId: app.id, iconKey: "ghost" }] });
    expect(res?.applied).toBe(0);
    expect(res?.skipped).toBe(1);
    expect(res?.outcomes[0]?.message).toContain("not in this pack");
    expect(getApp(app.id)?.icon).toBeNull();
  });

  it("skips an app that does not exist", () => {
    const res = applyPackMatches("home", { assignments: [{ appId: 999_999, iconKey: "plex" }] });
    expect(res?.skipped).toBe(1);
    expect(res?.outcomes[0]?.message).toBe("App not found");
  });

  it("applies a declared variant and falls back to base when the variant is absent", () => {
    const a = createApp({ name: "A", url: "https://a.test" });
    const b = createApp({ name: "B", url: "https://b.test" });

    const res = applyPackMatches("home", {
      assignments: [
        { appId: a.id, iconKey: "plex", variant: "4k" },
        { appId: b.id, iconKey: "plex", variant: "missing" },
      ],
    });
    expect(res?.applied).toBe(2);
    expect(getApp(a.id)?.icon).toBe("pack:home/plex?v=4k");
    expect(getApp(b.id)?.icon).toBe("pack:home/plex"); // safe fallback to base
  });

  it("reports correct per-item counts across a mixed batch", () => {
    const ok = createApp({ name: "Plex", url: "https://plex.test" });
    const custom = createApp({ name: "Sonarr", url: "https://sonarr.test", icon: "builtin:media" });
    const res = applyPackMatches("home", {
      assignments: [
        { appId: ok.id, iconKey: "plex" },
        { appId: custom.id, iconKey: "sonarr" },
        { appId: 999_999, iconKey: "plex" },
      ],
    });
    expect(res?.applied).toBe(1);
    expect(res?.skipped).toBe(2);
    expect(res?.failed).toBe(0);
  });

  it("returns null for an unknown pack (→ route 404)", () => {
    const app = createApp({ name: "Plex", url: "https://plex.test" });
    expect(applyPackMatches("ghost-pack", { assignments: [{ appId: app.id, iconKey: "plex" }] })).toBeNull();
  });
});

describe("apply route — CSRF + 404", () => {
  function req(headers: Record<string, string>, body: unknown): NextRequest {
    return new NextRequest("http://localhost/api/icons/packs/home/apply", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  }
  const ctx = (packId: string) => ({ params: Promise.resolve({ packId }) });

  it("blocks a cross-origin (no Origin) request with 403", async () => {
    const res = await applyRoute(req({}, { assignments: [{ appId: 1, iconKey: "plex" }] }), ctx("home"));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("csrf_failed");
  });

  it("allows a same-origin request and applies", async () => {
    const app = createApp({ name: "Plex", url: "https://plex.test" });
    const res = await applyRoute(
      req({ origin: "http://localhost", host: "localhost" }, { assignments: [{ appId: app.id, iconKey: "plex" }] }),
      ctx("home"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.applied).toBe(1);
    expect(getApp(app.id)?.icon).toBe("pack:home/plex");
  });

  it("returns 404 for an unknown pack", async () => {
    const res = await applyRoute(
      req({ origin: "http://localhost", host: "localhost" }, { assignments: [{ appId: 1, iconKey: "plex" }] }),
      ctx("ghost-pack"),
    );
    expect(res.status).toBe(404);
  });
});
