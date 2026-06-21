import { describe, expect, it } from "vitest";
import { suggestIconKey } from "@/lib/icons/suggest";

describe("suggestIconKey", () => {
  it("matches common self-hosted app names to a generic glyph", () => {
    expect(suggestIconKey("Plex")).toBe("media");
    expect(suggestIconKey("Sonarr")).toBe("media");
    expect(suggestIconKey("qBittorrent")).toBe("download");
    expect(suggestIconKey("Pi-hole")).toBe("shield");
    expect(suggestIconKey("Grafana")).toBe("chart");
    expect(suggestIconKey("Portainer")).toBe("container");
    expect(suggestIconKey("Immich")).toBe("photo");
  });

  it("can match on the URL hostname", () => {
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
