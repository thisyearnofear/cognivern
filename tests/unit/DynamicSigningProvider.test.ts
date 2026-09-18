import { describe, expect, it, vi } from "vitest";
import { DynamicSigningProvider } from "@backend/signing/DynamicSigningProvider.js";

describe("DynamicSigningProvider", () => {
  it("returns signature and signer from the Dynamic client", async () => {
    const sign = vi.fn(async () => ({
      signature: "0xsig",
      signer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    }));
    const resolveWalletMetadata = vi.fn(async () => ({
      accountAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    }));

    const provider = new DynamicSigningProvider(sign as any, resolveWalletMetadata);
    const result = await provider.sign({
      walletId: "w-dyn",
      message: '{"kind":"spend"}',
    });

    expect(provider.name).toBe("dynamic");
    expect(result).toEqual({
      signature: "0xsig",
      signer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(sign).toHaveBeenCalledWith({
      message: '{"kind":"spend"}',
      walletMetadata: {
        accountAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
    });
  });

  it("propagates client failures", async () => {
    const provider = new DynamicSigningProvider(async () => {
      throw new Error("MPC ceremony failed");
    }, async () => null);

    await expect(
      provider.sign({ walletId: "w1", message: "hello" }),
    ).rejects.toThrow(/MPC ceremony failed/);
  });
});
