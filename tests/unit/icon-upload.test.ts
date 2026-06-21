import { describe, expect, it } from "vitest";
import {
  ALLOWED_ICON_TYPES,
  MAX_ICON_BYTES,
  extForType,
  mimeForType,
  sniffImageType,
} from "@/lib/icons/upload";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
const WEBP = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x00,
]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

describe("sniffImageType (magic bytes, not declared type)", () => {
  it("detects PNG", () => {
    expect(sniffImageType(PNG)).toBe("png");
  });
  it("detects WebP", () => {
    expect(sniffImageType(WEBP)).toBe("webp");
  });
  it("rejects JPEG (unsupported)", () => {
    expect(sniffImageType(JPEG)).toBeNull();
  });
  it("rejects SVG (user SVG is not allowed in v0.2.6)", () => {
    expect(sniffImageType(SVG)).toBeNull();
  });
  it("rejects empty / too-short buffers", () => {
    expect(sniffImageType(new Uint8Array())).toBeNull();
    expect(sniffImageType(Uint8Array.from([0x89, 0x50]))).toBeNull();
  });
  it("rejects RIFF that is not WEBP", () => {
    const riffWav = Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);
    expect(sniffImageType(riffWav)).toBeNull();
  });
});

describe("upload constants", () => {
  it("caps size at 512 KB", () => {
    expect(MAX_ICON_BYTES).toBe(512 * 1024);
  });
  it("maps types to canonical mime + ext", () => {
    expect(mimeForType("png")).toBe("image/png");
    expect(mimeForType("webp")).toBe("image/webp");
    expect(extForType("png")).toBe("png");
    expect(Object.keys(ALLOWED_ICON_TYPES).sort()).toEqual(["png", "webp"]);
  });
});
