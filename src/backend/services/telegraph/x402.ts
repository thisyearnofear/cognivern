/**
 * x402 Payment-Aware Fetch
 *
 * Wraps native fetch so Telegraph paid calls (engine ask, direct miner calls)
 * transparently handle HTTP 402 Payment Required:
 *   1. First request is made normally
 *   2. On 402, the challenge is parsed from the Payment-Required header
 *   3. An EIP-3009 TransferWithAuthorization is signed with the configured
 *      private key
 *   4. The request is retried with the PAYMENT header attached
 *
 * The agent/application never sees the payment flow, the private key, or the
 * blockchain transaction — exactly how the official Telegraph MCP server works.
 *
 * Solana (SVM) support: when TELEGRAPH_SOLANA_PRIVATE_KEY (base58) is set, an
 * SVM scheme registers alongside EVM and calls whose 402 challenge offers a
 * solana:* payment option settle on Solana instead. The live testnet accepts
 * solana:EtWTRABZaYq... (devnet); mainnet acceptance is decided by the
 * facilitator's offer, not this client.
 */

import {
  wrapFetchWithPayment,
  x402Client,
  type SchemeRegistration,
  type x402ClientConfig,
} from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { ExactSvmScheme, toClientSvmSigner } from "@x402/svm";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import { base58 } from "@scure/base";
import { privateKeyToAccount } from "viem/accounts";

export type PaymentAwareFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface X402SchemeConfig {
  evmPrivateKey?: string;
  evmNetwork?: string;
  solanaPrivateKey?: string;
  svmNetwork?: string;
}

/**
 * Build a payment-aware fetch from the configured signing keys.
 *
 * Returns null when no usable payment scheme can be constructed (no keys,
 * or signer setup failed). Callers decide whether that means "unpaid calls
 * only" or "disabled". Either rail alone is sufficient; both may register.
 */
export async function createPaymentAwareFetch(
  config: X402SchemeConfig,
): Promise<PaymentAwareFetch | null> {
  const schemes: SchemeRegistration[] = [];

  if (config.evmPrivateKey) {
    try {
      const account = privateKeyToAccount(config.evmPrivateKey as `0x${string}`);
      const evmSigner = toClientEvmSigner(account);
      schemes.push({
        network: (config.evmNetwork ?? "eip155:*") as `${string}:${string}`,
        client: new ExactEvmScheme(evmSigner),
      });
      console.error(
        `[telegraph-x402] EVM payment enabled (network: ${config.evmNetwork ?? "eip155:*"}, from: ${account.address})`,
      );
    } catch (error) {
      console.error("[telegraph-x402] EVM signer setup failed", { error });
    }
  }

  if (config.solanaPrivateKey) {
    try {
      const secretKey = base58.decode(config.solanaPrivateKey);
      if (secretKey.length !== 64) {
        throw new Error(`expected 64-byte secret key, got ${secretKey.length}`);
      }
      const svmSigner = toClientSvmSigner(
        await createKeyPairSignerFromBytes(secretKey),
      );
      schemes.push({
        network: (config.svmNetwork ?? "solana:*") as `${string}:${string}`,
        client: new ExactSvmScheme(svmSigner),
      });
      console.error(
        `[telegraph-x402] SVM payment enabled (network: ${config.svmNetwork ?? "solana:*"}, from: ${svmSigner.address})`,
      );
    } catch (error) {
      console.error("[telegraph-x402] SVM signer setup failed", { error });
    }
  }

  if (schemes.length === 0) {
    return null;
  }

  const client = x402Client.fromConfig({
    schemes,
  } as x402ClientConfig);

  return wrapFetchWithPayment(fetch, client);
}
