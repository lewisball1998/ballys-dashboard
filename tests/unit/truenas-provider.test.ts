import { describe, it, expect } from "vitest";
import {
  buildWebSocketUrl,
  isTrueNasConfigured,
  parseInsecureFlag,
  resolveStatus,
} from "@/server/telemetry/truenas/provider";

describe("parseInsecureFlag", () => {
  it("is false unless explicitly opted in", () => {
    expect(parseInsecureFlag(undefined)).toBe(false);
    expect(parseInsecureFlag("")).toBe(false);
    expect(parseInsecureFlag("false")).toBe(false);
    expect(parseInsecureFlag("0")).toBe(false);
    expect(parseInsecureFlag("no")).toBe(false);
  });

  it("accepts explicit truthy strings", () => {
    expect(parseInsecureFlag("true")).toBe(true);
    expect(parseInsecureFlag("TRUE")).toBe(true);
    expect(parseInsecureFlag(" 1 ")).toBe(true);
    expect(parseInsecureFlag("yes")).toBe(true);
  });
});

describe("isTrueNasConfigured", () => {
  it("requires both URL and API key", () => {
    expect(isTrueNasConfigured({ url: "https://nas", apiKey: "k" })).toBe(true);
    expect(isTrueNasConfigured({ url: "https://nas" })).toBe(false);
    expect(isTrueNasConfigured({ apiKey: "k" })).toBe(false);
    expect(isTrueNasConfigured({ url: "  ", apiKey: "k" })).toBe(false);
    expect(isTrueNasConfigured({})).toBe(false);
  });
});

describe("resolveStatus", () => {
  it("is available only when pools, disks and datasets all succeed", () => {
    expect(resolveStatus({ pools: true, disks: true, datasets: true })).toBe("available");
  });

  it("is partial when a core read is missing but something came back", () => {
    expect(resolveStatus({ pools: true, disks: false, datasets: true })).toBe("partial");
    expect(resolveStatus({ pools: true, disks: true, datasets: false })).toBe("partial");
    expect(resolveStatus({ pools: false, disks: true, datasets: false })).toBe("partial");
  });

  it("is unavailable when neither pools nor disks came back", () => {
    expect(resolveStatus({ pools: false, disks: false, datasets: false })).toBe("unavailable");
    expect(resolveStatus({ pools: false, disks: false, datasets: true })).toBe("unavailable");
  });
});

describe("buildWebSocketUrl", () => {
  it("maps https -> wss and http -> ws, applying the API path", () => {
    const wss = buildWebSocketUrl("https://truenas.example.local:8443", "/api/current");
    expect(wss.protocol).toBe("wss:");
    expect(wss.host).toBe("truenas.example.local:8443");
    expect(wss.pathname).toBe("/api/current");

    const ws = buildWebSocketUrl("http://truenas.example.local", "/api/current");
    expect(ws.protocol).toBe("ws:");
    expect(ws.pathname).toBe("/api/current");
  });

  it("throws on an invalid URL (caller treats as a calm unavailable state)", () => {
    expect(() => buildWebSocketUrl("not-a-valid-url", "/api/current")).toThrow();
  });
});
