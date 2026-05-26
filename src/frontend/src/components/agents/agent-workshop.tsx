'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sparkles, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { mutate } from 'swr';

const CHAINS = [
  { id: 'Ethereum', name: 'Ethereum' },
  { id: 'Arbitrum', name: 'Arbitrum' },
  { id: 'Base', name: 'Base' },
  { id: 'X Layer', name: 'X Layer' },
  { id: 'Mantle', name: 'Mantle' },
  { id: 'Fhenix', name: 'Fhenix' },
];

const BUDGETS = [
  { id: '$1,000', label: '$1,000/day' },
  { id: '$5,000', label: '$5,000/day' },
  { id: '$10,000', label: '$10,000/day' },
  { id: '$25,000', label: '$25,000/day' },
  { id: 'Unlimited', label: 'Unlimited' },
];

const USE_CASE_TEMPLATES = [
  {
    role: 'DeFi Trading Bot',
    name: 'TraderBot',
    chain: 'Ethereum',
    budget: '$5,000',
    desc: 'Swaps, limit orders, arbitrage',
  },
  {
    role: 'Yield Optimizer',
    name: 'YieldHunter',
    chain: 'Arbitrum',
    budget: '$10,000',
    desc: 'Deposit/withdraw into yield protocols',
  },
  {
    role: 'Portfolio Rebalancer',
    name: 'Rebalancer',
    chain: 'Ethereum',
    budget: '$25,000',
    desc: 'Cross-vault rebalancing',
  },
  {
    role: 'Payment Agent',
    name: 'PayBot',
    chain: 'Base',
    budget: '$1,000',
    desc: 'Recurring payments, vendor payouts',
  },
  {
    role: 'DAO Treasury Agent',
    name: 'TreasuryOps',
    chain: 'Ethereum',
    budget: '$10,000',
    desc: 'Proposal-linked disbursements',
  },
  {
    role: 'Bridge Agent',
    name: 'Bridger',
    chain: 'Ethereum',
    budget: '$5,000',
    desc: 'Cross-chain transfers',
  },
];

export function AgentWorkshop() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [chain, setChain] = useState('Ethereum');
  const [budget, setBudget] = useState('$5,000');
  const [creating, setCreating] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim() || !role.trim()) return;
    setCreating(true);
    setError(null);

    try {
      const res = await apiClient.registerAgent({
        name: name.trim(),
        role: role.trim(),
        chain,
        budget,
      });

      if (res.success && res.data) {
        setCreatedId(res.data.id);
        mutate('/api/agents');
      } else {
        setError('Failed to create agent');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setCreating(false);
    }
  }

  if (createdId) {
    return (
      <div className="max-w-xl mx-auto pt-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold">Agent Registered</h2>
        <p className="text-muted-foreground">
          <strong>{name}</strong> is ready to operate on {chain}. Give it an API key from Settings
          so it can authenticate.
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Button onClick={() => router.push(`/agents/${createdId}`)}>View Agent</Button>
          <Button variant="outline" onClick={() => router.push('/agents')}>
            All Agents
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/agents')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Register Agent</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure and register a new governed agent
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-3 pb-2">
            <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-950">
              <Sparkles className="h-5 w-5 text-sky-500" />
            </div>
            <div>
              <h2 className="font-semibold">Agent Configuration</h2>
              <p className="text-xs text-muted-foreground">
                Define your agent&apos;s identity and constraints
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <label className="text-sm font-medium">Start from a template</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {USE_CASE_TEMPLATES.map((t) => (
                <button
                  key={t.role}
                  type="button"
                  onClick={() => {
                    setName(t.name);
                    setRole(t.role);
                    setChain(t.chain);
                    setBudget(t.budget);
                  }}
                  className={`p-3 rounded-lg border text-left transition-colors hover:border-primary/50 ${
                    role === t.role ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="text-xs font-medium">{t.role}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">Or fill in manually below</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Agent Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. YieldHunter-02"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="role" className="text-sm font-medium">
              Role / Purpose
            </label>
            <Input
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. DeFi Yield Optimizer"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="chain" className="text-sm font-medium">
                Primary Chain
              </label>
              <Select value={chain} onValueChange={(v) => v && setChain(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select chain" />
                </SelectTrigger>
                <SelectContent>
                  {CHAINS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="budget" className="text-sm font-medium">
                Daily Budget
              </label>
              <Select value={budget} onValueChange={(v) => v && setBudget(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select budget" />
                </SelectTrigger>
                <SelectContent>
                  {BUDGETS.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleCreate}
            disabled={!name.trim() || !role.trim() || creating}
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Registering...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Register Agent
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-muted/20">
        <CardContent className="p-4">
          <div className="text-sm space-y-2">
            <div className="font-medium">What happens when you register:</div>
            <ol className="list-decimal list-inside text-muted-foreground space-y-1 text-xs">
              <li>The agent is registered in your workspace with the selected budget and chain</li>
              <li>It appears in your Agents dashboard with &ldquo;active&rdquo; status</li>
              <li>Create an API key in Settings and give it to your agent for authentication</li>
              <li>
                The agent calls Cognivern&apos;s API before every transaction for governance checks
              </li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
