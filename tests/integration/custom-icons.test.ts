import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { customIcons } from "@/db/schema";
import {
  createCustomIcon,
  deleteCustomIcon,
  getCustomIconBytes,
  listCustomIcons,
} from "@/server/services/custom-icons";

// Point icon file storage at a throwaway temp dir for the test run.
let iconsDir: string;

// Minimal valid-looking PNG byte content (storage trusts the sniffed type arg;
// sniffing itself is covered by the unit tests).
function png(tag: number): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, tag, tag + 1]);
}

beforeAll(() => {
  iconsDir = mkdtempSync(join(tmpdir(), "ballys-icons-"));
  process.env.ICONS_DIR = iconsDir;
  runMigrations();
});

afterAll(() => {
  rmSync(iconsDir, { recursive: true, force: true });
  delete process.env.ICONS_DIR;
});

beforeEach(() => {
  db.delete(customIcons).run();
});

describe("custom icon service", () => {
  it("creates, lists, serves and deletes an icon", () => {
    const created = createCustomIcon(png(1), "png");
    expect(created.mime).toBe("image/png");
    expect(created.bytes).toBe(10);
    expect(created.id).toMatch(/^[a-f0-9]{32}$/);

    expect(listCustomIcons()).toHaveLength(1);

    const served = getCustomIconBytes(created.id);
    expect(served?.mime).toBe("image/png");
    expect(served?.bytes.length).toBe(10);

    expect(deleteCustomIcon(created.id)).toBe(true);
    expect(getCustomIconBytes(created.id)).toBeNull();
    expect(listCustomIcons()).toHaveLength(0);
  });

  it("deduplicates identical uploads by sha256", () => {
    const a = createCustomIcon(png(1), "png");
    const b = createCustomIcon(png(1), "png"); // identical bytes
    expect(b.id).toBe(a.id);
    expect(listCustomIcons()).toHaveLength(1);

    const c = createCustomIcon(png(9), "png"); // different bytes
    expect(c.id).not.toBe(a.id);
    expect(listCustomIcons()).toHaveLength(2);
  });

  it("returns null/false for a missing icon", () => {
    expect(getCustomIconBytes("deadbeefdeadbeefdeadbeefdeadbeef")).toBeNull();
    expect(deleteCustomIcon("deadbeefdeadbeefdeadbeefdeadbeef")).toBe(false);
  });
});
