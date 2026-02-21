import { Request, Response } from "express";
import { runForecastingWorkflow } from "../../../cre/workflows/forecasting.js";
import { creRunStore } from "../../../cre/storage/CreRunStore.js";

export class CreController {
  async listRuns(req: Request, res: Response) {
    const projectId = (req.query.projectId as string) || "default";
    const runs = await creRunStore.list();
    res.json({
      success: true,
      projectId,
      runs: runs.filter((r) => (r as any).projectId === projectId),
    });
  }

  async getRun(req: Request, res: Response) {
    const run = await creRunStore.get(req.params.runId);
    if (!run) {
      res.status(404).json({ success: false, error: "Run not found" });
      return;
    }
    res.json({ success: true, run });
  }

  async triggerForecast(req: Request, res: Response) {
    const writeAttestation = Boolean(req.body?.writeAttestation);

    const run = await runForecastingWorkflow({
      mode: "local",
      writeAttestation,
      arbitrumRpcUrl: process.env.ARBITRUM_RPC_URL,
    });

    await creRunStore.add(run);

    res.json({
      success: run.ok,
      runId: run.runId,
      run,
    });
  }
}
