import { describe, expect, it } from "vitest";
import { isSafeAssetPath, parseManifest } from "@/lib/icons/pack-manifest";

const valid = {
  manifestVersion: 1,
  id: "my-pack",
  name: "My Pack",
  version: "1.0.0",
  author: "Someone",
  license: "CC-BY-4.0",
  homepage: "https://example.test/pack",
  icons: [{ key: "plex", label: "Plex", file: "assets/plex.png" }],
};

describe("isSafeAssetPath", () => {
  it("accepts assets/-rooted slug paths", () => {
    expect(isSafeAssetPath("assets/plex.png")).toBe(true);
    expect(isSafeAssetPath("assets/sub/plex-4k.webp")).toBe(true);
  });

  it("rejects traversal, absolute, backslash, drive, NUL and non-asset paths", () => {
    expect(isSafeAssetPath("assets/../etc/passwd")).toBe(false);
    expect(isSafeAssetPath("../assets/x.png")).toBe(false);
    expect(isSafeAssetPath("/etc/passwd")).toBe(false);
    expect(isSafeAssetPath("assets\\x.png")).toBe(false);
    expect(isSafeAssetPath("C:/assets/x.png")).toBe(false);
    expect(isSafeAssetPath("assets/x\u0000.png")).toBe(false);
    expect(isSafeAssetPath("manifest.json")).toBe(false);
    expect(isSafeAssetPath("icons/x.png")).toBe(false);
    expect(isSafeAssetPath("")).toBe(false);
    expect(isSafeAssetPath(123 as unknown)).toBe(false);
  });
});

describe("parseManifest", () => {
  it("accepts a well-formed manifest", () => {
    const res = parseManifest(valid);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.manifest.id).toBe("my-pack");
  });

  it("accepts optional per-icon variants", () => {
    const res = parseManifest({
      ...valid,
      icons: [{ key: "plex", file: "assets/plex.png", variants: { "4k": "assets/plex-4k.png" } }],
    });
    expect(res.ok).toBe(true);
  });

  it("rejects a wrong manifestVersion", () => {
    expect(parseManifest({ ...valid, manifestVersion: 2 }).ok).toBe(false);
  });

  it("rejects a bad pack id slug", () => {
    expect(parseManifest({ ...valid, id: "My_Pack" }).ok).toBe(false);
    expect(parseManifest({ ...valid, id: "-bad" }).ok).toBe(false);
  });

  it("rejects a bad icon key slug", () => {
    expect(parseManifest({ ...valid, icons: [{ key: "Plex!", file: "assets/x.png" }] }).ok).toBe(
      false,
    );
  });

  it("rejects duplicate icon keys", () => {
    const res = parseManifest({
      ...valid,
      icons: [
        { key: "plex", file: "assets/a.png" },
        { key: "plex", file: "assets/b.png" },
      ],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/duplicate/i);
  });

  it("rejects unsafe icon file paths", () => {
    expect(parseManifest({ ...valid, icons: [{ key: "plex", file: "../x.png" }] }).ok).toBe(false);
    expect(parseManifest({ ...valid, icons: [{ key: "plex", file: "assets/../../x" }] }).ok).toBe(
      false,
    );
  });

  it("rejects a non-http(s) homepage", () => {
    expect(parseManifest({ ...valid, homepage: "javascript:alert(1)" }).ok).toBe(false);
    expect(parseManifest({ ...valid, homepage: "ftp://x.test/a" }).ok).toBe(false);
  });

  it("rejects an empty icons array", () => {
    expect(parseManifest({ ...valid, icons: [] }).ok).toBe(false);
  });

  it("rejects non-object / missing manifests", () => {
    expect(parseManifest(null).ok).toBe(false);
    expect(parseManifest("nope").ok).toBe(false);
    expect(parseManifest({}).ok).toBe(false);
  });
});
