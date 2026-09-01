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
 * Solana (SVM) support: the live testnet also accepts solana:EtWTRABZaYq... payments.
 * To enable, install @x402/svm, @solana/kit, and @scure/base, then add the
 * Solana branch following the pattern in the MCP server's x402.ts reference.
 * For now, EVM (Base Sepolia) is the primary and tested path.
 */

import {
  wrapFetchWithPayment,
  x402Client,
  type SchemeRegistration,
  type x402ClientConfig,
} from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

export type PaymentAwareFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface X402SchemeConfig {
  evmPrivateKey?: string;
  evmNetwork?: string;
  solanaPrivateKey?: string; // reserved for future Solana support
  svmNetwork?: string;
}

/**
 * Build a payment-aware fetch from the configured EVM private key.
 *
 * Returns null when no usable payment scheme can be constructed (no key,
 * or signer setup failed). Callers decide whether that means "unpaid calls
 * only" or "disabled".
 *
 * Solana support: when @x402/svm is installed, add a second registration:
 *   schemes.push({
 *     network: config.svmNetwork ?? "solana:*",
 *     client: new ExactSvmScheme(toClientSvmSigner(keypair)),
 *   });
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

  if (schemes.length === 0) {
    return null;
  }

  const client = x402Client.fromConfig({
    schemes,
  } as x402ClientConfig);

  return wrapFetchWithPayment(fetch, client);
}
