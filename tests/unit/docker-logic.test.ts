import { describe, expect, it } from "vitest";
import {
  formatPort,
  formatRelativeTime,
  healthMeta,
  isDisruptiveAction,
  stateMeta,
  unavailableCopy,
} from "@/components/docker/docker-logic";

describe("docker presentation logic", () => {
  it("maps states to tone + label", () => {
    expect(stateMeta("running")).toEqual({ tone: "success", label: "Running" });
    expect(stateMeta("dead")).toEqual({ tone: "error", label: "Dead" });
    expect(stateMeta("unknown")).toEqual({ tone: "neutral", label: "Unknown" });
  });

  it("returns a health badge only when a healthcheck exists", () => {
    expect(healthMeta("healthy")?.tone).toBe("success");
    expect(healthMeta("unhealthy")?.tone).toBe("error");
    expect(healthMeta("starting")?.tone).toBe("warning");
    expect(healthMeta("none")).toBeNull();
  });

  it("formats published and internal ports", () => {
    expect(formatPort({ privatePort: 80, publicPort: 8080, type: "tcp" })).toBe("8080→80/tcp");
    expect(formatPort({ privatePort: 443, publicPort: null, type: "tcp" })).toBe("443/tcp");
  });

  it("formats relative created time", () => {
    const now = Date.parse("2026-06-20T12:00:00Z");
    expect(formatRelativeTime("2026-06-20T11:59:30Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-06-20T11:30:00Z", now)).toBe("30m ago");
    expect(formatRelativeTime("2026-06-20T09:00:00Z", now)).toBe("3h ago");
    expect(formatRelativeTime("2026-06-18T12:00:00Z", now)).toBe("2d ago");
    expect(formatRelativeTime(new Date(0).toISOString(), now)).toBe("—");
    expect(formatRelativeTime("not-a-date", now)).toBe("—");
  });

  it("only treats stop/restart as disruptive (needing confirmation)", () => {
    expect(isDisruptiveAction("stop")).toBe(true);
    expect(isDisruptiveAction("restart")).toBe(true);
    expect(isDisruptiveAction("start")).toBe(false);
  });

  it("provides copy for each unavailable reason", () => {
    expect(unavailableCopy("not_configured").title).toMatch(/not configured/i);
    expect(unavailableCopy("permission_denied").title).toMatch(/permission/i);
    expect(unavailableCopy("unreachable").title).toMatch(/unreachable/i);
    expect(unavailableCopy("error").title).toMatch(/error/i);
  });
});
