import { describe, expect, it } from "vitest";
import type { DockerContainerDTO } from "@/lib/types";
import {
  buildCandidate,
  findDuplicate,
  indexExistingApps,
  internalHint,
  normalizeUrlForCompare,
  prettifyName,
  suggestAppName,
  suggestUrlFromPorts,
} from "@/server/services/docker-import";
import { dockerImportSchema } from "@/lib/validation";

function container(overrides: Partial<DockerContainerDTO> = {}): DockerContainerDTO {
  return {
    id: "a".repeat(64),
    shortId: "a".repeat(12),
    name: "my-app",
    image: "ghcr.io/owner/my-app:latest",
    state: "running",
    status: "Up 3 hours",
    health: "none",
    ports: [],
    composeProject: null,
    composeService: null,
    createdAt: new Date(0).toISOString(),
    ...overrides,
  };
}

describe("docker-import — suggestions", () => {
  it("prettifies docker identifiers", () => {
    expect(prettifyName("gym-tracker")).toBe("Gym Tracker");
    expect(prettifyName("/web_nginx")).toBe("Web Nginx");
    expect(prettifyName("plex")).toBe("Plex");
    expect(prettifyName("  ")).toBe("App");
  });

  it("prefers the compose service for the suggested name", () => {
    expect(suggestAppName(container({ name: "media-plex-1", composeService: "plex" }))).toBe("Plex");
    expect(suggestAppName(container({ name: "standalone-thing" }))).toBe("Standalone Thing");
  });

  it("suggests a URL from published ports, preferring web ports", () => {
    expect(suggestUrlFromPorts([{ privatePort: 9000, publicPort: 32000, type: "tcp" }])).toBe(
      "http://localhost:32000",
    );
    // 80 wins over a random high port
    expect(
      suggestUrlFromPorts([
        { privatePort: 9000, publicPort: 32000, type: "tcp" },
        { privatePort: 80, publicPort: 80, type: "tcp" },
      ]),
    ).toBe("http://localhost:80");
    // 443 → https with the default port omitted
    expect(suggestUrlFromPorts([{ privatePort: 443, publicPort: 443, type: "tcp" }])).toBe(
      "https://localhost",
    );
  });

  it("returns null when no port is published", () => {
    expect(suggestUrlFromPorts([])).toBeNull();
    expect(suggestUrlFromPorts([{ privatePort: 80, publicPort: null, type: "tcp" }])).toBeNull();
  });

  it("flags likely-internal services by image and by name, but never hides them", () => {
    expect(internalHint(container({ image: "postgres:16" })).likelyInternal).toBe(true);
    expect(internalHint(container({ image: "redis:7-alpine" })).likelyInternal).toBe(true);
    expect(internalHint(container({ name: "app-db", image: "custom:1" })).likelyInternal).toBe(true);
    expect(internalHint(container({ name: "plex", image: "plexinc/pms-docker" })).likelyInternal).toBe(
      false,
    );
  });
});

describe("docker-import — duplicate detection", () => {
  it("normalises URLs for comparison", () => {
    expect(normalizeUrlForCompare("https://App.Example.com/")).toBe("https://app.example.com");
    expect(normalizeUrlForCompare("  http://x:80//  ")).toBe("http://x:80");
  });

  it("detects duplicates by URL or name (case-insensitive)", () => {
    const index = indexExistingApps([{ name: "Plex", url: "https://plex.example.com" }]);
    expect(findDuplicate("Something", "https://PLEX.example.com/", index)).toMatch(/URL/);
    expect(findDuplicate("plex", "https://other.example.com", index)).toMatch(/name/);
    expect(findDuplicate("New App", "https://new.example.com", index)).toBeNull();
  });
});

describe("docker-import — candidate mapping", () => {
  it("maps a container into a candidate with suggestions + duplicate hint", () => {
    const index = indexExistingApps([{ name: "Existing", url: "http://localhost:8080" }]);
    const c = buildCandidate(
      container({
        name: "whoami",
        image: "traefik/whoami",
        ports: [{ privatePort: 80, publicPort: 8080, type: "tcp" }],
        composeProject: "web",
        composeService: "whoami",
      }),
      index,
    );
    expect(c.suggestedName).toBe("Whoami");
    expect(c.suggestedUrl).toBe("http://localhost:8080");
    expect(c.alreadyImported).toBe(true); // URL collides with the existing app
    expect(c.containerName).toBe("whoami");
    // never leaks host internals
    expect(JSON.stringify(c)).not.toMatch(/socket|mount|\/var\/run/i);
  });
});

describe("docker-import — request schema", () => {
  it("accepts a valid import payload", () => {
    const res = dockerImportSchema.safeParse({
      items: [{ containerId: "a".repeat(12), name: "Plex", url: "https://plex.example.com" }],
    });
    expect(res.success).toBe(true);
  });

  it("rejects an empty item list", () => {
    expect(dockerImportSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it("rejects a bad container id", () => {
    expect(
      dockerImportSchema.safeParse({
        items: [{ containerId: "../etc", name: "X", url: "https://x.example.com" }],
      }).success,
    ).toBe(false);
  });

  it("rejects a non-http(s) URL (reuses app validation)", () => {
    expect(
      dockerImportSchema.safeParse({
        items: [{ containerId: "a".repeat(12), name: "X", url: "ftp://x.example.com" }],
      }).success,
    ).toBe(false);
  });

  it("requires a URL (blank is not importable)", () => {
    expect(
      dockerImportSchema.safeParse({
        items: [{ containerId: "a".repeat(12), name: "X", url: "" }],
      }).success,
    ).toBe(false);
  });
});
