import { describe, expect, it } from "vitest";
import {
  buildBuiltinRef,
  buildCustomRef,
  isValidCustomId,
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
});

describe("ref builders + validators", () => {
  it("buildBuiltinRef encodes the optional variant", () => {
    expect(buildBuiltinRef("media")).toBe("builtin:media");
    expect(buildBuiltinRef("media", "4k")).toBe("builtin:media?v=4k");
  });
  it("buildCustomRef prefixes the id", () => {
    expect(buildCustomRef("abc")).toBe("custom:abc");
  });
  it("isValidCustomId accepts hex tokens only", () => {
    expect(isValidCustomId("0123456789abcdef0123456789abcdef")).toBe(true);
    expect(isValidCustomId("xyz")).toBe(false);
    expect(isValidCustomId("../../x")).toBe(false);
  });
});
