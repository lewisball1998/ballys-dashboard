import { describe, it, expect } from "vitest";
import { redactSerial, sanitiseLabel } from "@/server/telemetry/redact";

describe("redactSerial", () => {
  it("masks the middle, keeping head + tail", () => {
    expect(redactSerial("WD-WCC4E1234567")).toBe("WD…4567");
    expect(redactSerial("ABCDEFG")).toBe("AB…DEFG");
  });

  it("fully masks short serials", () => {
    expect(redactSerial("ABC123")).toBe("••••");
  });

  it("returns null for empty / missing", () => {
    expect(redactSerial("")).toBeNull();
    expect(redactSerial(null)).toBeNull();
    expect(redactSerial(undefined)).toBeNull();
  });
});

describe("sanitiseLabel", () => {
  it("trims and collapses whitespace", () => {
    expect(sanitiseLabel("  Samsung   SSD 970  ")).toBe("Samsung SSD 970");
  });

  it("drops anything that looks like an absolute path", () => {
    expect(sanitiseLabel("/var/lib/secret/key")).toBeNull();
    expect(sanitiseLabel("/dev/sda")).toBeNull();
  });

  it("caps length", () => {
    const long = "X".repeat(100);
    const out = sanitiseLabel(long, 16);
    expect(out).not.toBeNull();
    expect((out as string).length).toBeLessThanOrEqual(16);
  });

  it("returns null for empty / missing", () => {
    expect(sanitiseLabel("")).toBeNull();
    expect(sanitiseLabel(null)).toBeNull();
  });
});
