import { describe, expect, it } from "vitest";
import {
  groupByProject,
  mapContainer,
  normaliseState,
  parseHealth,
} from "@/server/services/docker";
import { dockerActionSchema, dockerContainerIdSchema } from "@/lib/validation";

describe("docker service — pure mapping", () => {
  it("normalises known states and falls back to unknown", () => {
    expect(normaliseState("running")).toBe("running");
    expect(normaliseState("EXITED")).toBe("exited");
    expect(normaliseState("weird")).toBe("unknown");
    expect(normaliseState(undefined)).toBe("unknown");
  });

  it("parses health from the daemon status text", () => {
    expect(parseHealth("Up 3 hours (healthy)")).toBe("healthy");
    expect(parseHealth("Up 5 minutes (unhealthy)")).toBe("unhealthy");
    expect(parseHealth("Up 2 seconds (health: starting)")).toBe("starting");
    expect(parseHealth("Up 3 hours")).toBe("none");
    expect(parseHealth(undefined)).toBe("none");
  });

  it("maps a raw container to the safe DTO subset", () => {
    const dto = mapContainer({
      Id: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      Names: ["/web-nginx"],
      Image: "nginx:latest",
      Created: 1_700_000_000,
      State: "running",
      Status: "Up 3 hours (healthy)",
      Labels: {
        "com.docker.compose.project": "web",
        "com.docker.compose.service": "nginx",
      },
      Ports: [
        { PrivatePort: 80, PublicPort: 8080, Type: "tcp" },
        { PrivatePort: 80, PublicPort: 8080, Type: "tcp" }, // duplicate host-IP family entry
        { PrivatePort: 443, Type: "tcp" },
      ],
    });

    expect(dto.name).toBe("web-nginx");
    expect(dto.shortId).toBe("abcdef012345");
    expect(dto.state).toBe("running");
    expect(dto.health).toBe("healthy");
    expect(dto.composeProject).toBe("web");
    expect(dto.composeService).toBe("nginx");
    // duplicate host-IP entry collapses to one logical mapping
    expect(dto.ports).toHaveLength(2);
    expect(dto.ports[0]).toEqual({ privatePort: 80, publicPort: 8080, type: "tcp", hostScope: "all" });
    expect(dto.createdAt).toBe(new Date(1_700_000_000 * 1000).toISOString());
    // the DTO never carries a raw host IP binding field (only a derived scope)
    expect(JSON.stringify(dto)).not.toMatch(/"ip"/i);
    expect(JSON.stringify(dto)).not.toMatch(/127\.0\.0\.1|0\.0\.0\.0/);
  });

  it("derives port host scope without leaking the raw host IP", () => {
    const dto = mapContainer({
      Id: "c".repeat(64),
      Names: ["/svc"],
      Ports: [
        { IP: "0.0.0.0", PrivatePort: 80, PublicPort: 8080, Type: "tcp" },
        { IP: "127.0.0.1", PrivatePort: 81, PublicPort: 8081, Type: "tcp" },
        { IP: "192.168.1.10", PrivatePort: 82, PublicPort: 8082, Type: "tcp" },
      ],
    });
    const scopeFor = (priv: number) => dto.ports.find((p) => p.privatePort === priv)?.hostScope;
    expect(scopeFor(80)).toBe("all");
    expect(scopeFor(81)).toBe("loopback");
    expect(scopeFor(82)).toBe("specific");
  });

  it("prefers an all-interfaces binding over a loopback duplicate of the same port", () => {
    const dto = mapContainer({
      Id: "d".repeat(64),
      Names: ["/svc"],
      Ports: [
        { IP: "127.0.0.1", PrivatePort: 80, PublicPort: 8080, Type: "tcp" },
        { IP: "0.0.0.0", PrivatePort: 80, PublicPort: 8080, Type: "tcp" },
      ],
    });
    expect(dto.ports).toHaveLength(1);
    expect(dto.ports[0]!.hostScope).toBe("all");
  });

  it("handles missing fields defensively", () => {
    const dto = mapContainer({});
    expect(dto.name).toBe("unnamed");
    expect(dto.image).toBe("unknown");
    expect(dto.state).toBe("unknown");
    expect(dto.ports).toEqual([]);
    expect(dto.composeProject).toBeNull();
  });

  it("groups by compose project with standalone containers last", () => {
    const groups = groupByProject([
      mapContainer({ Id: "1".repeat(64), Names: ["/z"], Labels: { "com.docker.compose.project": "web" } }),
      mapContainer({ Id: "2".repeat(64), Names: ["/a"], Labels: { "com.docker.compose.project": "web" } }),
      mapContainer({ Id: "3".repeat(64), Names: ["/solo"] }),
      mapContainer({ Id: "4".repeat(64), Names: ["/b"], Labels: { "com.docker.compose.project": "media" } }),
    ]);

    expect(groups.map((g) => g.project)).toEqual(["media", "web", null]);
    // within a group, sorted by name
    const web = groups.find((g) => g.project === "web");
    expect(web?.containers.map((c) => c.name)).toEqual(["a", "z"]);
  });
});

describe("docker validation schemas", () => {
  it("accepts valid short and full container ids", () => {
    expect(dockerContainerIdSchema.safeParse({ id: "a".repeat(12) }).success).toBe(true);
    expect(dockerContainerIdSchema.safeParse({ id: "abcdef012345" }).success).toBe(true);
    expect(dockerContainerIdSchema.safeParse({ id: "f".repeat(64) }).success).toBe(true);
  });

  it("rejects malformed / injection-style ids", () => {
    expect(dockerContainerIdSchema.safeParse({ id: "short" }).success).toBe(false);
    expect(dockerContainerIdSchema.safeParse({ id: "../../etc/passwd" }).success).toBe(false);
    expect(dockerContainerIdSchema.safeParse({ id: "abc/start" }).success).toBe(false);
    expect(dockerContainerIdSchema.safeParse({ id: "ZZZZ".repeat(3) }).success).toBe(false);
    expect(dockerContainerIdSchema.safeParse({ id: "" }).success).toBe(false);
  });

  it("only allows start/stop/restart actions", () => {
    expect(dockerActionSchema.safeParse({ action: "start" }).success).toBe(true);
    expect(dockerActionSchema.safeParse({ action: "stop" }).success).toBe(true);
    expect(dockerActionSchema.safeParse({ action: "restart" }).success).toBe(true);
    expect(dockerActionSchema.safeParse({ action: "exec" }).success).toBe(false);
    expect(dockerActionSchema.safeParse({ action: "remove" }).success).toBe(false);
    expect(dockerActionSchema.safeParse({ action: "kill" }).success).toBe(false);
  });
});
