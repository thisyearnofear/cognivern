import { Router } from 'express';
import {
  evaluateMandateDecision,
  evaluateMandateSuite,
  mandateDecisionRequestSchema,
} from '@backend/services/governance/SpendMandateDecisionService.js';
import { AuditLogService } from '@backend/services/governance/AuditLogService.js';
import { creRunStore } from '@backend/cre/storage/CreRunStore.js';
import type { SpendController } from '@backend/modules/api/controllers/SpendController.js';
import type { OwsController } from '@backend/modules/api/controllers/OwsController.js';
import type { OwsWalletController } from '@backend/modules/api/controllers/OwsWalletController.js';
import type { OwsApiKeyController } from '@backend/modules/api/controllers/OwsApiKeyController.js';
import type { OwsPermissionsController } from '@backend/modules/api/controllers/OwsPermissionsController.js';
import type { CleanverseController } from '@backend/modules/api/controllers/CleanverseController.js';
import type { Erc8004Controller } from '@backend/modules/api/controllers/Erc8004Controller.js';
import type { PasskeyVaultController } from '@backend/modules/api/controllers/PasskeyVaultController.js';
import type { EnvioController } from '@backend/modules/api/controllers/EnvioController.js';
import { sharedAgentPreferenceService } from '@backend/services/ai/AgentPreferenceService.js';

