import { describe, expect, it } from "vitest";
import { suggestIconKey } from "@/lib/icons/suggest";

describe("suggestIconKey — approved v0.2.7 mappings", () => {
  // [app name, expected key] — the canonical mapping table from the v0.2.7 brief.
  const cases: [string, string][] = [
    ["Plex", "media"],
    ["Jellyfin", "media"],
    ["Sonarr", "media"],
    ["Prowlarr", "indexer"],
    ["Jackett", "indexer"],
    ["qBittorrent", "download"],
    ["SABnzbd", "download"],
    ["Traefik", "proxy"],
    ["Nginx Proxy Manager", "proxy"],
    ["Caddy", "proxy"],
    ["Authelia", "identity"],
    ["Authentik", "identity"],
    ["Keycloak", "identity"],
    ["Vaultwarden", "identity"],
    ["Portainer", "container"],
    ["Proxmox", "server"],
    ["Grafana", "chart"],
    ["Uptime Kuma", "monitor"],
    ["Gitea", "code"],
    ["PostgreSQL", "database"],
    ["Nextcloud", "cloud"],
    ["MinIO", "storage"],
    ["TrueNAS", "storage"],
    ["Duplicati", "backup"],
    ["Joplin", "notes"],
    ["BookStack", "book"],
    ["Firefly III", "finance"],
    ["Actual Budget", "finance"],
    ["FreshRSS", "rss"],
    ["SearXNG", "search"],
    ["Ollama", "ai"],
    ["Open WebUI", "ai"],
    ["AnythingLLM", "ai"],
    ["ComfyUI", "ai"],
    ["Home Assistant", "home"],
    ["Node-RED", "automation"],
    ["ESPHome", "automation"],
    ["Frigate", "camera"],
    ["Scrypted", "camera"],
  ];

  it.each(cases)("%s → %s", (name, key) => {
    expect(suggestIconKey(name)).toBe(key);
  });
});

describe("suggestIconKey — 4K / multi-instance qualifier stripping", () => {
  const cases: [string, string][] = [
    ["Sonarr 4K", "media"],
    ["Radarr 4K", "media"],
    ["Radarr-Anime", "media"],
    ["Sonarr (Kids)", "media"],
    ["Sonarr - UHD", "media"],
    ["Radarr Anime 4K", "media"],
    ["Sonarr 2", "media"],
    ["Radarr 3", "media"],
    ["Sonarr Main", "media"],
    ["Radarr Alt", "media"],
    ["Movies 4K", "media"], // "movies" is a base alias, not a qualifier — kept
    ["Lidarr Music", "music"],
    ["Readarr Audiobooks", "book"],
  ];

  it.each(cases)("%s → %s", (name, key) => {
    expect(suggestIconKey(name)).toBe(key);
  });

  it("never strips to empty: a bare qualifier keeps its token and simply finds no match", () => {
    expect(suggestIconKey("4K")).toBeNull();
    expect(suggestIconKey("HD")).toBeNull();
  });
});

describe("suggestIconKey — no short-alias bleed / disambiguation", () => {
  it("'Plex Media Server' stays media (no generic 'server' alias)", () => {
    expect(suggestIconKey("Plex Media Server")).toBe("media");
  });
  it("'Speedtest Tracker' → chart (not indexer — 'tracker' is not an alias)", () => {
    expect(suggestIconKey("Speedtest Tracker")).toBe("chart");
  });
  it("Home Assistant stays home; its companion tooling is automation", () => {
    expect(suggestIconKey("Home Assistant")).toBe("home");
    expect(suggestIconKey("Zigbee2MQTT")).toBe("automation");
    expect(suggestIconKey("Mosquitto")).toBe("automation");
  });
  it("identity tools resolve to identity, not shield", () => {
    expect(suggestIconKey("Vaultwarden")).toBe("identity");
    expect(suggestIconKey("Keycloak")).toBe("identity");
  });
});

describe("suggestIconKey — base behaviour preserved", () => {
  it("matches on URL hostname", () => {
    expect(suggestIconKey("My Box", "https://portainer.example.com")).toBe("container");
  });
  it("returns null when nothing sensible matches", () => {
    expect(suggestIconKey("Zentrope Wibble")).toBeNull();
    expect(suggestIconKey("")).toBeNull();
    expect(suggestIconKey("", null)).toBeNull();
  });
  it("is case/punctuation insensitive", () => {
    expect(suggestIconKey("  JELLYFIN!! ")).toBe("media");
  });
});
