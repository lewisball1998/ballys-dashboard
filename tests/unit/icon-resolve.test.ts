import { describe, expect, it } from "vitest";
import {
  buildBuiltinRef,
  buildCustomRef,
  buildPackRef,
  isValidCustomId,
  isValidPackId,
  isValidPackIconKey,
  parseIconRef,
  resolveIconSrc,
} from "@/lib/icons/resolve";

describe("parseIconRef", () => {
  it("treats null/empty/whitespace as none", () => {
    expect(parseIconRef(null).kind).toBe("none");
    expect(parseIconRef("").kind).toBe("none");
    expect(parseIconRef("   ").kind).toBe("none");
  });

  it("parses http(s) urls", () => {
    expect(parseIconRef("https://x.test/a.png")).toEqual({
      kind: "url",
      url: "https://x.test/a.png",
    });
    expect(parseIconRef("http://x.test/a.png").kind).toBe("url");
  });

  it("parses builtin refs with and without a variant", () => {
    expect(parseIconRef("builtin:media")).toEqual({ kind: "builtin", key: "media", variant: null });
    expect(parseIconRef("builtin:media?v=4k")).toEqual({
      kind: "builtin",
      key: "media",
      variant: "4k",
    });
    // unknown variant token is dropped
    expect(parseIconRef("builtin:media?v=nope")).toEqual({
      kind: "builtin",
      key: "media",
      variant: null,
    });
  });

  it("parses custom refs", () => {
    expect(parseIconRef("custom:abc123")).toEqual({ kind: "custom", id: "abc123" });
  });

  it("parses pack refs with and without a variant", () => {
    expect(parseIconRef("pack:my-pack/plex")).toEqual({
      kind: "pack",
      packId: "my-pack",
      iconKey: "plex",
      variant: null,
    });
    expect(parseIconRef("pack:my-pack/plex?v=4k")).toEqual({
      kind: "pack",
      packId: "my-pack",
      iconKey: "plex",
      variant: "4k",
    });
    // missing key still parses (resolver decides the fallback)
    expect(parseIconRef("pack:my-pack")).toEqual({
      kind: "pack",
      packId: "my-pack",
      iconKey: "",
      variant: null,
    });
  });

  it("keeps any other non-empty value as legacy", () => {
    expect(parseIconRef("some-old-value")).toEqual({ kind: "legacy", value: "some-old-value" });
  });
});

describe("resolveIconSrc", () => {
  it("none → initials", () => {
    expect(resolveIconSrc(null)).toEqual({ mode: "initials" });
    expect(resolveIconSrc("")).toEqual({ mode: "initials" });
  });

  it("url → img (preserves existing behaviour)", () => {
    expect(resolveIconSrc("https://x.test/a.png")).toEqual({
      mode: "img",
      src: "https://x.test/a.png",
    });
  });

  it("legacy value → img with the raw value (back-compat)", () => {
    expect(resolveIconSrc("legacy-thing")).toEqual({ mode: "img", src: "legacy-thing" });
  });

  it("known builtin (monochrome) → mask with public path", () => {
    expect(resolveIconSrc("builtin:media")).toEqual({
      mode: "mask",
      src: "/icons/builtin/media.svg",
    });
  });

  it("unknown builtin key → initials fallback", () => {
    expect(resolveIconSrc("builtin:does-not-exist")).toEqual({ mode: "initials" });
  });

  it("valid custom id → img on the opaque raw endpoint", () => {
    const id = "0123456789abcdef0123456789abcdef";
    expect(resolveIconSrc(`custom:${id}`)).toEqual({ mode: "img", src: `/api/icons/${id}/raw` });
  });

  it("malformed custom id → initials (never builds a bad url)", () => {
    expect(resolveIconSrc("custom:../../etc/passwd")).toEqual({ mode: "initials" });
    expect(resolveIconSrc("custom:")).toEqual({ mode: "initials" });
  });

  it("valid pack ref → img on the (packId,key) raw endpoint (never mask)", () => {
    expect(resolveIconSrc("pack:my-pack/plex")).toEqual({
      mode: "img",
      src: "/api/icons/packs/my-pack/plex/raw",
    });
  });

  it("pack ref with a variant carries ?v=", () => {
    expect(resolveIconSrc("pack:my-pack/plex?v=4k")).toEqual({
      mode: "img",
      src: "/api/icons/packs/my-pack/plex/raw?v=4k",
    });
  });

  it("invalid pack variant slug is dropped → base icon served", () => {
    expect(resolveIconSrc("pack:my-pack/plex?v=../../x")).toEqual({
      mode: "img",
      src: "/api/icons/packs/my-pack/plex/raw",
    });
  });

  it("malformed pack slug → initials (never builds a bad url)", () => {
    expect(resolveIconSrc("pack:../../etc/passwd")).toEqual({ mode: "initials" });
    expect(resolveIconSrc("pack:my-pack/")).toEqual({ mode: "initials" });
    expect(resolveIconSrc("pack:My_Pack/Plex")).toEqual({ mode: "initials" });
  });
});

describe("ref builders + validators", () => {
  it("buildBuiltinRef encodes the optional variant", () => {
    expect(buildBuiltinRef("media")).toBe("builtin:media");
    expect(buildBuiltinRef("media", "4k")).toBe("builtin:media?v=4k");
  });
  it("buildCustomRef prefixes the id", () => {
    expect(buildCustomRef("abc")).toBe("custom:abc");
  });
  it("buildPackRef joins packId/key and appends the optional variant", () => {
    expect(buildPackRef("my-pack", "plex")).toBe("pack:my-pack/plex");
    expect(buildPackRef("my-pack", "plex", "4k")).toBe("pack:my-pack/plex?v=4k");
  });
  it("isValidCustomId accepts hex tokens only", () => {
    expect(isValidCustomId("0123456789abcdef0123456789abcdef")).toBe(true);
    expect(isValidCustomId("xyz")).toBe(false);
    expect(isValidCustomId("../../x")).toBe(false);
  });
  it("pack slug validators accept lowercase slugs, reject unsafe input", () => {
    expect(isValidPackId("my-pack")).toBe(true);
    expect(isValidPackId("a")).toBe(true);
    expect(isValidPackId("My-Pack")).toBe(false);
    expect(isValidPackId("-bad")).toBe(false);
    expect(isValidPackId("../x")).toBe(false);
    expect(isValidPackId("a".repeat(65))).toBe(false);
    expect(isValidPackIconKey("plex-4k")).toBe(true);
    expect(isValidPackIconKey("Plex")).toBe(false);
  });
});
