import type {
  SigningProvider,
  SigningParams,
  SigningResult,
} from "./SigningProvider.js";
import {
  signDynamicMessage,
  type DynamicWalletMetadata,
} from "@backend/services/blockchain/dynamic/DynamicServerWalletClient.js";
import { owsLocalVaultService } from "@backend/services/blockchain/OwsLocalVaultService.js";

/**
 * Dynamic server-wallet signing provider (EIP-191 personal_sign).
 *
 * Loads `dynamicWalletMetadata` from the OWS wallet metadata bag when present;
 * otherwise falls back to the process-level provisioned wallet file / env.
 */
export class DynamicSigningProvider implements SigningProvider {
  readonly name = "dynamic";

  constructor(
    private readonly signMessage: typeof signDynamicMessage = signDynamicMessage,
    private readonly resolveWalletMetadata: (
      walletId: string,
    ) => Promise<DynamicWalletMetadata | null> = async (walletId) => {
      const wallets = await owsLocalVaultService.listWallets();
      const wallet = wallets.find((w) => w.id === walletId);
      const meta = wallet?.metadata as Record<string, unknown> | undefined;
      const embedded = meta?.dynamicWalletMetadata;
      if (embedded && typeof embedded === "object") {
        return embedded as DynamicWalletMetadata;
      }
      return null;
    },
  ) {}

  async sign(params: SigningParams): Promise<SigningResult> {
    const walletMetadata = await this.resolveWalletMetadata(params.walletId);
    return this.signMessage({
      message: params.message,
      walletMetadata,
    });
  }
}

export const dynamicSigningProvider = new DynamicSigningProvider();