export function createSpendRoutes(
  spendController: SpendController,
  owsController: OwsController,
  owsWalletController: OwsWalletController,
  owsApiKeyController: OwsApiKeyController,
  owsPermissionsController: OwsPermissionsController,
  cleanverseCtrl?: CleanverseController,
  erc8004Ctrl?: Erc8004Controller,
  passkeyVaultCtrl?: PasskeyVaultController,
  envioCtrl?: EnvioController,
): Router {
  const router = Router();

  // SpendOS routes
  router.post('/spend/authorizations', (req, res) =>
    spendController.createSourceAuthorization(req, res),
  );
  router.post('/spend', (req, res) => spendController.requestSpend(req, res));
  router.post('/spend/encrypted', (req, res) => spendController.requestEncryptedSpend(req, res));
  router.post('/spend/preview', (req, res) => spendController.previewSpend(req, res));

  // Pre-flight mandate decision — deterministic four-way contract
  // (ALLOW/REFUSE/ESCALATE/ASK_CLARIFICATION) evaluated before any spend is
  // attempted. Every decision is written to the CRE audit ledger.
  const mandateAuditLog = new AuditLogService();
  router.post('/spend/mandate-decision', async (req, res) => {
    const parsed = mandateDecisionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid mandate decision request',
        details: parsed.error.format(),
      });
      return;
    }
    const { mandate, request } = parsed.data;
    const decision = evaluateMandateDecision(mandate, request);
    const workspaceId = req.workspaceId;
    mandateAuditLog
      .logEvent({
        eventType: 'mandate_spend_decision',
        agentType: mandate.agent_id ?? 'unknown',
        timestamp: new Date(),
        projectId: workspaceId,
        details: {
          event_type: 'mandate_spend_decision',
          agent_id: mandate.agent_id ?? 'unknown',
          decision: decision.decision,
          reason_code: decision.reason_code,
          rule: decision.rule,
          mandate,
          request,
          item_decisions: decision.item_decisions,
        },
      })
      .catch(() => {});
    res.json({ success: true, data: decision });
  });

  // Compliance regression harness — run a workspace-supplied scenario suite
  // (mandate + request + expected decision) through the deterministic oracle
  // and return per-scenario verdicts plus the same metrics used for the Lexsi
  // eval (accuracy, unsafe_enforced, error classes).
  router.post('/spend/mandate-eval', async (req, res) => {
    const body = req.body as { scenarios?: unknown };
    if (!Array.isArray(body?.scenarios) || body.scenarios.length === 0) {
      res.status(400).json({
        success: false,
        error: 'scenarios must be a non-empty array of {mandate, request, expected}',
      });
      return;
    }
    if (body.scenarios.length > 500) {
      res.status(400).json({ success: false, error: 'max 500 scenarios per eval' });
      return;
    }
    const { results, metrics } = evaluateMandateSuite(
      body.scenarios as Parameters<typeof evaluateMandateSuite>[0],
    );
    const workspaceId = req.workspaceId;
    mandateAuditLog
      .logEvent({
        eventType: 'mandate_eval_run',
        agentType: 'mandate-eval',
        timestamp: new Date(),
        projectId: workspaceId,
        details: {
          event_type: 'mandate_eval_run',
          n: metrics.n,
          accuracy: metrics.accuracy,
          unsafe_enforced_count: metrics.unsafe_enforced_count,
          error_classes: metrics.error_classes,
        },
      })
      .catch(() => {});
    res.json({ success: true, data: { metrics, results } });
  });

  // Decision assurance summary — aggregates mandate_spend_decision CRE events
  // into per-decision-type counts so the ledger surfaces the four-way decision
  // distribution (allow/refuse/escalate/ask_clarification) per workspace.
  router.get('/spend/mandate-decisions/summary', async (req, res) => {
    const runs = await creRunStore.list();
    const byDecision: Record<string, number> = {};
    const byAgent: Record<string, Record<string, number>> = {};
    let total = 0;
    for (const run of runs) {
      for (const artifact of run.artifacts ?? []) {
        const data = artifact.data as Record<string, unknown> | undefined;
        if (data?.event_type !== 'mandate_spend_decision') continue;
        const decision = String(data.decision ?? 'unknown').toUpperCase();
        byDecision[decision] = (byDecision[decision] ?? 0) + 1;
        const agent = String(data.agent_id ?? run.provenance?.model ?? 'unknown');
        byAgent[agent] = byAgent[agent] ?? {};
        byAgent[agent][decision] = (byAgent[agent][decision] ?? 0) + 1;
        total += 1;
        break; // one decision artifact per run
      }
    }
    res.json({
      success: true,
      data: { total, by_decision: byDecision, by_agent: byAgent },
    });
  });
  router.get('/spend/status', (req, res) => spendController.getStatus(req, res));
  router.get('/spend/scan', (req, res) => spendController.scanContract(req, res));
  router.post('/spend/:decisionId/confirm', (req, res) =>
    spendController.confirmDecision(req, res),
  );

  // Cleanverse CVI/CVA demo + status
  if (cleanverseCtrl) {
    router.get('/cleanverse/status', (req, res) => cleanverseCtrl.getStatus(req, res));
    router.get('/cleanverse/deposit-address', (req, res) =>
      cleanverseCtrl.getDepositAddress(req, res),
    );
    router.post('/cleanverse/screen', (req, res) => cleanverseCtrl.screen(req, res));
  }

  // ERC-8004 agent identity + reputation on Monad
  if (erc8004Ctrl) {
    router.get('/erc8004/status', (req, res) => erc8004Ctrl.getStatus(req, res));
    router.post('/erc8004/register', (req, res) => erc8004Ctrl.register(req, res));
    router.get('/erc8004/agents/:agentId', (req, res) =>
      erc8004Ctrl.getAgent(req, res),
    );
    router.post('/erc8004/agents/:agentId/feedback', (req, res) =>
      erc8004Ctrl.giveFeedback(req, res),
    );
    router.get('/erc8004/agents/:agentId/reputation', (req, res) =>
      erc8004Ctrl.getReputation(req, res),
    );
  }

  // Passkey vault — one passkey wraps the root, many agent keys derive from it
  if (passkeyVaultCtrl) {
    router.get('/passkey-vault/status', (req, res) =>
      passkeyVaultCtrl.getStatus(req, res),
    );
    router.post('/passkey-vault/enroll/begin', (req, res) =>
      passkeyVaultCtrl.enrollBegin(req, res),
    );
    router.post('/passkey-vault/enroll/commit', (req, res) =>
      passkeyVaultCtrl.enrollCommit(req, res),
    );
    router.post('/passkey-vault/unlock/begin', (req, res) =>
      passkeyVaultCtrl.unlockBegin(req, res),
    );
    router.post('/passkey-vault/unlock/commit', (req, res) =>
      passkeyVaultCtrl.unlockCommit(req, res),
    );
    router.post('/passkey-vault/lock', (req, res) =>
      passkeyVaultCtrl.lock(req, res),
    );
    router.get('/passkey-vault/agent-keys', (req, res) =>
      passkeyVaultCtrl.listAgentKeys(req, res),
    );
    router.post('/passkey-vault/agent-keys', (req, res) =>
      passkeyVaultCtrl.deriveAgentKey(req, res),
    );
  }

  // Envio — pull indexed chain events into signed CRE evidence
  if (envioCtrl) {
    router.get('/envio/status', (req, res) => envioCtrl.getStatus(req, res));
    router.get('/envio/events', (req, res) => envioCtrl.listEvents(req, res));
    router.post('/envio/sync', (req, res) => envioCtrl.sync(req, res));
  }

  // OWS status
  router.get('/ows/status', (req, res) => owsController.getStatus(req, res));

  // Wallet routes
  router.get('/ows/health', (req, res) => owsWalletController.getHealth(req, res));
  router.get('/ows/dashboard', (req, res) => owsWalletController.getDashboard(req, res));
  router.post('/ows/bootstrap', (req, res) => owsWalletController.bootstrap(req, res));
  router.get('/ows/wallets', (req, res) => owsWalletController.listWallets(req, res));
  router.get('/ows/wallets/:id', (req, res) => owsWalletController.getWallet(req, res));
  router.post('/ows/wallets/connect', (req, res) => owsWalletController.connectExternal(req, res));
  router.post('/ows/wallets/import', (req, res) => owsWalletController.importWallet(req, res));
  router.patch('/ows/wallets/:id', (req, res) => owsWalletController.updateWallet(req, res));

  // Agent routes
  router.get('/ows/agents', (req, res) => owsWalletController.listAgents(req, res));
  router.post('/ows/agents', (req, res) => owsWalletController.createAgent(req, res));

  // API Key routes
  router.get('/ows/api-keys', (req, res) => owsApiKeyController.listApiKeys(req, res));
  router.get('/ows/api-keys/:id', (req, res) => owsApiKeyController.getApiKey(req, res));
  router.post('/ows/api-keys', (req, res) => owsApiKeyController.createApiKey(req, res));
  router.delete('/ows/api-keys/:id', (req, res) => owsApiKeyController.deleteApiKey(req, res));

  // Permissions routes
  router.post('/ows/permissions', (req, res) =>
    owsPermissionsController.requestPermissions(req, res),
  );
  router.get('/ows/permissions/:walletId', (req, res) =>
    owsPermissionsController.getPermissions(req, res),
  );

  // Agent preferences
  router.get('/agents/:agentId/preferences', async (req, res) => {
    const prefs = await sharedAgentPreferenceService.getPreferences(req.params.agentId);
    res.json({ success: true, data: prefs });
  });
  router.delete('/agents/:agentId/preferences', async (req, res) => {
    await sharedAgentPreferenceService.resetPreferences(req.params.agentId);
    res.json({ success: true });
  });

  return router;
}
