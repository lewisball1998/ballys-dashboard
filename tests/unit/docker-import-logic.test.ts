import { describe, expect, it } from "vitest";
import type { DockerImportCandidateDTO, DockerPortDTO } from "@/lib/types";
import {
  appUrl,
  buildRows,
  candidateToRow,
  composeUrl,
  defaultSchemeForPort,
  hostBaseIssue,
  pickDefaultPortIndex,
  publishedPorts,
  selectedIds,
  selectedPortLoopback,
  validateRow,
} from "@/components/docker/import/import-logic";

function port(overrides: Partial<DockerPortDTO> = {}): DockerPortDTO {
  return { privatePort: 80, publicPort: 8080, type: "tcp", hostScope: "all", ...overrides };
}

function candidate(overrides: Partial<DockerImportCandidateDTO> = {}): DockerImportCandidateDTO {
  return {
    containerId: "a".repeat(12),
    shortId: "a".repeat(12),
    containerName: "plex",
    image: "plexinc/pms-docker",
    state: "running",
    health: "none",
    ports: [port({ privatePort: 32400, publicPort: 32400 })],
    composeProject: null,
    composeService: null,
    suggestedName: "Plex",
    likelyInternal: false,
    internalReason: null,
    alreadyImported: false,
    duplicateReason: null,
    ...overrides,
  };
}

describe("import-logic — URL parts", () => {
  it("defaults scheme by port (443 → https, else http)", () => {
    expect(defaultSchemeForPort(443)).toBe("https");
    expect(defaultSchemeForPort(80)).toBe("http");
    expect(defaultSchemeForPort(30055)).toBe("http");
  });

  it("composes a URL, omitting the scheme's default port", () => {
    expect(composeUrl("http", "192.168.1.10", 30055)).toBe("http://192.168.1.10:30055");
    expect(composeUrl("http", "nas.local", 80)).toBe("http://nas.local");
    expect(composeUrl("https", "nas.local", 443)).toBe("https://nas.local");
    expect(composeUrl("https", "nas.local", 8443)).toBe("https://nas.local:8443");
  });

  it("strips scheme/trailing slash from a pasted host and blanks on empty host", () => {
    expect(composeUrl("http", "http://host/", 80)).toBe("http://host");
    expect(composeUrl("http", "   ", 8080)).toBe("");
  });

  it("never produces a localhost/0.0.0.0 default — host comes from the user", () => {
    // The host base is supplied by the caller (dashboard hostname); compose just
    // uses it. There is no built-in localhost fallback.
    expect(composeUrl("http", "", 8080)).toBe("");
  });

  it("picks the best published port index (web ports first)", () => {
    const ports = [port({ privatePort: 9000, publicPort: 32000 }), port({ privatePort: 80, publicPort: 80 })];
    expect(pickDefaultPortIndex(ports)).toBe(1);
    expect(pickDefaultPortIndex([port({ publicPort: null })])).toBe(-1);
  });

  it("lists only published ports", () => {
    const c = candidate({ ports: [port({ publicPort: 8080 }), port({ publicPort: null })] });
    expect(publishedPorts(c)).toHaveLength(1);
  });
});

describe("import-logic — host/base + loopback warnings", () => {
  it("flags empty and loopback host bases", () => {
    expect(hostBaseIssue("")).toBe("empty");
    expect(hostBaseIssue("   ")).toBe("empty");
    expect(hostBaseIssue("localhost")).toBe("loopback");
    expect(hostBaseIssue("127.0.0.1")).toBe("loopback");
    expect(hostBaseIssue("0.0.0.0")).toBe("loopback");
    expect(hostBaseIssue("192.168.1.10")).toBeNull();
    expect(hostBaseIssue("nas.local")).toBeNull();
  });

  it("detects a loopback-only published port for the selected mapping", () => {
    const c = candidate({ ports: [port({ hostScope: "loopback" })] });
    const row = candidateToRow(c, "nas.local");
    expect(selectedPortLoopback(c, row.values)).toBe(true);
  });
});

describe("import-logic — rows + URL generation", () => {
  it("seeds a row from the default host base, unselected, port mode", () => {
    const row = candidateToRow(candidate(), "192.168.50.2");
    expect(row.selected).toBe(false);
    expect(row.values.hostBase).toBe("192.168.50.2");
    expect(row.values.urlMode).toBe("port");
    expect(appUrl(candidate(), row.values)).toBe("http://192.168.50.2:32400");
  });

  it("starts in custom mode when no port is published", () => {
    const c = candidate({ ports: [] });
    const row = candidateToRow(c, "nas.local");
    expect(row.values.urlMode).toBe("custom");
    expect(appUrl(c, row.values)).toBe("");
  });

  it("uses the custom URL verbatim in custom mode", () => {
    const c = candidate();
    const row = candidateToRow(c, "nas.local");
    row.values.urlMode = "custom";
    row.values.customUrl = "https://plex.example.com";
    expect(appUrl(c, row.values)).toBe("https://plex.example.com");
  });

  it("builds a rows map keyed by container id", () => {
    const rows = buildRows(
      [candidate({ containerId: "a".repeat(12) }), candidate({ containerId: "b".repeat(12) })],
      "nas.local",
    );
    expect(Object.keys(rows)).toEqual(["a".repeat(12), "b".repeat(12)]);
  });

  it("lists only selected ids", () => {
    const rows = buildRows([candidate({ containerId: "a".repeat(12) })], "nas.local");
    rows["a".repeat(12)]!.selected = true;
    expect(selectedIds(rows)).toEqual(["a".repeat(12)]);
  });
});

describe("import-logic — validation", () => {
  it("validates a good row and attaches the container id", () => {
    const c = candidate();
    const res = validateRow(c, candidateToRow(c, "192.168.1.10").values);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.item.containerId).toBe("a".repeat(12));
      expect(res.item.url).toBe("http://192.168.1.10:32400");
    }
  });

  it("fails when the host base is empty (no usable URL)", () => {
    const c = candidate();
    const res = validateRow(c, candidateToRow(c, "").values);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.fieldErrors.url).toBeTruthy();
  });

  it("passes a custom health URL through and fails an invalid one", () => {
    const c = candidate();
    const base = candidateToRow(c, "192.168.1.10").values;
    const ok = validateRow(c, { ...base, healthSameAsApp: false, healthUrl: "https://h.example.com" });
    expect(ok.success).toBe(true);
    const bad = validateRow(c, { ...base, healthSameAsApp: false, healthUrl: "not-a-url" });
    expect(bad.success).toBe(false);
  });
});
