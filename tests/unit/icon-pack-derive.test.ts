import { describe, expect, it } from "vitest";
import {
  deriveIconKey,
  derivePackId,
  derivePackName,
  humanizeLabel,
  slugify,
} from "@/lib/icons/pack-derive";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("My Icons")).toBe("my-icons");
    expect(slugify("Sonarr_4K")).toBe("sonarr-4k");
    expect(slugify("  spaced  out  ")).toBe("spaced-out");
  });
  it("collapses runs and trims hyphens", () => {
    expect(slugify("a---b__c..d")).toBe("a-b-c-d");
    expect(slugify("--Plex--")).toBe("plex");
  });
  it("returns '' when nothing usable remains", () => {
    expect(slugify("***")).toBe("");
    expect(slugify("   ")).toBe("");
  });
  it("caps length to 64 without a trailing hyphen", () => {
    const out = slugify("x".repeat(70));
    expect(out.length).toBe(64);
  });
});

describe("deriveIconKey (filename → key)", () => {
  it("strips directory + extension and slugifies", () => {
    expect(deriveIconKey("truenas.png")).toBe("truenas");
    expect(deriveIconKey("sonarr-4k.png")).toBe("sonarr-4k");
    expect(deriveIconKey("nginx-proxy-manager.webp")).toBe("nginx-proxy-manager");
    expect(deriveIconKey("assets/Plex.PNG")).toBe("plex");
    expect(deriveIconKey("assets/sub/Home Assistant.webp")).toBe("home-assistant");
  });
});

describe("humanizeLabel (key → label)", () => {
  it("uses the known-name map where casing matters", () => {
    expect(humanizeLabel("truenas")).toBe("TrueNAS");
    expect(humanizeLabel("pfsense")).toBe("pfSense");
    expect(humanizeLabel("qbittorrent")).toBe("qBittorrent");
  });
  it("title-cases unknown words and fixes acronym/quality tokens", () => {
    expect(humanizeLabel("sonarr-4k")).toBe("Sonarr 4K");
    expect(humanizeLabel("nginx-proxy-manager")).toBe("Nginx Proxy Manager");
    expect(humanizeLabel("plex")).toBe("Plex");
    expect(humanizeLabel("my-api-ui")).toBe("My API UI");
  });
});

describe("derivePackId / derivePackName (zip filename)", () => {
  it("derives a slug id and humanised name", () => {
    expect(derivePackId("My Icons.zip")).toBe("my-icons");
    expect(derivePackName("My Icons.zip")).toBe("My Icons");
    expect(derivePackId("apps.ZIP")).toBe("apps");
    expect(derivePackName("apps.ZIP")).toBe("Apps");
  });
  it("strips any directory portion of the name", () => {
    expect(derivePackId("/tmp/uploads/Cool Pack.zip")).toBe("cool-pack");
  });
  it("returns null id / default name when the filename is unusable", () => {
    expect(derivePackId("***.zip")).toBeNull();
    expect(derivePackId(null)).toBeNull();
    expect(derivePackId(undefined)).toBeNull();
    expect(derivePackName("***.zip")).toBe("Imported Icons");
    expect(derivePackName(undefined)).toBe("Imported Icons");
  });
});
