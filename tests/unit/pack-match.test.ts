import { describe, expect, it } from "vitest";
import type { AppDTO, IconPackDTO, IconPackIconDTO } from "@/lib/types";
import { matchPackToApps } from "@/lib/icons/pack-match";
import { buildPackRef } from "@/lib/icons/resolve";
import { suggestIconKey } from "@/lib/icons/suggest";

/** Minimal AppDTO factory — the matcher only reads id/name/url/icon. */
function app(partial: Partial<AppDTO> & { id: number; name: string }): AppDTO {
  return {
    categoryId: null,
    url: "https://example.test",
    icon: null,
    description: null,
    openNewTab: true,
    isFavourite: false,
    authRequired: false,
    healthUrl: null,
    healthEnabled: false,
    healthInsecureTls: false,
    isHidden: false,
    lifecycle: "active",
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    latestHealth: null,
    ...partial,
  };
}

function icon(key: string, label?: string | null): IconPackIconDTO {
  return { key, label: label ?? null, variants: [] };
}

function pack(id: string, icons: IconPackIconDTO[]): IconPackDTO {
  return {
    id,
    name: id,
    version: "1.0.0",
    author: null,
    license: null,
    homepage: null,
    iconCount: icons.length,
    bytes: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    icons,
  };
}

const PLEX_PACK = pack("home", [icon("plex", "Plex"), icon("sonarr", "Sonarr")]);

describe("matchPackToApps — match kinds", () => {
  it("exact app name → icon key (high confidence)", () => {
    const [m] = matchPackToApps([app({ id: 1, name: "Plex" })], PLEX_PACK);
    expect(m?.iconKey).toBe("plex");
    expect(m?.confidence).toBe("high");
    expect(m?.reason).toBe("Exact name match");
  });

  it("matches on the icon label, not just the key", () => {
    const p = pack("home", [icon("media-server", "Plex")]);
    const [m] = matchPackToApps([app({ id: 1, name: "Plex" })], p);
    expect(m?.iconKey).toBe("media-server");
    expect(m?.confidence).toBe("high");
  });

  it("matches on the URL hostname (medium)", () => {
    const [m] = matchPackToApps(
      [app({ id: 1, name: "My Box", url: "https://plex.lan" })],
      PLEX_PACK,
    );
    expect(m?.iconKey).toBe("plex");
    expect(m?.confidence).toBe("medium");
    expect(m?.reason).toBe('URL address matches "plex"');
  });

  it("matches on a name substring (medium)", () => {
    const [m] = matchPackToApps([app({ id: 1, name: "Plexamp" })], PLEX_PACK);
    expect(m?.iconKey).toBe("plex");
    expect(m?.confidence).toBe("medium");
    expect(m?.reason).toBe('App name contains "plex"');
  });

  it("reverse-contains (icon name contains the app name) is low confidence", () => {
    const p = pack("home", [icon("plex-media-server")]);
    const [m] = matchPackToApps([app({ id: 1, name: "Plex" })], p);
    expect(m?.iconKey).toBe("plex-media-server");
    expect(m?.confidence).toBe("low");
    expect(m?.reason).toBe('Icon "plex-media-server" matches the app name');
  });

  it("returns no suggestion when nothing matches", () => {
    expect(matchPackToApps([app({ id: 1, name: "Zentrope Wibble" })], PLEX_PACK)).toEqual([]);
  });
});

describe("matchPackToApps — qualifier stripping (both directions)", () => {
  it("sonarr-4k icon ↔ Sonarr app", () => {
    const p = pack("home", [icon("sonarr-4k", "Sonarr 4K")]);
    const [m] = matchPackToApps([app({ id: 1, name: "Sonarr" })], p);
    expect(m?.iconKey).toBe("sonarr-4k");
    expect(m?.confidence).toBe("high");
  });

  it("Sonarr 4K app ↔ sonarr icon", () => {
    const [m] = matchPackToApps([app({ id: 1, name: "Sonarr 4K" })], PLEX_PACK);
    expect(m?.iconKey).toBe("sonarr");
    expect(m?.confidence).toBe("high");
  });
});

describe("matchPackToApps — selection + overwrite protection", () => {
  it("default-selects a confident match onto an app with no icon", () => {
    const [m] = matchPackToApps([app({ id: 1, name: "Plex", icon: null })], PLEX_PACK);
    expect(m?.currentIsCustomised).toBe(false);
    expect(m?.alreadySet).toBe(false);
    expect(m?.defaultSelected).toBe(true);
  });

  it("does NOT default-select a low-confidence match", () => {
    const p = pack("home", [icon("plex-media-server")]);
    const [m] = matchPackToApps([app({ id: 1, name: "Plex" })], p);
    expect(m?.confidence).toBe("low");
    expect(m?.defaultSelected).toBe(false);
  });

  it("flags an app with an existing icon as customised and unticked", () => {
    const [m] = matchPackToApps([app({ id: 1, name: "Plex", icon: "builtin:media" })], PLEX_PACK);
    expect(m?.currentIsCustomised).toBe(true);
    expect(m?.alreadySet).toBe(false);
    expect(m?.defaultSelected).toBe(false);
  });

  it("detects an app already using this exact pack ref (no-op)", () => {
    const [m] = matchPackToApps(
      [app({ id: 1, name: "Plex", icon: "pack:home/plex" })],
      PLEX_PACK,
    );
    expect(m?.alreadySet).toBe(true);
    expect(m?.currentIsCustomised).toBe(false);
    expect(m?.defaultSelected).toBe(false);
  });

  it("an app using a DIFFERENT pack icon is customised (would be replaced)", () => {
    const [m] = matchPackToApps(
      [app({ id: 1, name: "Plex", icon: "pack:home/sonarr" })],
      PLEX_PACK,
    );
    expect(m?.alreadySet).toBe(false);
    expect(m?.currentIsCustomised).toBe(true);
  });
});

describe("matchPackToApps — override target ref", () => {
  it("builds the pack ref for a manually chosen key", () => {
    // The UI lets the user override the suggested key; the resulting ref is just
    // buildPackRef(packId, chosenKey).
    expect(buildPackRef("home", "sonarr")).toBe("pack:home/sonarr");
    const [m] = matchPackToApps([app({ id: 1, name: "Plex" })], PLEX_PACK);
    expect(buildPackRef(PLEX_PACK.id, m!.iconKey)).toBe("pack:home/plex");
  });
});

describe("suggestIconKey — unchanged after match-core refactor (regression)", () => {
  const cases: [string, string][] = [
    ["Plex", "media"],
    ["Sonarr 4K", "media"],
    ["qBittorrent", "download"],
    ["Portainer", "container"],
    ["Vaultwarden", "identity"],
  ];
  it.each(cases)("%s → %s", (name, key) => {
    expect(suggestIconKey(name)).toBe(key);
  });
  it("still matches on hostname and returns null for nonsense", () => {
    expect(suggestIconKey("My Box", "https://portainer.example.com")).toBe("container");
    expect(suggestIconKey("Zentrope Wibble")).toBeNull();
  });
});
