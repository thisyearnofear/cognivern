import { describe, it, expect } from "vitest";
import {
  addressesEqual,
  canonicalAddress,
  getAllowedSiweOrigins,
  resolveAuthenticatedAddress,
  validateSiweBindings,
  SIWE_MAX_AGE_MS,
} from "@backend/services/auth/siweIdentity.js";

const WALLET_A = "0x1111111111111111111111111111111111111111";
const WALLET_B = "0x2222222222222222222222222222222222222222";

const validMessage = {
  address: WALLET_A,
  domain: "localhost:3000",
  uri: "http://localhost:3000",
  chainId: 1,
  issuedAt: new Date().toISOString(),
};

describe("siweIdentity", () => {
  it("uses the signed address and rejects a mismatched body address", () => {
    expect(resolveAuthenticatedAddress(WALLET_A, WALLET_A)).toBe(
      canonicalAddress(WALLET_A),
    );
    expect(() => resolveAuthenticatedAddress(WALLET_A, WALLET_B)).toThrow(
      /does not match/,
    );
  });

  it("treats checksum and lowercase as the same wallet", () => {
    expect(
      addressesEqual(
        "0x1111111111111111111111111111111111111111",
        "0x1111111111111111111111111111111111111111",
      ),
    ).toBe(true);
    expect(
      resolveAuthenticatedAddress(
        "0x1111111111111111111111111111111111111111",
        "0x1111111111111111111111111111111111111111",
      ),
    ).toBe("0x1111111111111111111111111111111111111111");
  });

  it("allows a missing body address after signature verification", () => {
    expect(resolveAuthenticatedAddress(WALLET_A)).toBe(canonicalAddress(WALLET_A));
  });

  it("derives SIWE origins from CORS_ORIGIN", () => {
    const allowed = getAllowedSiweOrigins({
      CORS_ORIGIN: "http://localhost:3000,https://cognivern.persidian.com",
    });
    expect(allowed.map((entry) => entry.domain)).toEqual(
      expect.arrayContaining(["localhost:3000", "cognivern.persidian.com"]),
    );
  });

  it("rejects a SIWE message from another domain", () => {
    expect(() =>
      validateSiweBindings(
        { ...validMessage, domain: "evil.example", uri: "https://evil.example" },
        Date.now(),
        { CORS_ORIGIN: "http://localhost:3000" },
      ),
    ).toThrow(/domain/i);
  });

  it("rejects an unknown chain id", () => {
    expect(() =>
      validateSiweBindings(
        { ...validMessage, chainId: 999999 },
        Date.now(),
        { CORS_ORIGIN: "http://localhost:3000" },
      ),
    ).toThrow(/chain/i);
  });

  it("rejects a stale issued-at timestamp", () => {
    expect(() =>
      validateSiweBindings(
        {
          ...validMessage,
          issuedAt: new Date(Date.now() - SIWE_MAX_AGE_MS - 1000).toISOString(),
        },
        Date.now(),
        { CORS_ORIGIN: "http://localhost:3000" },
      ),
    ).toThrow(/expired/i);
  });
});
