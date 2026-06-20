import { describe, expect, it } from "vitest";
import type { DockerImportCandidateDTO } from "@/lib/types";
import {
  buildImportItem,
  buildRows,
  candidateToRow,
  selectedIds,
  validateRow,
} from "@/components/docker/import/import-logic";

function candidate(overrides: Partial<DockerImportCandidateDTO> = {}): DockerImportCandidateDTO {
  return {
    containerId: "a".repeat(12),
    shortId: "a".repeat(12),
    containerName: "plex",
    image: "plexinc/pms-docker",
    state: "running",
    health: "none",
    ports: [],
    composeProject: null,
    composeService: null,
    suggestedName: "Plex",
    suggestedUrl: "http://localhost:32400",
    likelyInternal: false,
    internalReason: null,
    alreadyImported: false,
    duplicateReason: null,
    ...overrides,
  };
}

describe("import-logic — rows", () => {
  it("seeds a row from suggestions, unselected by default", () => {
    const row = candidateToRow(candidate());
    expect(row.selected).toBe(false);
    expect(row.values.name).toBe("Plex");
    expect(row.values.url).toBe("http://localhost:32400");
    expect(row.values.healthEnabled).toBe(false);
    expect(row.values.isFavourite).toBe(false);
  });

  it("falls back to a blank URL when none is suggested", () => {
    const row = candidateToRow(candidate({ suggestedUrl: null }));
    expect(row.values.url).toBe("");
  });

  it("builds a rows map keyed by container id", () => {
    const rows = buildRows([candidate({ containerId: "a".repeat(12) }), candidate({ containerId: "b".repeat(12) })]);
    expect(Object.keys(rows)).toEqual(["a".repeat(12), "b".repeat(12)]);
  });

  it("lists only selected ids", () => {
    const rows = buildRows([candidate({ containerId: "a".repeat(12) }), candidate({ containerId: "b".repeat(12) })]);
    rows["b".repeat(12)]!.selected = true;
    expect(selectedIds(rows)).toEqual(["b".repeat(12)]);
  });
});

describe("import-logic — validation + payload", () => {
  it("attaches the container id to a valid import item", () => {
    const item = buildImportItem("a".repeat(12), candidateToRow(candidate()).values);
    expect(item.containerId).toBe("a".repeat(12));
    expect(item.name).toBe("Plex");
    expect(item.url).toBe("http://localhost:32400");
  });

  it("validates a good row and returns the item", () => {
    const res = validateRow("a".repeat(12), candidateToRow(candidate()).values);
    expect(res.success).toBe(true);
    if (res.success) expect(res.item.containerId).toBe("a".repeat(12));
  });

  it("fails a row with a blank/invalid URL", () => {
    const values = candidateToRow(candidate({ suggestedUrl: null })).values;
    const res = validateRow("a".repeat(12), values);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.fieldErrors.url).toBeTruthy();
  });
});
