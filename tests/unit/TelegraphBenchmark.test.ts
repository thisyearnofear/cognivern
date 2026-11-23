import { describe, expect, it } from 'vitest';
import {
  buildBenchmarkReport,
  evaluateMatch,
  summarizeProvider,
  toMarkdown,
  type BenchmarkCase,
  type ProviderResult,
} from '../../tooling/scripts/agents/telegraph-benchmark.js';

const cases: BenchmarkCase[] = [
  {
    id: 'known-hit',
    category: 'sanctions-screen',
    classification: 'positive',
    positiveClass: 'hit',
    expect: { path: 'data.compliance.verdict', equals: 'hit' },
  },
  {
    id: 'negative-control',
    category: 'sanctions-screen',
    classification: 'negative',
    positiveClass: 'hit',
    expect: { path: 'data.compliance.verdict', equals: 'clear' },
  },
];

describe('telegraph benchmark scoring', () => {
  it('matches nested values with case-insensitive string equality', () => {
    const response = { data: { compliance: { verdict: 'HIT' } } };
    expect(evaluateMatch(response, { path: 'data.compliance.verdict', equals: 'hit' }).passed).toBe(
      true,
    );
  });

  it('supports oneOf, contains, and non-empty expectations', () => {
    const response = {
      data: {
        status: 'held',
        answer: 'Base gas is 0.42 gwei',
        policyViolations: ['subject denylisted'],
      },
    };
    expect(evaluateMatch(response, { path: 'data.status', oneOf: ['denied', 'held'] }).passed).toBe(
      true,
    );
    expect(evaluateMatch(response, { path: 'data.answer', contains: '0.42 gwei' }).passed).toBe(
      true,
    );
    expect(evaluateMatch(response, { path: 'data.policyViolations', nonEmpty: true }).passed).toBe(
      true,
    );
  });

  it('summarizes hit precision/recall, spend, latency, and review/unknown rates', () => {
    const results: ProviderResult[] = [
      {
        provider: 'telegraph',
        caseId: 'known-hit',
        passed: false,
        observed: 'clear',
        expectations: [],
        runIds: ['gate-1'],
        latencyMs: 100,
        costUsd: 0.01,
      },
      {
        provider: 'telegraph',
        caseId: 'negative-control',
        passed: true,
        observed: 'clear',
        expectations: [],
        runIds: ['parent-1'],
        latencyMs: 300,
        costUsd: 0.02,
      },
    ];

    const summary = summarizeProvider('telegraph', results, new Map(cases.map((c) => [c.id, c])));
    expect(summary.executed).toBe(2);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.totalCostUsd).toBeCloseTo(0.03, 6);
    expect(summary.avgLatencyMs).toBe(200);
    expect(summary.hitPrecision).toBeNull();
    expect(summary.hitRecall).toBe(0);
    expect(summary.falseNegatives).toBe(1);
    expect(summary.falsePositives).toBe(0);
    expect(summary.errorRate).toBe(0);
  });

  it('emits a self-describing report without claiming evaluator miners were used', () => {
    const suite = { schema: 'test-suite', description: 'fixture', cases };
    const results: ProviderResult[] = [
      {
        provider: 'telegraph',
        caseId: 'known-hit',
        passed: true,
        observed: 'hit',
        expectations: [],
        runIds: ['gate-1'],
      },
    ];
    const report = buildBenchmarkReport({
      suite,
      casesPath: 'cases.json',
      api: 'https://api.example.test',
      dryRun: false,
      results,
    });
    const markdown = toMarkdown(report);

    expect(report.schema).toBe('cognivern.telegraph.benchmark-report.v1');
    expect(report.execution.independentGroundTruth).toBe(true);
    expect(report.execution.evaluatorMinersUsed).toBe(false);
    expect(report.summaries[0].passed).toBe(1);
    expect(markdown).toContain('known-hit');
    expect(markdown).toContain('Provider summary');
  });
});
