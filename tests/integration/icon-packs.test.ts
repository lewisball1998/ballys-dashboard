import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { zipSync } from "fflate";
import { db } from "@/db";
import { runMigrations } from "@/db/migrate";
import { iconPacks, iconPackIcons } from "@/db/schema";
import {
  deleteIconPack,
  getPackIconBytes,
  importIconPack,
  listIconPacks,
} from "@/server/services/icon-packs";
import { PackImportError } from "@/server/icons/pack-import";

let iconsDir: string;

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
function png(tag: number): Uint8Array {
  return new Uint8Array([...PNG_MAGIC, tag, tag + 1]);
}
function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function packZip(opts: { id?: string; withVariant?: boolean } = {}): Buffer {
  const id = opts.id ?? "my-pack";
  const icon: Record<string, unknown> = { key: "plex", label: "Plex", file: "assets/plex.png" };
  const files: Record<string, Uint8Array> = { "assets/plex.png": png(1) };
  if (opts.withVariant) {
    icon.variants = { "4k": "assets/plex-4k.png" };
    files["assets/plex-4k.png"] = png(2);
  }
  files["manifest.json"] = utf8(
    JSON.stringify({
      manifestVersion: 1,
      id,
      name: "My Pack",
      version: "1.0.0",
      author: "Someone",
      license: "CC-BY-4.0",
      homepage: "https://example.test",
      icons: [icon],
    }),
  );
  return Buffer.from(zipSync(files));
}

beforeAll(() => {
  iconsDir = mkdtempSync(join(tmpdir(), "ballys-packs-"));
  process.env.ICONS_DIR = iconsDir;
  runMigrations();
});

afterAll(() => {
  rmSync(iconsDir, { recursive: true, force: true });
  delete process.env.ICONS_DIR;
});

beforeEach(() => {
  db.delete(iconPackIcons).run();
  db.delete(iconPacks).run();
  rmSync(join(iconsDir, "packs"), { recursive: true, force: true });
});

describe("icon pack service", () => {
  it("imports, lists, serves and deletes a pack", () => {
    const dto = importIconPack(packZip());
    expect(dto.id).toBe("my-pack");
    expect(dto.icons).toEqual([{ key: "plex", label: "Plex", variants: [] }]);
    expect(dto.iconCount).toBe(1);
    expect(existsSync(join(iconsDir, "packs", "my-pack"))).toBe(true);

    const list = listIconPacks();
    expect(list).toHaveLength(1);
    expect(list[0]?.license).toBe("CC-BY-4.0");
    expect(list[0]?.homepage).toBe("https://example.test");

    const served = getPackIconBytes("my-pack", "plex", null);
    expect(served?.mime).toBe("image/png");
    expect(served?.bytes?.[8]).toBe(1);

    expect(deleteIconPack("my-pack")).toBe(true);
    expect(listIconPacks()).toHaveLength(0);
    expect(getPackIconBytes("my-pack", "plex", null)).toBeNull();
    expect(existsSync(join(iconsDir, "packs", "my-pack"))).toBe(false);
  });

  it("serves a declared variant and falls back to the base icon when absent", () => {
    importIconPack(packZip({ withVariant: true }));
    expect(getPackIconBytes("my-pack", "plex", "4k")?.bytes?.[8]).toBe(2); // variant
    expect(getPackIconBytes("my-pack", "plex", "missing")?.bytes?.[8]).toBe(1); // → base
    expect(getPackIconBytes("my-pack", "nope", null)).toBeNull(); // unknown key
    const dto = listIconPacks()[0];
    expect(dto?.icons[0]?.variants).toEqual(["4k"]);
  });

  it("rejects a duplicate pack id and leaves the original intact", () => {
    importIconPack(packZip());
    try {
      importIconPack(packZip());
      throw new Error("expected duplicate to be rejected");
    } catch (e) {
      expect(e).toBeInstanceOf(PackImportError);
      expect((e as PackImportError).code).toBe("duplicate_pack");
      expect((e as PackImportError).status).toBe(409);
    }
    expect(listIconPacks()).toHaveLength(1);
    expect(getPackIconBytes("my-pack", "plex", null)?.bytes?.[8]).toBe(1);
  });

  it("deleting a missing pack returns false", () => {
    expect(deleteIconPack("ghost")).toBe(false);
  });

  it("persists nothing when the import fails validation (atomic)", () => {
    const bad = Buffer.from(
      zipSync({ "manifest.json": utf8("{ not json"), "assets/plex.png": png(1) }),
    );
    expect(() => importIconPack(bad)).toThrow(PackImportError);
    expect(listIconPacks()).toHaveLength(0);
    expect(existsSync(join(iconsDir, "packs", "my-pack"))).toBe(false);
  });

  it("persists no rows when staging fails (atomic)", () => {
    // Pre-create the destination dir so the staging rename cannot proceed.
    mkdirSync(join(iconsDir, "packs", "my-pack"), { recursive: true });
    expect(() => importIconPack(packZip())).toThrow();
    expect(listIconPacks()).toHaveLength(0);
  });
});
