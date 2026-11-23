/**
 * telegraph-benchmark — fixed-case, ground-truth benchmark runner.
 *
 * Unlike verify-sample (which asks evaluator miners whether prior model calls
 * were right), this harness starts from independent fixture assertions and
 * scores what each provider actually returned. It can run Telegraph calls,
 * optional OpenAI-compatible frontier baselines, or a zero-cost dry run.
 *
 * Usage:
 *   pnpm exec tsx tooling/scripts/agents/telegraph-benchmark.ts --dry-run
 *   COGNIVERN_TOKEN=<workspace JWT> \
 *     pnpm exec tsx tooling/scripts/agents/telegraph-benchmark.ts \
 *       --out /tmp/telegraph-benchmark.json --markdown /tmp/telegraph-benchmark.md
 *
 * Env:
 *   COGNIVERN_API             default https://api.cognivern.persidian.com
 *   COGNIVERN_TOKEN           workspace JWT for Telegraph calls
 *   COGNIVERN_API_KEY         workspace x-api-key alternative
 *   BENCHMARK_BASE_URL        OpenAI-compatible baseline base URL
 *   BENCHMARK_API_KEY         baseline API key
 *   BENCHMARK_MODEL           baseline model id (or --baseline-model)
 *   BASELINE_INPUT_USD_PER_MTOK / BASELINE_OUTPUT_USD_PER_MTOK
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sha256CanonicalJson } from '../../../src/backend/services/telegraph/stableJson.js';

const API = (process.env.COGNIVERN_API ?? 'https://api.cognivern.persidian.com').replace(/\/$/, '');
const DEFAULT_CASES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'telegraph-benchmark-cases.json',
);

type TelegraphEndpoint = 'call' | 'compliant-call';

type JsonObject = Record<string, unknown>;

export interface MatchSpec {
  path: string;
  equals?: unknown;
  oneOf?: unknown[];
  contains?: string;
  regex?: string;
  nonEmpty?: boolean;
}

export interface BenchmarkCase {
  id: string;
  category?: string;
  description?: string;
  classification?: 'positive' | 'negative';
  positiveClass?: string;
  telegraph?: {
    endpoint: TelegraphEndpoint;
    body: JsonObject;
  };
  baselinePrompt?: string;
  baselineExpect?: MatchSpec;
  expect: MatchSpec;
  also?: MatchSpec[];
  groundTruth?: {
    source?: string;
    assertion?: string;
    checkedAt?: string;
  };
}

export interface BenchmarkSuite {
  schema?: string;
  description?: string;
  cases: BenchmarkCase[];
}

export interface MatchResult {
  spec: MatchSpec;
  actual: unknown;
  passed: boolean;
  reason?: string;
}

export interface ProviderResult {
  provider: 'telegraph' | 'baseline';
  caseId: string;
  passed: boolean | null;
  skipped?: string;
  error?: string;
  observed?: unknown;
  expectations: MatchResult[];
  runIds: string[];
  evidenceHash?: string;
  status?: string;
  runStatus?: string;
  blocked?: boolean;
  latencyMs?: number;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  responseHash?: string;
}

export interface ProviderSummary {
  provider: string;
  planned: number;
  executed: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  totalCostUsd: number;
  paidCalls: number;
  avgLatencyMs: number | null;
  hitPrecision: number | null;
  hitRecall: number | null;
  falsePositives: number;
  falseNegatives: number;
  reviewRate: number | null;
  unknownRate: number | null;
  errorRate: number | null;
}

interface CliOptions {
  casesPath: string;
  out?: string;
  markdown?: string;
  limit?: number;
  only?: Set<string>;
  delayMs: number;
  baseline: boolean;
  baselineModel?: string;
  dryRun: boolean;
  help: boolean;
}

function getPath(value: unknown, dottedPath: string): unknown {
  let current = value;
  for (const part of dottedPath.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as JsonObject)[part];
  }
  return current;
}

function comparable(value: unknown): unknown {
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (['number', 'boolean', 'bigint'].includes(typeof value)) return String(value);
  return value;
}

function describe(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function evaluateMatch(response: unknown, spec: MatchSpec): MatchResult {
  const actual = getPath(response, spec.path);
  if (spec.nonEmpty === true) {
    const nonEmpty = Array.isArray(actual)
      ? actual.length > 0
      : typeof actual === 'string'
        ? actual.trim().length > 0
        : actual !== null && actual !== undefined;
    return {
      spec,
      actual,
      passed: nonEmpty,
      reason: nonEmpty ? undefined : `expected ${spec.path} to be non-empty`,
    };
  }
  if (spec.equals !== undefined) {
    const passed = comparable(actual) === comparable(spec.equals);
    return {
      spec,
      actual,
      passed,
      reason: passed ? undefined : `expected ${describe(spec.equals)}`,
    };
  }
  if (spec.oneOf) {
    const allowed = new Set(spec.oneOf.map(comparable));
    const passed = allowed.has(comparable(actual));
    return {
      spec,
      actual,
      passed,
      reason: passed ? undefined : `expected one of ${spec.oneOf.map(describe).join(', ')}`,
    };
  }
  if (spec.contains !== undefined) {
    const text = typeof actual === 'string' ? actual : JSON.stringify(actual ?? '');
    const passed = text.toLowerCase().includes(spec.contains.toLowerCase());
    return {
      spec,
      actual,
      passed,
      reason: passed ? undefined : `expected response to contain ${spec.contains}`,
    };
  }
  if (spec.regex !== undefined) {
    const text = typeof actual === 'string' ? actual : JSON.stringify(actual ?? '');
    const passed = new RegExp(spec.regex, 'i').test(text);
    return {
      spec,
      actual,
      passed,
      reason: passed ? undefined : `expected response to match /${spec.regex}/i`,
    };
  }
  return { spec, actual, passed: false, reason: 'expectation has no matcher' };
}

function expectationResults(response: unknown, benchmarkCase: BenchmarkCase, baseline = false) {
  const specs = [
    baseline && benchmarkCase.baselineExpect ? benchmarkCase.baselineExpect : benchmarkCase.expect,
    ...(benchmarkCase.also ?? []),
  ];
  return specs.map((spec) => evaluateMatch(response, spec));
}

function collectRunIds(value: unknown, output = new Set<string>()): Set<string> {
  if (value === null || typeof value !== 'object') return output;
  if (Array.isArray(value)) {
    for (const item of value) collectRunIds(item, output);
    return output;
  }
  for (const [key, child] of Object.entries(value as JsonObject)) {
    if (/runId$/i.test(key) && typeof child === 'string' && child.length > 0) output.add(child);
    collectRunIds(child, output);
  }
  return output;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractCostUsd(response: unknown): number | undefined {
  const data = getPath(response, 'data');
  return (
    numberOrUndefined(getPath(data, 'evidenceBundle.costs.totalUsd')) ??
    numberOrUndefined(getPath(data, 'response.metadata.costUsd')) ??
    numberOrUndefined(getPath(data, 'cost.usd')) ??
    numberOrUndefined(getPath(data, 'costs.totalUsd'))
  );
}

function authHeaders(): Record<string, string> {
  const token = process.env.COGNIVERN_TOKEN;
  const apiKey = process.env.COGNIVERN_API_KEY;
  return {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : apiKey ? { 'x-api-key': apiKey } : {}),
  };
}

async function apiRequest(endpoint: TelegraphEndpoint, body: JsonObject): Promise<unknown> {
  const res = await fetch(`${API}/api/telegraph/${endpoint}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    // Preserve non-JSON error bodies in the thrown error.
  }
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status}: ${typeof json === 'string' ? json : JSON.stringify(json)}`,
    );
  }
  return json;
}

async function runTelegraphCase(benchmarkCase: BenchmarkCase): Promise<ProviderResult> {
  if (!benchmarkCase.telegraph) {
    return {
      provider: 'telegraph',
      caseId: benchmarkCase.id,
      passed: null,
      skipped: 'no telegraph request defined',
      expectations: [],
      runIds: [],
    };
  }
  const started = Date.now();
  try {
    const response = await apiRequest(
      benchmarkCase.telegraph.endpoint,
      benchmarkCase.telegraph.body,
    );
    const expectations = expectationResults(response, benchmarkCase);
    const data = getPath(response, 'data') as JsonObject | undefined;
    return {
      provider: 'telegraph',
      caseId: benchmarkCase.id,
      passed: expectations.every((result) => result.passed),
      observed: expectations[0]?.actual,
      expectations,
      runIds: [...collectRunIds(response)],
      evidenceHash: firstString(getPath(data, 'evidenceBundle.evidenceHash')),
      status: firstString(data?.status),
      runStatus: firstString(data?.runStatus),
      blocked: data?.blocked === true,
      latencyMs: Date.now() - started,
      costUsd: extractCostUsd(response),
      responseHash: sha256CanonicalJson(response),
    };
  } catch (error) {
    return {
      provider: 'telegraph',
      caseId: benchmarkCase.id,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      expectations: [],
      runIds: [],
      latencyMs: Date.now() - started,
    };
  }
}

function baselineConfig(modelOverride?: string) {
  const baseUrl = (
    process.env.BENCHMARK_BASE_URL ??
    process.env.OPENAI_COMPAT_BASE_URL ??
    ''
  ).replace(/\/$/, '');
  const apiKey = process.env.BENCHMARK_API_KEY ?? process.env.OPENAI_COMPAT_API_KEY ?? '';
  const model = modelOverride ?? process.env.BENCHMARK_MODEL ?? '';
  return { baseUrl, apiKey, model };
}

function baselineCostUsd(
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined,
) {
  if (!usage) return undefined;
  const inputPrice = numberOrUndefined(process.env.BASELINE_INPUT_USD_PER_MTOK);
  const outputPrice = numberOrUndefined(process.env.BASELINE_OUTPUT_USD_PER_MTOK);
  if (inputPrice === undefined && outputPrice === undefined) return undefined;
  const input = ((usage.prompt_tokens ?? 0) * (inputPrice ?? 0)) / 1_000_000;
  const output = ((usage.completion_tokens ?? 0) * (outputPrice ?? 0)) / 1_000_000;
  return input + output;
}

async function runBaselineCase(
  benchmarkCase: BenchmarkCase,
  modelOverride?: string,
): Promise<ProviderResult> {
  if (!benchmarkCase.baselinePrompt || !benchmarkCase.baselineExpect) {
    return {
      provider: 'baseline',
      caseId: benchmarkCase.id,
      passed: null,
      skipped: 'no baseline prompt/expectation defined',
      expectations: [],
      runIds: [],
    };
  }
  const config = baselineConfig(modelOverride);
  if (!config.baseUrl || !config.apiKey || !config.model) {
    return {
      provider: 'baseline',
      caseId: benchmarkCase.id,
      passed: null,
      skipped: 'missing BENCHMARK_BASE_URL, BENCHMARK_API_KEY, or BENCHMARK_MODEL',
      expectations: [],
      runIds: [],
      model: config.model || undefined,
    };
  }

  const started = Date.now();
  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        messages: [{ role: 'user', content: benchmarkCase.baselinePrompt }],
      }),
    });
    const json = (await res.json()) as JsonObject;
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
    const choices = Array.isArray(json.choices) ? json.choices : [];
    const firstChoice = choices[0] as JsonObject | undefined;
    const message = firstChoice?.message as JsonObject | undefined;
    const answer = typeof message?.content === 'string' ? message.content.trim() : '';
    const usage = json.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
    const shaped = {
      data: {
        answer,
        model: config.model,
        usage,
      },
    };
    const expectations = expectationResults(shaped, benchmarkCase, true);
    return {
      provider: 'baseline',
      caseId: benchmarkCase.id,
      passed: expectations.every((result) => result.passed),
      observed: expectations[0]?.actual,
      expectations,
      runIds: [],
      latencyMs: Date.now() - started,
      costUsd: baselineCostUsd(usage),
      inputTokens: usage?.prompt_tokens,
      outputTokens: usage?.completion_tokens,
      model: config.model,
      responseHash: sha256CanonicalJson(json),
    };
  } catch (error) {
    return {
      provider: 'baseline',
      caseId: benchmarkCase.id,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      expectations: [],
      runIds: [],
      latencyMs: Date.now() - started,
      model: config.model || undefined,
    };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function summarizeProvider(
  provider: string,
  results: ProviderResult[],
  casesById: Map<string, BenchmarkCase>,
): ProviderSummary {
  const executed = results.filter((result) => result.passed !== null || result.error);
  const passed = executed.filter((result) => result.passed === true).length;
  const failed = executed.filter((result) => result.passed === false && !result.error).length;
  const errors = executed.filter((result) => result.error).length;
  const costs = results
    .map((result) => result.costUsd)
    .filter((v): v is number => typeof v === 'number');
  const latencies = results
    .map((result) => result.latencyMs)
    .filter((v): v is number => typeof v === 'number');

  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let reviewCount = 0;
  let unknownCount = 0;
  let classified = 0;

  for (const result of results) {
    const benchmarkCase = casesById.get(result.caseId);
    if (!benchmarkCase?.classification || result.passed === null || result.skipped) continue;
    classified += 1;
    const positiveClass = benchmarkCase.positiveClass ?? 'hit';
    const actual = typeof result.observed === 'string' ? result.observed.trim().toLowerCase() : '';
    if (actual === 'review') reviewCount += 1;
    if (actual === 'unknown') unknownCount += 1;
    if (benchmarkCase.classification === 'positive') {
      if (actual === positiveClass) truePositives += 1;
      else falseNegatives += 1;
    } else if (actual === positiveClass) {
      falsePositives += 1;
    }
  }

  return {
    provider,
    planned: results.length,
    executed: executed.length,
    passed,
    failed,
    skipped: results.filter((result) => result.skipped).length,
    errors,
    totalCostUsd: costs.reduce((sum, value) => sum + value, 0),
    paidCalls: costs.filter((value) => value > 0).length,
    avgLatencyMs:
      latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null,
    hitPrecision:
      truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : null,
    hitRecall:
      truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : null,
    falsePositives,
    falseNegatives,
    reviewRate: classified > 0 ? reviewCount / classified : null,
    unknownRate: classified > 0 ? unknownCount / classified : null,
    errorRate: results.length > 0 ? errors / results.length : null,
  };
}

export function buildBenchmarkReport(input: {
  suite: BenchmarkSuite;
  casesPath: string;
  api: string;
  baselineModel?: string;
  dryRun: boolean;
  results: ProviderResult[];
}) {
  const casesById = new Map(input.suite.cases.map((item) => [item.id, item]));
  const providers = [...new Set(input.results.map((result) => result.provider))];
  return {
    schema: 'cognivern.telegraph.benchmark-report.v1',
    generatedAt: new Date().toISOString(),
    suite: {
      path: input.casesPath,
      schema: input.suite.schema ?? null,
      description: input.suite.description ?? null,
      caseCount: input.suite.cases.length,
    },
    execution: {
      api: input.api,
      baselineModel: input.baselineModel ?? null,
      dryRun: input.dryRun,
      independentGroundTruth: true,
      evaluatorMinersUsed: false,
    },
    summaries: providers.map((provider) => summarizeProvider(provider, input.results, casesById)),
    cases: input.suite.cases.map((item) => ({
      id: item.id,
      category: item.category ?? null,
      description: item.description ?? null,
      classification: item.classification ?? null,
      positiveClass: item.positiveClass ?? null,
      groundTruth: item.groundTruth ?? null,
    })),
    results: input.results,
  };
}

function pct(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
}

function money(value: number): string {
  return `$${value.toFixed(4)}`;
}

export function toMarkdown(report: ReturnType<typeof buildBenchmarkReport>): string {
  const lines = [
    '# Telegraph benchmark report',
    '',
    `Generated: ${report.generatedAt}`,
    `Suite: ${report.suite.path} (${report.suite.caseCount} cases)`,
    `API: ${report.execution.api}`,
    `Dry run: ${report.execution.dryRun}`,
    `Baseline model: ${report.execution.baselineModel ?? 'not run'}`,
    '',
    '## Provider summary',
    '',
    '| Provider | Planned | Executed | Passed | Failed | Errors | Spend | Paid calls | Avg latency | Hit precision | Hit recall | FP | FN | Review | Unknown |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...report.summaries.map(
      (s) =>
        `| ${s.provider} | ${s.planned} | ${s.executed} | ${s.passed} | ${s.failed} | ${s.errors} | ${money(s.totalCostUsd)} | ${s.paidCalls} | ${s.avgLatencyMs === null ? '—' : `${Math.round(s.avgLatencyMs)}ms`} | ${pct(s.hitPrecision)} | ${pct(s.hitRecall)} | ${s.falsePositives} | ${s.falseNegatives} | ${pct(s.reviewRate)} | ${pct(s.unknownRate)} |`,
    ),
    '',
    '## Case results',
    '',
    '| Case | Provider | Result | Observed | Status | Cost | Latency | Run ids | Error |',
    '| --- | --- | --- | --- | --- | ---: | ---: | --- | --- |',
    ...report.results.map(
      (r) =>
        `| ${r.caseId} | ${r.provider} | ${r.skipped ? `skipped (${r.skipped})` : r.passed === true ? 'pass' : r.passed === false ? 'fail' : 'planned'} | ${describe(r.observed) ?? '—'} | ${r.status ?? r.runStatus ?? '—'} | ${typeof r.costUsd === 'number' ? money(r.costUsd) : '—'} | ${typeof r.latencyMs === 'number' ? `${r.latencyMs}ms` : '—'} | ${r.runIds.join(', ') || '—'} | ${r.error ?? '—'} |`,
    ),
    '',
    '## Ground truth',
    '',
    ...report.cases.map(
      (item) =>
        `- **${item.id}** — ${item.groundTruth?.assertion ?? item.description ?? 'no assertion'} (${item.groundTruth?.source ?? 'fixture'}, checked ${item.groundTruth?.checkedAt ?? 'unspecified'})`,
    ),
    '',
    'Raw provider responses are represented by SHA-256 response hashes; run ids and evidence hashes link paid Telegraph calls back to CRE artifacts.',
  ];
  return `${lines.join('\n')}\n`;
}

async function loadSuite(casesPath: string): Promise<BenchmarkSuite> {
  const parsed = JSON.parse(await readFile(casesPath, 'utf8')) as BenchmarkSuite;
  if (!Array.isArray(parsed.cases) || parsed.cases.length === 0) {
    throw new Error(`${casesPath} must contain a non-empty cases array`);
  }
  const seen = new Set<string>();
  for (const item of parsed.cases) {
    if (!item.id || seen.has(item.id)) throw new Error(`duplicate or missing case id: ${item.id}`);
    seen.add(item.id);
    if (!item.expect?.path) throw new Error(`${item.id} is missing expect.path`);
    if (item.telegraph && !['call', 'compliant-call'].includes(item.telegraph.endpoint)) {
      throw new Error(`${item.id} has invalid Telegraph endpoint ${item.telegraph.endpoint}`);
    }
  }
  return parsed;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    casesPath: DEFAULT_CASES,
    delayMs: 0,
    baseline: false,
    dryRun: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--cases') options.casesPath = argv[++i];
    else if (arg === '--out') options.out = argv[++i];
    else if (arg === '--markdown') options.markdown = argv[++i];
    else if (arg === '--limit') options.limit = Number(argv[++i]);
    else if (arg === '--only') options.only = new Set((argv[++i] ?? '').split(',').filter(Boolean));
    else if (arg === '--delay-ms') options.delayMs = Number(argv[++i]);
    else if (arg === '--baseline') options.baseline = true;
    else if (arg === '--baseline-model') options.baselineModel = argv[++i];
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`unknown argument ${arg}`);
  }
  return options;
}

function usage() {
  console.log(`Usage: telegraph-benchmark.ts [options]

Options:
  --cases <path>          Case fixture (default: telegraph-benchmark-cases.json)
  --out <path>            Write JSON report
  --markdown <path>       Write Markdown report
  --limit <n>             Run at most n cases
  --only <a,b>            Run selected case ids
  --delay-ms <n>          Sleep between provider calls
  --baseline              Also run OpenAI-compatible frontier baseline cases
  --baseline-model <id>   Override BENCHMARK_MODEL
  --dry-run               Validate fixture and emit planned report without paid calls
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  const suite = await loadSuite(options.casesPath);
  let cases = suite.cases;
  if (options.only) cases = cases.filter((item) => options.only!.has(item.id));
  if (options.limit !== undefined) cases = cases.slice(0, Math.max(0, options.limit));

  if (
    !options.dryRun &&
    cases.some((item) => item.telegraph) &&
    !process.env.COGNIVERN_TOKEN &&
    !process.env.COGNIVERN_API_KEY
  ) {
    throw new Error('Set COGNIVERN_TOKEN or COGNIVERN_API_KEY, or use --dry-run');
  }

  const results: ProviderResult[] = [];
  for (const benchmarkCase of cases) {
    if (options.dryRun) {
      if (benchmarkCase.telegraph) {
        results.push({
          provider: 'telegraph',
          caseId: benchmarkCase.id,
          passed: null,
          skipped: 'dry-run',
          expectations: [],
          runIds: [],
        });
      }
      if (options.baseline && benchmarkCase.baselinePrompt) {
        results.push({
          provider: 'baseline',
          caseId: benchmarkCase.id,
          passed: null,
          skipped: 'dry-run',
          expectations: [],
          runIds: [],
        });
      }
      continue;
    }

    if (benchmarkCase.telegraph) {
      results.push(await runTelegraphCase(benchmarkCase));
      if (options.delayMs > 0) await sleep(options.delayMs);
    }
    if (options.baseline) {
      results.push(await runBaselineCase(benchmarkCase, options.baselineModel));
      if (options.delayMs > 0) await sleep(options.delayMs);
    }
  }

  const report = buildBenchmarkReport({
    suite,
    casesPath: options.casesPath,
    api: API,
    baselineModel: baselineConfig(options.baselineModel).model || undefined,
    dryRun: options.dryRun,
    results,
  });
  const markdown = toMarkdown(report);

  if (options.out) {
    await mkdir(path.dirname(options.out), { recursive: true });
    await writeFile(options.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  if (options.markdown) {
    await mkdir(path.dirname(options.markdown), { recursive: true });
    await writeFile(options.markdown, markdown, 'utf8');
  }

  console.log(markdown);
  if (options.out) console.log(`Wrote JSON report: ${options.out}`);
  if (options.markdown) console.log(`Wrote Markdown report: ${options.markdown}`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
