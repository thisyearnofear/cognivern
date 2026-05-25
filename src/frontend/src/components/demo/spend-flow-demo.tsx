'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  ShieldCheck,
  FileSearch,
  CheckCircle2,
  XCircle,
  PlayCircle,
  RotateCcw,
  Clock,
  Activity,
} from 'lucide-react';

interface StepState {
  id: string;
  label: string;
  icon: typeof ShieldCheck;
  status: 'pending' | 'active' | 'passed' | 'failed';
  detail: string;
}

const INITIAL_STEPS: StepState[] = [
  {
    id: 'policy',
    label: 'Policy Created',
    icon: ShieldCheck,
    status: 'pending',
    detail: 'Daily limit: 500 MNT, Compliance check enabled',
  },
  {
    id: 'request',
    label: 'Agent Requests Spend',
    icon: Activity,
    status: 'pending',
    detail: 'YieldHunter-01 requests 200 MNT for LP staking',
  },
  {
    id: 'evaluate',
    label: 'Policy Evaluated',
    icon: FileSearch,
    status: 'pending',
    detail: 'Checking 3 active policies...',
  },
  { id: 'decision', label: 'Decision', icon: CheckCircle2, status: 'pending', detail: '' },
  {
    id: 'audit',
    label: 'Audit Logged',
    icon: Clock,
    status: 'pending',
    detail: 'Immutable record stored on 0G + Filecoin',
  },
];

export function SpendFlowDemo() {
  const [steps, setSteps] = useState<StepState[]>(INITIAL_STEPS);
  const [currentStep, setCurrentStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [approved, setApproved] = useState(true);

  const advanceStep = useCallback(() => {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i === currentStep) {
          if (i === 3) {
            const isApproved = Math.random() > 0.3;
            setApproved(isApproved);
            return {
              ...s,
              status: isApproved ? ('passed' as const) : ('failed' as const),
              detail: isApproved
                ? 'Approved \u2014 all checks passed'
                : 'Denied \u2014 exceeds daily limit',
            };
          }
          return { ...s, status: 'passed' as const };
        }
        return s;
      }),
    );

    if (currentStep < steps.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      setSteps((prev) =>
        prev.map((s, i) => {
          if (i === next) return { ...s, status: 'active' as const };
          return s;
        }),
      );
    } else {
      setCompleted(true);
      setRunning(false);
    }
  }, [currentStep, steps.length]);

  useEffect(() => {
    if (!running || completed) return;
    const timer = setTimeout(advanceStep, 1200);
    return () => clearTimeout(timer);
  }, [running, currentStep, completed, advanceStep]);

  function handleStart() {
    setSteps(INITIAL_STEPS.map((s, i) => (i === 0 ? { ...s, status: 'active' as const } : s)));
    setCurrentStep(0);
    setCompleted(false);
    setApproved(true);
    setRunning(true);
  }

  function handleReset() {
    setSteps(INITIAL_STEPS);
    setCurrentStep(0);
    setCompleted(false);
    setRunning(false);
    setApproved(true);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Spend Flow Demo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Watch how Cognivern evaluates every agent spend in real-time
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!running ? (
            <Button onClick={handleStart} disabled={completed}>
              {completed ? (
                <>
                  <RotateCcw className="h-4 w-4" /> Replay
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" /> Start Demo
                </>
              )}
            </Button>
          ) : (
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
          )}
        </div>
      </div>

      {/* Flow visualization */}
      <div className="space-y-0">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div key={step.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${
                    step.status === 'active'
                      ? 'bg-primary text-primary-foreground scale-110 shadow-lg ring-2 ring-primary/30'
                      : step.status === 'passed'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-500'
                        : step.status === 'failed'
                          ? 'bg-red-100 dark:bg-red-950 text-red-500'
                          : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step.status === 'passed' || (step.status === 'failed' && idx === 3) ? (
                    step.status === 'failed' ? (
                      <XCircle className="h-5 w-5" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`w-0.5 h-8 my-1 transition-colors duration-500 ${
                      step.status === 'passed'
                        ? 'bg-emerald-300'
                        : step.status === 'active'
                          ? 'bg-primary/30'
                          : 'bg-border'
                    }`}
                  />
                )}
              </div>
              <div
                className={`flex-1 pb-6 transition-all duration-500 ${
                  step.status === 'active'
                    ? 'opacity-100'
                    : step.status === 'pending'
                      ? 'opacity-50'
                      : 'opacity-100'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`font-semibold text-sm ${
                      step.status === 'active' ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.status === 'active' && (
                    <span className="flex items-center gap-1 text-xs text-primary">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      In progress
                    </span>
                  )}
                  {step.status === 'passed' && idx === 3 && (
                    <Badge variant="secondary" className="text-xs">
                      Approved
                    </Badge>
                  )}
                  {step.status === 'failed' && idx === 3 && (
                    <Badge variant="destructive" className="text-xs">
                      Denied
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{step.detail}</p>
                {step.status === 'passed' && idx === 3 && approved && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">
                      200 MNT within daily budget
                    </span>
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 ml-2" />
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Compliance passed
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {completed && (
        <Card
          className={`border-2 ${
            approved
              ? 'border-emerald-200 dark:border-emerald-900'
              : 'border-red-200 dark:border-red-900'
          }`}
        >
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              {approved ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              ) : (
                <XCircle className="h-6 w-6 text-red-500" />
              )}
              <div>
                <div className="font-bold text-lg">Spend {approved ? 'Approved' : 'Denied'}</div>
                <div className="text-sm text-muted-foreground">
                  {approved
                    ? 'YieldHunter-01 can proceed with the transaction. Audit trail stored on-chain.'
                    : "Arbitrage-07's request blocked. Policy violation logged to audit."}
                </div>
              </div>
            </div>
            <Separator className="my-3" />
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                <strong>Duration:</strong> {(steps.length * 1.2).toFixed(1)}s
              </span>
              <span>
                <strong>Policies checked:</strong> 3
              </span>
              <span>
                <strong>Audit:</strong> Immutable
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card className="bg-muted/20">
        <CardContent className="p-4">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Behind the scenes:</span> Every spend goes
            through this flow in under 100ms. Policy checks use FHE (Fully Homomorphic Encryption)
            on Fhenix, audit evidence is stored on 0G for fast retrieval and Filecoin for permanent
            archive, and cross-chain communication is handled by Hyperlane.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
