import { creRunStore } from "../src/cre/storage/CreRunStore.js";
import { CreController } from "../src/modules/api/controllers/CreController.js";

type MockReq = {
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  body: any;
  headers: Record<string, string | undefined>;
  header: (name: string) => string | undefined;
  on: (event: string, handler: () => void) => void;
};

type MockRes = {
  statusCode: number;
  payload: any;
  status: (code: number) => MockRes;
  json: (body: any) => void;
  setHeader: (_k: string, _v: string) => void;
  flushHeaders: () => void;
  write: (_chunk: string) => void;
  end: () => void;
};

function makeReq(overrides: Partial<MockReq> = {}): MockReq {
  const headers = overrides.headers || {};
  return {
    params: overrides.params || {},
    query: overrides.query || {},
    body: overrides.body || {},
    headers,
    header: (name: string) => headers[name] || headers[name.toLowerCase()],
    on: (_event: string, _handler: () => void) => {},
  };
}

function makeRes(): MockRes {
  return {
    statusCode: 200,
    payload: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.payload = body;
    },
    setHeader() {},
    flushHeaders() {},
    write() {},
    end() {},
  };
}

async function main() {
  const runs = await creRunStore.list();
  if (!runs.length) {
    console.error("No runs found. Run `pnpm demo:seed` first.");
    process.exit(1);
  }

  const approvalRun =
    runs.find((run) => run.status === "paused_for_approval") || runs[0];
  const controller = new CreController();

  const planReq = makeReq({
    params: { runId: approvalRun.runId },
    body: {
      plan: {
        version: (approvalRun.plan?.version || 1) + 1,
        summary: "Demo scenario update",
        steps: (approvalRun.plan?.steps || []).map((step) => ({
          ...step,
          enabled: true,
          status: "pending",
        })),
      },
    },
  });
  const planRes = makeRes();
  await controller.updateRunPlan(planReq as any, planRes as any);

  const approveReq = makeReq({
    params: { runId: approvalRun.runId },
    body: { approve: true, reason: "Demo approval pass" },
  });
  const approveRes = makeRes();
  await controller.submitApproval(approveReq as any, approveRes as any);

  console.log("Demo scenario complete.");
  console.log(`Plan update status: ${planRes.statusCode}`);
  console.log(`Approval status: ${approveRes.statusCode}`);
}

main().catch((error) => {
  console.error("Demo scenario failed:", error);
  process.exit(1);
});
