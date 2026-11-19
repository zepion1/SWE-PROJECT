import { describe, expect, it } from "vitest";
import { hashPassword, sha256, verifyPassword } from "../src/core/crypto";

describe("password hashing (N4)", () => {
  it("stores a salted scrypt hash and verifies it", () => {
    const hash = hashPassword("correct horse battery");
    expect(hash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(hash).not.toContain("correct horse battery");
    expect(verifyPassword("correct horse battery", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
  });

  it("uses a different salt every time", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });

  it("hashes session tokens deterministically", () => {
    expect(sha256("token")).toBe(sha256("token"));
    expect(sha256("token")).toHaveLength(64);
  });
});
