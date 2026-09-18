/**
 * ERC-8004 controller — agent identity + reputation on Monad.
 *
 * Authed routes live under /api/erc8004/* (JWT/API-key). The registration
 * card and the well-known domain-verification file are also served publicly
 * at the app root — they only ever expose data that is already published
 * on-chain for registered agents.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { erc8004Config } from '@backend/shared/config/index.js';
import {
  erc8004Service,
  type Erc8004Service,
} from '@backend/services/blockchain/erc8004/Erc8004Service.js';
import {
  owsLocalVaultService,
  type OwsLocalVaultService,
} from '@backend/services/blockchain/OwsLocalVaultService.js';
import { creRunStore } from '@backend/cre/storage/CreRunStore.js';
import { CreRunRecorder } from '@backend/cre/runRecorder.js';

const registerSchema = z.object({
  agentId: z.string().min(1),
  walletId: z.string().optional(),
  agentURI: z.string().optional(),
});

const feedbackSchema = z.object({
  value: z.union([z.number(), z.string()]),
  valueDecimals: z.number().int().min(0).max(18).optional(),
  tag1: z.string().optional(),
  tag2: z.string().optional(),
  endpoint: z.string().optional(),
  feedbackURI: z.string().optional(),
  feedbackHash: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .optional(),
  walletId: z.string().optional(),
  runId: z.string().optional(),
});

function errorStatus(message: string): number {
  if (/not found/i.test(message)) return 404;
  if (/not enabled|not configured|no erc-8004/i.test(message)) return 503;
  return 400;
}

export class Erc8004Controller {
  constructor(
    private readonly service: Erc8004Service = erc8004Service,
    private readonly vault: OwsLocalVaultService = owsLocalVaultService,
  ) {}

  async getStatus(_req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: this.service.status(),
      timestamp: new Date().toISOString(),
    });
  }

  async register(req: Request, res: Response): Promise<void> {
    const parse = registerSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid register payload',
        details: parse.error.format(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const recorder = new CreRunRecorder({
      workflow: 'registration',
      mode: 'local',
      projectId: req.workspaceId || 'erc8004',
    });
    await creRunStore.add(recorder.getRun());

    const result = await this.service.registerAgent({
      agentId: parse.data.agentId,
      walletId: parse.data.walletId,
      agentURI: parse.data.agentURI,
      // JWT-authed operator authority substitutes for the scoped key, same
      // substitution model as held-spend resume.
      operatorApproved: true,
    });

    if ('error' in result) {
      await recorder.addArtifact({
        type: 'error',
        data: { stage: 'erc8004_register', error: result.error },
      });
      await recorder.finish(false);
      await creRunStore.replace(recorder.getRun());
      res.status(errorStatus(result.error)).json({
        success: false,
        error: result.error,
        runId: recorder.getRun().runId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await recorder.addArtifact({
      type: 'erc8004_identity',
      data: result.binding,
    });
    await recorder.finish(true);
    await creRunStore.replace(recorder.getRun());

    res.status(201).json({
      success: true,
      data: {
        binding: result.binding,
        registerTxLink: erc8004Config.explorerTxUrl(result.binding.registerTxHash),
        setUriTxLink: result.binding.setUriTxHash
          ? erc8004Config.explorerTxUrl(result.binding.setUriTxHash)
          : undefined,
      },
      runId: recorder.getRun().runId,
      timestamp: new Date().toISOString(),
    });
  }

  async getAgent(req: Request, res: Response): Promise<void> {
    const agent = await this.vault.getAgent(req.params.agentId);
    if (!agent) {
      res.status(404).json({
        success: false,
        error: `Agent ${req.params.agentId} not found`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const binding = this.service.bindingFor(agent);
    let onChain: unknown = null;
    if (binding) {
      try {
        onChain = await this.service.getOnChainIdentity(binding.agentId);
      } catch {
        onChain = { error: 'on-chain lookup failed' };
      }
    }

    res.json({
      success: true,
      data: { agentId: agent.id, binding: binding ?? null, onChain },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Public registration file (agentURI target). 404 unless the agent has an
   * on-chain binding — the card is only public once the identity is public.
   */
  async getCard(req: Request, res: Response): Promise<void> {
    const agent = await this.vault.getAgent(req.params.agentId);
    const binding = agent ? this.service.bindingFor(agent) : undefined;
    if (!agent || !binding) {
      res.status(404).json({
        success: false,
        error: 'No published ERC-8004 registration for this agent',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json(this.service.buildRegistrationFile({ agent, binding }));
  }

  /**
   * Domain-verification file per the ERC: lists every registration this
   * deployment has published, so endpoint domains can be proven to clients.
   */
  async getWellKnown(_req: Request, res: Response): Promise<void> {
    const agents = await this.vault.listAgents();
    const registrations = agents
      .map((agent) => this.service.bindingFor(agent))
      .filter((b): b is NonNullable<typeof b> => Boolean(b))
      .map((b) => ({
        agentId: Number(b.agentId),
        agentRegistry: b.agentRegistry,
      }));
    res.json({ registrations });
  }

  async giveFeedback(req: Request, res: Response): Promise<void> {
    const parse = feedbackSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid feedback payload',
        details: parse.error.format(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const agent = await this.vault.getAgent(req.params.agentId);
    const binding = agent ? this.service.bindingFor(agent) : undefined;
    if (!agent || !binding) {
      res.status(404).json({
        success: false,
        error: `Agent ${req.params.agentId} has no ERC-8004 identity`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { runId, ...body } = parse.data;
    let feedbackURI = body.feedbackURI;
    let feedbackHash = body.feedbackHash;
    if (runId) {
      const run = await creRunStore.get(runId);
      if (!run) {
        res.status(404).json({
          success: false,
          error: `Run ${runId} not found`,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const base = erc8004Config.publicBaseUrl;
      feedbackURI = feedbackURI || (base ? `${base}/api/cre/runs/${runId}` : `cognivern:run:${runId}`);
      feedbackHash =
        feedbackHash || (run.evidence?.hash as `0x${string}` | undefined);
    }

    const walletId = body.walletId || agent.walletId;
    if (!walletId) {
      res.status(400).json({
        success: false,
        error: 'No walletId available to sign feedback — pass walletId',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await this.service.giveFeedback({
      agentId: binding.agentId,
      walletId,
      operatorApproved: true,
      value: body.value,
      valueDecimals: body.valueDecimals,
      tag1: body.tag1,
      tag2: body.tag2,
      endpoint: body.endpoint || (runId ? `run:${runId}` : undefined),
      feedbackURI,
      feedbackHash,
    });

    if ('error' in result) {
      res.status(errorStatus(result.error)).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  async getReputation(req: Request, res: Response): Promise<void> {
    const agent = await this.vault.getAgent(req.params.agentId);
    const binding = agent ? this.service.bindingFor(agent) : undefined;
    if (!agent || !binding) {
      res.status(404).json({
        success: false,
        error: `Agent ${req.params.agentId} has no ERC-8004 identity`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const reputation = await this.service.getReputation(binding.agentId, {
        tag1: typeof req.query.tag1 === 'string' ? req.query.tag1 : undefined,
        tag2: typeof req.query.tag2 === 'string' ? req.query.tag2 : undefined,
      });
      res.json({
        success: true,
        data: reputation,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(502).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Reputation lookup failed',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export const erc8004Controller = new Erc8004Controller();
