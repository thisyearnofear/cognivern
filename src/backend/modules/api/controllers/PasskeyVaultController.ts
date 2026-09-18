/**
 * PasskeyVault controller — the "one passkey, many agent keys" lifecycle.
 *
 * The user's passkey (mera) wraps a server-side 32-byte root; agent spend
 * keys are HKDF-derived under agent+mandate contexts. All routes are
 * JWT/API-key authed (mounted under /api) — the root crosses TLS only during
 * enroll-begin and unlock-commit, and never persists in plaintext.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import {
  owsLocalVaultService,
  type OwsLocalVaultService,
} from '@backend/services/blockchain/OwsLocalVaultService.js';
import { creRunStore } from '@backend/cre/storage/CreRunStore.js';
import { CreRunRecorder } from '@backend/cre/runRecorder.js';

const enrollCommitSchema = z.object({
  vault: z.record(z.unknown()),
});

const unlockCommitSchema = z.object({
  root: z.string().min(1),
});

const deriveKeySchema = z.object({
  agentId: z.string().min(1),
  mandateId: z.string().optional(),
});

function errorStatus(message: string): number {
  if (/locked/i.test(message)) return 423;
  if (/not enrolled|no passkey|no pending/i.test(message)) return 409;
  return 400;
}

export class PasskeyVaultController {
  constructor(
    private readonly vault: OwsLocalVaultService = owsLocalVaultService,
  ) {}

  async getStatus(_req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: this.vault.keyRootStatus(),
      timestamp: new Date().toISOString(),
    });
  }

  /** Returns the provisional 32-byte root (base64) for the client to wrap. */
  async enrollBegin(_req: Request, res: Response): Promise<void> {
    const result = this.vault.enrollKeyRootBegin();
    if ('error' in result) {
      res.status(errorStatus(result.error)).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  /** Persists the passkey-wrapped vault blob; the root goes hot. */
  async enrollCommit(req: Request, res: Response): Promise<void> {
    const parse = enrollCommitSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid enroll commit payload',
        details: parse.error.format(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = this.vault.enrollKeyRootCommit(parse.data.vault);
    if ('error' in result) {
      res.status(errorStatus(result.error)).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const recorder = new CreRunRecorder({
      workflow: 'registration',
      mode: 'local',
      projectId: req.workspaceId || 'passkey-vault',
    });
    await creRunStore.add(recorder.getRun());
    await recorder.addArtifact({
      type: 'passkey_vault',
      data: { event: 'enroll', verifier: result.verifier },
    });
    await recorder.finish(true);
    await creRunStore.replace(recorder.getRun());

    res.status(201).json({
      success: true,
      data: result,
      runId: recorder.getRun().runId,
      timestamp: new Date().toISOString(),
    });
  }

  /** Returns the wrapped vault blob for the client-side passkey ceremony. */
  async unlockBegin(_req: Request, res: Response): Promise<void> {
    const result = this.vault.unlockKeyRootBegin();
    if ('error' in result) {
      res.status(errorStatus(result.error)).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  /** Accepts the unwrapped root (base64); verified against the stored hash. */
  async unlockCommit(req: Request, res: Response): Promise<void> {
    const parse = unlockCommitSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid unlock commit payload',
        details: parse.error.format(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = this.vault.unlockKeyRootCommit(parse.data.root);
    if ('error' in result) {
      res.status(errorStatus(result.error)).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  async lock(_req: Request, res: Response): Promise<void> {
    this.vault.lockKeyRoot();
    res.json({
      success: true,
      data: { locked: true },
      timestamp: new Date().toISOString(),
    });
  }

  async listAgentKeys(_req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: this.vault.listDerivedKeys(),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Derive (or re-derive) an agent spend key under its mandate context and
   * register it as a vault wallet. Idempotent per context — the wallet id is
   * what downstream spend paths use.
   */
  async deriveAgentKey(req: Request, res: Response): Promise<void> {
    const parse = deriveKeySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid derive payload',
        details: parse.error.format(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await this.vault.deriveAgentKey({
      agentId: parse.data.agentId,
      mandateId: parse.data.mandateId,
    });
    if ('error' in result) {
      res.status(errorStatus(result.error)).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const recorder = new CreRunRecorder({
      workflow: 'registration',
      mode: 'local',
      projectId: req.workspaceId || 'passkey-vault',
    });
    await creRunStore.add(recorder.getRun());
    await recorder.addArtifact({
      type: 'passkey_vault',
      data: { event: 'derive', ...result },
    });
    await recorder.finish(true);
    await creRunStore.replace(recorder.getRun());

    res.status(201).json({
      success: true,
      data: result,
      runId: recorder.getRun().runId,
      timestamp: new Date().toISOString(),
    });
  }
}

export const passkeyVaultController = new PasskeyVaultController();
