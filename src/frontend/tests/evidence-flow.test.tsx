import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  EvidenceFlow,
  buildEvidenceMicroChain,
  gatePhaseFromFheSteps,
} from '@/components/primitives/evidence-flow';
import type { FheStep } from '@/hooks/use-fhe-progress';

function steps(statuses: Array<FheStep['status']>): FheStep[] {
  const labels = [
    'Loading confidential policy',
    'Encrypting spend parameters',
    'Submitting & confirming on Fhenix',
    'Recording audit trail',
  ];
  return labels.map((label, i) => ({ label, status: statuses[i] }));
}

describe('gatePhaseFromFheSteps', () => {
  it('stays idle with no active step', () => {
    const result = gatePhaseFromFheSteps(steps(['pending', 'pending', 'pending', 'pending']));
    expect(result.phase).toBe('idle');
    expect(result.subscript).toBeNull();
  });

  it('maps policy loading to the idle gate with an honest subscript', () => {
    const result = gatePhaseFromFheSteps(steps(['active', 'pending', 'pending', 'pending']));
    expect(result.phase).toBe('idle');
    expect(result.subscript).toBe('Loading confidential policy');
  });

  it('maps encryption to packet travel', () => {
    const result = gatePhaseFromFheSteps(steps(['done', 'active', 'pending', 'pending']));
    expect(result.phase).toBe('travel');
    expect(result.subscript).toBe('Encrypting spend parameters');
  });

  it('maps Fhenix submission and audit recording to gate evaluation', () => {
    const submit = gatePhaseFromFheSteps(steps(['done', 'done', 'active', 'pending']));
    expect(submit.phase).toBe('evaluate');
    const record = gatePhaseFromFheSteps(steps(['done', 'done', 'done', 'active']));
    // No branch outcome exists yet — never fake a decision.
    expect(record.phase).toBe('evaluate');
    expect(record.subscript).toBe('Recording audit trail');
  });
});

describe('buildEvidenceMicroChain', () => {
  it('produces the canonical 4 evidence stages in order', () => {
    const chain = buildEvidenceMicroChain({ policy: true, privacy: false, onchain: true, receipt: false });
    expect(chain.map((n) => n.key)).toEqual(['policy', 'privacy', 'onchain', 'receipt']);
    expect(chain.map((n) => n.proven)).toEqual([true, false, true, false]);
  });

  it('marks absent proof honestly in tooltips', () => {
    const chain = buildEvidenceMicroChain({ policy: true, privacy: false, onchain: false, receipt: false });
    expect(chain[1].tooltip).toMatch(/no encrypted evaluation/i);
  });
});

describe('EvidenceFlow micro-chain rendering', () => {
  it('renders an accessible summary of proven vs absent evidence', () => {
    render(
      <EvidenceFlow
        variant="micro-chain"
        stages={buildEvidenceMicroChain({ policy: true, privacy: true, onchain: false, receipt: true })}
      />,
    );
    const wire = screen.getByRole('img');
    expect(wire.getAttribute('aria-label')).toContain('Policy proven');
    expect(wire.getAttribute('aria-label')).toContain('On-chain absent');
    expect(wire.getAttribute('aria-label')).toContain('Receipt proven');
  });
});

describe('EvidenceFlow gate rendering', () => {
  it('renders the governed schematic with a policy gate', () => {
    const { container } = render(
      <EvidenceFlow variant="gate" governed fhe phase="evaluate" outcome={null} />,
    );
    expect(screen.getByRole('img', { name: /policy gate/i })).toBeTruthy();
    // The encrypted-lock ring only shows while the prover is running.
    expect(container.textContent).toContain('encrypted evaluation');
  });

  it('renders the ungoverned bypass to no audit record', () => {
    const { container } = render(
      <EvidenceFlow variant="gate" governed={false} phase="travel" outcome={null} />,
    );
    expect(screen.getByRole('img', { name: /no audit record/i })).toBeTruthy();
    expect(container.textContent).toContain('No audit record');
  });

  it('illuminates only the decided branch', () => {
    const { container } = render(
      <EvidenceFlow variant="gate" governed phase="decided" outcome="held" />,
    );
    expect(container.textContent).toContain('Operator inbox');
    expect(container.textContent).toContain('Stopped');
    expect(container.textContent).toContain('Receipt');
  });

  it('carries the subscript for steps without a visual analog', () => {
    const { container } = render(
      <EvidenceFlow variant="gate" governed fhe phase="evaluate" outcome={null} subscript="Recording audit trail" />,
    );
    expect(container.textContent).toContain('Recording audit trail');
  });
});

describe('EvidenceFlow loop rendering', () => {
  it('renders stages as clickable pressed states and reports selection', () => {
    const selections: string[] = [];
    render(
      <EvidenceFlow
        variant="loop"
        activeStage="act"
        onStageSelect={(key) => selections.push(key)}
        stages={[
          { key: 'fund', label: 'Fund', status: 'live' },
          { key: 'act', label: 'Act', status: 'live' },
          { key: 'spend', label: 'Spend', status: 'building' },
          { key: 'outcome', label: 'Outcome', status: 'building' },
          { key: 'allocate', label: 'Allocate', status: 'building' },
        ]}
      />,
    );
    const actButton = screen.getByRole('button', { name: /act/i });
    expect(actButton.getAttribute('aria-pressed')).toBe('true');
    const fundButton = screen.getByRole('button', { name: /fund/i });
    expect(fundButton.getAttribute('aria-pressed')).toBe('false');
    fundButton.click();
    expect(selections).toEqual(['fund']);
  });
});
