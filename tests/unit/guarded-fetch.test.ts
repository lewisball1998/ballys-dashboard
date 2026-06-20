import { describe, it, expect } from "vitest";
import {
  isPrivateAddress,
  validateRequestUrl,
  GuardedFetchError,
} from "@/server/http/guarded-fetch";

describe("isPrivateAddress", () => {
  it("flags private / reserved IPv4", () => {
    for (const ip of ["10.0.0.1", "192.168.1.1", "172.16.0.1", "127.0.0.1", "169.254.1.1", "100.64.0.1"]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
  });

  it("allows public IPv4", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34"]) {
      expect(isPrivateAddress(ip)).toBe(false);
    }
  });

  it("flags loopback / ULA / link-local IPv6 and mapped v4", () => {
    for (const ip of ["::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
  });

  it("treats non-IP strings as unsafe", () => {
    expect(isPrivateAddress("not-an-ip")).toBe(true);
  });
});

describe("validateRequestUrl", () => {
  it("rejects non-http(s) protocols", async () => {
    await expect(validateRequestUrl("file:///etc/passwd", "allow")).rejects.toBeInstanceOf(
      GuardedFetchError,
    );
  });

  it("rejects malformed URLs", async () => {
    await expect(validateRequestUrl("::::", "allow")).rejects.toBeInstanceOf(GuardedFetchError);
  });

  it("allows a LAN URL when privateNetwork=allow (the product default)", async () => {
    const url = await validateRequestUrl("http://192.168.1.50:8080/health", "allow");
    expect(url.hostname).toBe("192.168.1.50");
  });

  it("blocks a private-IP URL when privateNetwork=block", async () => {
    await expect(validateRequestUrl("http://127.0.0.1/admin", "block")).rejects.toMatchObject({
      code: "blocked_address",
    });
  });
});
