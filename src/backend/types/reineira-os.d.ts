// Ambient types for the optional @reineira-os/sdk package. The SDK is a
// private/unpublished package that is not always resolvable on the public
// registry; PrivaraPayrollService loads it lazily (dynamic import inside a
// try/catch → fallback mode), so the typecheck must not hard-fail when the
// package is absent. When the real package is installed its own types take
// precedence over this declaration.
declare module "@reineira-os/sdk" {
  export interface ReineiraEscrow {
    id: bigint | number;
    createTx?: { hash?: unknown };
    fund(
      amount: bigint,
      options: { autoApprove: boolean },
    ): Promise<{ tx?: { hash?: unknown } } | undefined>;
    redeem(): Promise<unknown>;
    exists(): Promise<boolean>;
    isFunded(): Promise<boolean>;
    isRedeemable(): Promise<boolean>;
  }

  export interface ReineiraEscrowBuilder {
    amount(amount: bigint): ReineiraEscrowBuilder;
    owner(address: string): ReineiraEscrowBuilder;
    create(): Promise<ReineiraEscrow>;
  }

  export interface ReineiraEscrowManager {
    build(): ReineiraEscrowBuilder;
    get(id: bigint): ReineiraEscrow;
  }

  export class ReineiraSDK {
    static create(config: {
      privateKey: string;
      rpcUrl?: string;
      network?: string;
    }): Promise<ReineiraSDK>;
    initialize?(): Promise<void>;
    escrow: ReineiraEscrowManager;
  }
}
