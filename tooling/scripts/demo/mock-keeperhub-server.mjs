#!/usr/bin/env node
/**
 * Local KeeperHub mock for end-to-end dry-runs of the Sapience
 * rebalance cycle.
 *
 * Models the documented Direct Execution sequence:
 *   1. POST /api/execute/transfer with simulate=true returns a successful
 *      non-broadcast simulation.
 *   2. The same body without simulate returns an executionId.
 *   3. GET /api/execute/:id/status returns an authoritative receipt.
 */

import http from 'node:http';

const PORT = Number(process.env.PORT || 9998);
const executions = new Map();
let txCounter = 0;

const server = http.createServer((req, res) => {
  const { method, url } = req;
  console.log(`[mock-keeperhub] ${method} ${url}`);

  if (method === 'GET' && url === '/api/user/wallet') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ walletAddress: '0x1111111111111111111111111111111111111111' }));
    return;
  }

  if (method === 'POST' && url === '/api/execute/transfer') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}');

      if (parsed.simulate === true) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            status: 'simulated',
            from: '0x1111111111111111111111111111111111111111',
            to: parsed.recipientAddress,
            value: parsed.amount,
            chainId: parsed.chainId,
            gasEstimate: '21000',
            wouldRevert: false,
          }),
        );
        return;
      }

      const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      executions.set(id, {
        executionId: id,
        status: 'pending',
        from: '0x1111111111111111111111111111111111111111',
        pollCount: 0,
        chainId: parsed.chainId,
        recipientAddress: parsed.recipientAddress,
        amount: parsed.amount,
      });
      console.log(`[mock-keeperhub] queued execution ${id}:`, parsed);
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ executionId: id, status: 'running' }));
    });
    return;
  }

  const match = url && url.match(/^\/api\/execute\/([^/]+)\/status$/);
  if (method === 'GET' && match) {
    const id = match[1];
    const exec = executions.get(id);
    if (!exec) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unknown executionId' }));
      return;
    }
    exec.pollCount += 1;
    if (exec.pollCount >= 2) {
      exec.status = 'completed';
      exec.transactionHash = `0x${String(++txCounter).padStart(8, '0')}${'a'.repeat(56)}`;
      exec.transactionLink = `https://example.test/tx/${exec.transactionHash}`;
      exec.sponsored = false;
      exec.receipts = [
        {
          hash: exec.transactionHash,
          chainId: exec.chainId,
          from: exec.from,
          to: exec.recipientAddress,
          value: exec.amount,
          verified: true,
          receiptStatus: 'success',
          blockNumber: 1,
          gasUsed: '21000',
        },
      ];
      console.log(`[mock-keeperhub] ${id} completed with transactionHash ${exec.transactionHash}`);
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'X-Poll-Interval-Hint': exec.status === 'completed' ? '0' : '1',
    });
    res.end(JSON.stringify(exec));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: `unknown ${method} ${url}` }));
});

server.listen(PORT, () => {
  console.log(`[mock-keeperhub] listening on http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('[mock-keeperhub] shutting down');
  server.close(() => process.exit(0));
});
