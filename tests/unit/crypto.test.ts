import { describe, it, expect } from "vitest";
import { encrypt, decrypt, generateKey } from "@/server/crypto";

describe("crypto (AES-256-GCM)", () => {
  it("round-trips a secret with an explicit key", () => {
    const key = generateKey();
    const secret = "super-secret-token-123";
    const payload = encrypt(secret, key);

    expect(payload).not.toContain(secret);
    expect(payload.split(":")).toHaveLength(3);
    expect(decrypt(payload, key)).toBe(secret);
  });

  it("fails to decrypt with the wrong key (auth tag mismatch)", () => {
    const payload = encrypt("hello", generateKey());
    expect(() => decrypt(payload, generateKey())).toThrow();
  });

  it("rejects a malformed payload", () => {
    expect(() => decrypt("not-a-valid-payload", generateKey())).toThrow();
  });
});
