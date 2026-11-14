/**
 * telegraph-demo — thin CLI over the live Cognivern API for judges and
 * reviewers who want to re-run the Telegraph S2 evidence themselves.
 *
 * No dependencies beyond Node 18+ fetch; run with tsx or plain node:
 *
 *   COGNIVERN_TOKEN=<workspace JWT> \
 *     pnpm exec tsx tooling/scripts/agents/telegraph-demo.ts ledger
 *
 * Commands:
 *   ledger                                   GET /api/telegraph/ledger
 *   call '<json>'                            POST /api/telegraph/call
 *   compliant-call '<json>'                  POST /api/telegraph/compliant-call
 *   miners [intent]                          GET /api/telegraph/miners?intent=
 *   intents                                  GET /api/telegraph/intents
 *   verify-sample <programId> [limit] [eval] [--agreement]
 *                                             POST .../verify-sample
 *                                             (--agreement: two evaluators,
 *                                             unanimous verdicts only)
 *   report <programId>                       GET .../report (leaderboard)
 *
 * Env:
 *   COGNIVERN_API    default https://api.cognivern.persidian.com
 *   COGNIVERN_TOKEN  workspace JWT (required for everything except miners/intents/status)
 *
 * Example compliant call (screen a name, then buy a gas price):
 *   telegraph-demo.ts compliant-call '{
 *     "minerId": "9002", "intent": "GAS_PRICE",
 *     "params": {"chain":"base","unit":"gwei"},
 *     "compliance": {"intent": "SANCTIONS_SCREENING_MATCH",
 *       "params": {"name": "Acme Robotics Ltd", "jurisdiction": "US"}}
 *   }'
 */

const API = (process.env.COGNIVERN_API ?? "https://api.cognivern.persidian.com").replace(/\/$/, "");
const TOKEN = process.env.COGNIVERN_TOKEN ?? "";

async function req(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep raw text */
  }
  if (!res.ok) {
    console.error(`HTTP ${res.status} ${method} ${path}`);
    console.log(typeof json === "string" ? json : JSON.stringify(json, null, 2));
    process.exit(1);
  }
  return json;
}

function out(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case "ledger":
    out(await req("GET", "/api/telegraph/ledger"));
    break;
  case "status":
    out(await req("GET", "/api/telegraph/status"));
    break;
  case "miners": {
    const intent = args[0] ? `?intent=${encodeURIComponent(args[0])}` : "";
    out(await req("GET", `/api/telegraph/miners${intent}`));
    break;
  }
  case "intents":
    out(await req("GET", "/api/telegraph/intents"));
    break;
  case "call":
  case "compliant-call": {
    if (!args[0]) {
      console.error(`usage: telegraph-demo.ts ${cmd} '<json body>'`);
      process.exit(2);
    }
    out(await req("POST", `/api/telegraph/${cmd}`, JSON.parse(args[0])));
    break;
  }
  case "verify-sample": {
    const agreement = args.includes("--agreement");
    const positional = args.filter((a) => a !== "--agreement");
    const [programId, limit, evaluatorMinerId] = positional;
    if (!programId) {
      console.error("usage: telegraph-demo.ts verify-sample <programId> [limit] [evaluatorMinerId] [--agreement]");
      process.exit(2);
    }
    out(
      await req("POST", `/api/credit-programs/${programId}/verify-sample`, {
        limit: limit ? Number(limit) : undefined,
        evaluatorMinerId: evaluatorMinerId || undefined,
        agreement: agreement || undefined,
      }),
    );
    break;
  }
  case "report": {
    const [programId] = args;
    if (!programId) {
      console.error("usage: telegraph-demo.ts report <programId>");
      process.exit(2);
    }
    out(await req("GET", `/api/credit-programs/${programId}/report`));
    break;
  }
  default:
    console.log("commands: ledger | status | miners [intent] | intents | call <json> | compliant-call <json> | verify-sample <programId> [limit] [eval] | report <programId>");
    process.exit(cmd ? 2 : 0);
}
