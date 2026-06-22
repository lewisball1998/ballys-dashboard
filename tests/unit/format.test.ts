import { describe, it, expect } from "vitest";
import { formatClockMhz } from "@/lib/format";

describe("formatClockMhz", () => {
  it("formats valid MHz, promoting to GHz at/above 1000", () => {
    expect(formatClockMhz(800)).toBe("800 MHz");
    expect(formatClockMhz(999)).toBe("999 MHz");
    expect(formatClockMhz(1000)).toBe("1.00 GHz");
    expect(formatClockMhz(3600)).toBe("3.60 GHz");
  });

  it("renders invalid/unknown readings as — instead of a bogus 0 MHz", () => {
    expect(formatClockMhz(0)).toBe("—");
    expect(formatClockMhz(null)).toBe("—");
    expect(formatClockMhz(undefined)).toBe("—");
    expect(formatClockMhz(Number.NaN)).toBe("—");
    expect(formatClockMhz(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatClockMhz(-100)).toBe("—");
  });
});
