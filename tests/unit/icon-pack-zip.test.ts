import { describe, expect, it } from "vitest";
import { zipSync } from "fflate";
import { preparePackFromZip, PackImportError } from "@/server/icons/pack-import";

/* --- fixtures ----------------------------------------------------------- */

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A byte buffer that sniffs as PNG, of the given total length (>= 10). */
function png(length = 10, tag = 0): Uint8Array {
  const b = new Uint8Array(Math.max(length, 10));
  b.set(PNG_MAGIC, 0);
  b[8] = tag;
  b[9] = tag + 1;
  return b;
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function manifest(extra: Record<string, unknown> = {}): Uint8Array {
  return utf8(
    JSON.stringify({
      manifestVersion: 1,
      id: "my-pack",
      name: "My Pack",
      version: "1.0.0",
      icons: [{ key: "plex", label: "Plex", file: "assets/plex.png" }],
      ...extra,
    }),
  );
}

function makeZip(files: Record<string, Uint8Array>): Buffer {
  return Buffer.from(zipSync(files));
}

/** Patch the first central-directory entry to look like a Unix symlink. */
function markFirstEntryAsSymlink(zip: Buffer): Buffer {
  const b = Buffer.from(zip);
  // EOCD (PK\x05\x06) → central-directory offset at +16.
  let eocd = -1;
  for (let i = b.length - 22; i >= 0; i--) {
    if (b.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  const cd = b.readUInt32LE(eocd + 16);
  // version made by: high byte = host OS (3 = unix).
  b.writeUInt8(3, cd + 5);
  // external attributes: high 16 bits = st_mode; set S_IFLNK | 0777.
  b.writeUInt32LE(((0xa000 | 0x1ff) >>> 0) * 0x10000, cd + 38);
  return b;
}

/* --- tests -------------------------------------------------------------- */

describe("preparePackFromZip — happy path", () => {
  it("imports a valid pack and resolves assets by magic bytes", () => {
    const prep = preparePackFromZip(
      makeZip({ "manifest.json": manifest(), "assets/plex.png": png() }),
    );
    expect(prep.manifest.id).toBe("my-pack");
    expect(prep.icons).toHaveLength(1);
    expect(prep.icons[0]).toMatchObject({
      key: "plex",
      variant: null,
      mime: "image/png",
      ext: "png",
    });
    expect(prep.assets.size).toBe(1);
    expect(prep.storedBytes).toBeGreaterThan(0);
  });

  it("emits base + variant icon rows for declared variants", () => {
    const prep = preparePackFromZip(
      makeZip({
        "manifest.json": manifest({
          icons: [
            { key: "plex", file: "assets/plex.png", variants: { "4k": "assets/plex-4k.png" } },
          ],
        }),
        "assets/plex.png": png(10, 1),
        "assets/plex-4k.png": png(10, 2),
      }),
    );
    expect(prep.icons.map((i) => i.variant)).toEqual([null, "4k"]);
  });

  it("dedupes identical asset bytes referenced by multiple keys", () => {
    const prep = preparePackFromZip(
      makeZip({
        "manifest.json": manifest({
          icons: [
            { key: "a", file: "assets/a.png" },
            { key: "b", file: "assets/b.png" },
          ],
        }),
        "assets/a.png": png(10, 7),
        "assets/b.png": png(10, 7), // identical bytes
      }),
    );
    expect(prep.icons).toHaveLength(2);
    expect(prep.assets.size).toBe(1); // deduped on disk
  });
});

describe("preparePackFromZip — rejections", () => {
  const expectCode = (fn: () => unknown, code: string) => {
    try {
      fn();
    } catch (e) {
      expect(e).toBeInstanceOf(PackImportError);
      expect((e as PackImportError).code).toBe(code);
      return;
    }
    throw new Error(`expected PackImportError(${code}) but none was thrown`);
  };

  it("rejects an empty upload", () => {
    expectCode(() => preparePackFromZip(Buffer.alloc(0)), "empty_file");
  });

  it("rejects an oversized zip before parsing", () => {
    expectCode(() => preparePackFromZip(Buffer.alloc(5 * 1024 * 1024 + 1)), "pack_too_large");
  });

  it("rejects a non-zip blob", () => {
    expectCode(() => preparePackFromZip(Buffer.from("this is not a zip archive")), "malformed_zip");
  });

  it("rejects a missing manifest", () => {
    expectCode(() => preparePackFromZip(makeZip({ "assets/plex.png": png() })), "missing_manifest");
  });

  it("rejects malformed manifest JSON", () => {
    expectCode(
      () =>
        preparePackFromZip(
          makeZip({ "manifest.json": utf8("{ not json"), "assets/plex.png": png() }),
        ),
      "malformed_manifest",
    );
  });

  it("rejects an invalid manifest (bad slug)", () => {
    expectCode(
      () =>
        preparePackFromZip(
          makeZip({ "manifest.json": manifest({ id: "BAD_ID" }), "assets/plex.png": png() }),
        ),
      "invalid_manifest",
    );
  });

  it("rejects a manifest referencing a missing file", () => {
    expectCode(() => preparePackFromZip(makeZip({ "manifest.json": manifest() })), "missing_file");
  });

  it("rejects an entry outside manifest.json / assets/", () => {
    expectCode(
      () =>
        preparePackFromZip(
          makeZip({ "manifest.json": manifest(), "assets/plex.png": png(), "evil.txt": utf8("x") }),
        ),
      "invalid_entry",
    );
  });

  it("rejects SVG, GIF, JPEG, ICO and empty assets (PNG/WebP only)", () => {
    expectCode(
      () =>
        preparePackFromZip(
          makeZip({ "manifest.json": manifest(), "assets/plex.png": utf8("<svg></svg>") }),
        ),
      "unsupported_type",
    );
    expectCode(
      () =>
        preparePackFromZip(
          makeZip({
            "manifest.json": manifest(),
            "assets/plex.png": new Uint8Array([0x47, 0x49, 0x46, 0x38]),
          }),
        ),
      "unsupported_type",
    );
    expectCode(
      () =>
        preparePackFromZip(
          makeZip({
            "manifest.json": manifest(),
            "assets/plex.png": new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
          }),
        ),
      "unsupported_type",
    );
    expectCode(
      () =>
        preparePackFromZip(
          makeZip({ "manifest.json": manifest(), "assets/plex.png": new Uint8Array(0) }),
        ),
      "empty_asset",
    );
  });

  it("rejects an asset over the per-icon size cap", () => {
    expectCode(
      () =>
        preparePackFromZip(
          makeZip({ "manifest.json": manifest(), "assets/plex.png": png(512 * 1024 + 1) }),
        ),
      "asset_too_large",
    );
  });

  it("rejects an archive with too many entries", () => {
    const files: Record<string, Uint8Array> = { "manifest.json": manifest() };
    for (let i = 0; i < 601; i++) files[`assets/i${i}.png`] = png();
    expectCode(() => preparePackFromZip(makeZip(files)), "too_many_entries");
  });

  it("rejects a symlink / special-file entry", () => {
    const zip = markFirstEntryAsSymlink(
      makeZip({ "manifest.json": manifest(), "assets/plex.png": png() }),
    );
    expectCode(() => preparePackFromZip(zip), "unsafe_entry");
  });
});
