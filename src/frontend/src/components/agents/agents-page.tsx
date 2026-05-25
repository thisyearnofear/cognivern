'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { Users, PlusCircle } from 'lucide-react';
import { useAgents } from '@/hooks/use-api';

export function AgentsPage() {
  const router = useRouter();
  const { data: agents, isLoading, error } = useAgents();

  const agentList = agents || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and monitor governed agents</p>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <Badge variant="destructive" className="text-xs">
              Error
            </Badge>
          )}
          <Button onClick={() => router.push('/agents/workshop')}>
            <PlusCircle className="h-4 w-4" /> Add Agent
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <div className="p-12 text-center text-muted-foreground border rounded-xl">
          <p>Failed to load agents</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => router.refresh()}>
            Retry
          </Button>
        </div>
      ) : agentList.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground border rounded-xl">
          <Users className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No agents yet</p>
          <p className="text-sm mt-1">Create your first agent to get started</p>
          <Button className="mt-4" onClick={() => router.push('/agents/workshop')}>
            <PlusCircle className="h-4 w-4" /> Create Agent
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agentList.map((agent) => (
            <Card
              key={agent.id}
              className="hover:border-sky-200 dark:hover:border-sky-800 transition-colors cursor-pointer"
              onClick={() => router.push(`/agents/${agent.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        agent.status === 'active'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                          : agent.status === 'paused'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-600'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-400'
                      }`}
                    >
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold">{agent.name}</div>
                      <div className="text-xs text-muted-foreground">{agent.role}</div>
                    </div>
                  </div>
                  <Badge
                    variant={
                      agent.status === 'active'
                        ? 'secondary'
                        : agent.status === 'paused'
                          ? 'outline'
                          : 'outline'
                    }
                  >
                    {agent.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Trades</div>
                    <div className="font-medium">{agent.trades}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Budget</div>
                    <div className="font-medium text-xs">{agent.budget}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">Chain</div>
                    <div className="font-medium text-xs">{agent.chain}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
