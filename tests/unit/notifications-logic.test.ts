import { describe, expect, it } from "vitest";
import {
  buildNotificationQuery,
  EMPTY_FILTER,
  formatCount,
  formatRelativeTime,
  severityLabel,
  severityTone,
} from "@/components/notifications/notifications-logic";

describe("severity mapping", () => {
  it("maps severity to a badge tone and label", () => {
    expect(severityTone("info")).toBe("info");
    expect(severityTone("success")).toBe("success");
    expect(severityTone("warning")).toBe("warning");
    expect(severityTone("error")).toBe("error");
    expect(severityLabel("warning")).toBe("Warning");
  });
});

describe("formatCount", () => {
  it("formats the bell count", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(5)).toBe("5");
    expect(formatCount(99)).toBe("99");
    expect(formatCount(150)).toBe("99+");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-06-20T12:00:00Z");
  it("formats recent times", () => {
    expect(formatRelativeTime("2026-06-20T11:59:50Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-06-20T11:55:00Z", now)).toBe("5m ago");
    expect(formatRelativeTime("2026-06-20T10:00:00Z", now)).toBe("2h ago");
    expect(formatRelativeTime("2026-06-17T12:00:00Z", now)).toBe("3d ago");
  });
  it("returns empty string for an invalid date", () => {
    expect(formatRelativeTime("not-a-date", now)).toBe("");
  });
});

describe("buildNotificationQuery", () => {
  it("is empty for the default filter", () => {
    expect(buildNotificationQuery(EMPTY_FILTER)).toBe("");
  });

  it("omits severity when 'all' but keeps paging", () => {
    expect(buildNotificationQuery({ ...EMPTY_FILTER, severity: "all" }, { limit: 50 })).toBe("limit=50");
  });

  it("encodes active filters and paging", () => {
    const q = buildNotificationQuery(
      { unreadOnly: true, includeDismissed: true, severity: "error", source: "  sys " },
      { limit: 100, offset: 20 },
    );
    expect(q).toContain("unread=true");
    expect(q).toContain("includeDismissed=true");
    expect(q).toContain("severity=error");
    expect(q).toContain("source=sys"); // trimmed
    expect(q).toContain("limit=100");
    expect(q).toContain("offset=20");
  });
});
