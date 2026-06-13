import type {
  DeviceSessionId,
  DiscoveredDevice,
  DeviceActionStatus,
  TransportFactory,
} from "@ledgerhq/device-management-kit";
import { Observable } from "rxjs";

import { SigningProvider, SigningParams, SigningResult } from "./SigningProvider.js";

const ETH_DERIVATION_PATH = "m/44'/60'/0'/0/0";
const DISCOVERY_TIMEOUT_MS = 15_000;

const STATUS_COMPLETED = "completed";
const STATUS_ERROR = "error";
const STATUS_STOPPED = "stopped";

interface DeviceActionStateBase {
  status: DeviceActionStatus;
}

type DeviceManagementKit = import("@ledgerhq/device-management-kit").DeviceManagementKit;

export class LedgerSigningProvider implements SigningProvider {
  readonly name = "ledger";

  private dmk: DeviceManagementKit | null = null;
  private sessionId: DeviceSessionId | null = null;
  private transportFactory: TransportFactory | null = null;

  constructor(transportFactory?: TransportFactory) {
    this.transportFactory = transportFactory || null;
  }

  private async loadTransport(): Promise<TransportFactory> {
    if (this.transportFactory) {
      return this.transportFactory;
    }
    try {
      const { nodeHidTransportFactory } = await import(
        "@ledgerhq/device-transport-kit-node-hid"
      );
      this.transportFactory = nodeHidTransportFactory;
      return nodeHidTransportFactory;
    } catch {
      try {
        const { speculosTransportFactory } = await import(
          "@ledgerhq/device-transport-kit-speculos"
        );
        const factory = speculosTransportFactory();
        this.transportFactory = factory;
        return factory;
      } catch {
        throw new Error(
          "No Ledger transport available. Install @ledgerhq/device-transport-kit-node-hid " +
            "for USB devices or @ledgerhq/device-transport-kit-speculos for emulated devices.",
        );
      }
    }
  }

  private async ensureConnected(): Promise<{
    dmk: DeviceManagementKit;
    sessionId: DeviceSessionId;
  }> {
    if (this.dmk && this.sessionId) {
      return { dmk: this.dmk, sessionId: this.sessionId };
    }

    const transport = await this.loadTransport();

    const { DeviceManagementKitBuilder } = await import(
      "@ledgerhq/device-management-kit"
    );

    const dmk = new DeviceManagementKitBuilder()
      .addTransport(transport)
      .build();

    const device = await new Promise<DiscoveredDevice>((resolve, reject) => {
      let resolved = false;
      const sub = (
        dmk.startDiscovering({}) as Observable<DiscoveredDevice>
      ).subscribe({
        next: (d: DiscoveredDevice) => {
          if (!resolved) {
            resolved = true;
            sub.unsubscribe();
            resolve(d);
          }
        },
        error: (err: Error) => {
          if (!resolved) {
            resolved = true;
            sub.unsubscribe();
            reject(
              new Error(`Ledger device discovery error: ${err.message}`),
            );
          }
        },
      });
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          sub.unsubscribe();
          reject(
            new Error(
              `No Ledger device found within ${DISCOVERY_TIMEOUT_MS / 1000}s. ` +
                "Connect and unlock your Ledger, then open the Ethereum app.",
            ),
          );
        }
      }, DISCOVERY_TIMEOUT_MS);
    });

    const sessionId = await dmk.connect({ device });

    this.dmk = dmk;
    this.sessionId = sessionId;

    return { dmk, sessionId };
  }

  private awaitDeviceAction<T extends { output: unknown }>(
    observable: Observable<DeviceActionStateBase>,
  ): Promise<T["output"]> {
    return new Promise((resolve, reject) => {
      let resolved = false;
      const sub = observable.subscribe({
        next: (state: DeviceActionStateBase) => {
          const s = state.status as string;
          if (s === STATUS_COMPLETED) {
            if (!resolved) {
              resolved = true;
              sub.unsubscribe();
              resolve((state as unknown as T).output);
            }
          } else if (s === STATUS_ERROR || s === STATUS_STOPPED) {
            if (!resolved) {
              resolved = true;
              sub.unsubscribe();
              const errMsg =
                (state as unknown as { error?: { message?: string } }).error
                  ?.message || JSON.stringify(state);
              reject(new Error(`Ledger action failed: ${errMsg}`));
            }
          }
        },
        error: (err: Error) => {
          if (!resolved) {
            resolved = true;
            sub.unsubscribe();
            reject(
              new Error(`Ledger communication error: ${err.message || String(err)}`),
            );
          }
        },
      });
    });
  }

  async sign(params: SigningParams): Promise<SigningResult> {
    const { dmk, sessionId } = await this.ensureConnected();

    const { SignerEthBuilder } = await import(
      "@ledgerhq/device-signer-kit-ethereum"
    );
    const signer = new SignerEthBuilder({ dmk, sessionId }).build();
    const derivationPath = params.derivationPath || ETH_DERIVATION_PATH;

    const msgAction = signer.signMessage(derivationPath, params.message);
    const signature = await this.awaitDeviceAction<{
      output: { r: string; s: string; v: number };
    }>(msgAction.observable as unknown as Observable<DeviceActionStateBase>);

    const r = signature.r.startsWith("0x") ? signature.r.slice(2) : signature.r;
    const s = signature.s.startsWith("0x") ? signature.s.slice(2) : signature.s;
    const vVal = signature.v < 27 ? signature.v + 27 : signature.v;
    const serialized = `0x${r}${s}${vVal.toString(16).padStart(2, "0")}`;

    const addrAction = signer.getAddress(derivationPath);
    const address = await this.awaitDeviceAction<{
      output: { address: string };
    }>(addrAction.observable as unknown as Observable<DeviceActionStateBase>);

    return { signature: serialized, signer: address.address };
  }
}

export const ledgerSigningProvider = new LedgerSigningProvider();
