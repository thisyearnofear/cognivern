import type { Response } from "express";

interface SseConnection {
  res: Response;
  workspaceId: string;
}

class EventBusManager {
  private connections = new Map<string, Set<SseConnection>>();

  addConnection(workspaceId: string, conn: SseConnection): void {
    let conns = this.connections.get(workspaceId);
    if (!conns) {
      conns = new Set();
      this.connections.set(workspaceId, conns);
    }
    conns.add(conn);
  }

  removeConnection(conn: SseConnection): void {
    const conns = this.connections.get(conn.workspaceId);
    if (conns) {
      conns.delete(conn);
      if (conns.size === 0) this.connections.delete(conn.workspaceId);
    }
  }

  emit(
    workspaceId: string,
    event: string,
    data: Record<string, unknown>,
  ): void {
    const conns = this.connections.get(workspaceId);
    if (!conns) return;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const conn of conns) {
      try {
        conn.res.write(payload);
      } catch {
        this.removeConnection(conn);
      }
    }
  }

  connectionCount(workspaceId?: string): number {
    if (workspaceId) {
      return this.connections.get(workspaceId)?.size ?? 0;
    }
    let total = 0;
    for (const conns of this.connections.values()) total += conns.size;
    return total;
  }
}

export const eventBus = new EventBusManager();
