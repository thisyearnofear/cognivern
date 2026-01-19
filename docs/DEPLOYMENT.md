# Sapience Agent Deployment Guide

## 🌐 **Recommended: Phala Cloud Deployment**

**For production AI agent deployments, we recommend Phala Cloud over self-hosting:**

### **Why Phala Cloud?**

- **🛡️ TEE Security**: Secure enclaves protect your private key and trading strategy.
- **🔄 Guaranteed Uptime**: Decentralized compute eliminates single points of failure.
- **💰 Cost Efficiency**: Pay-per-use model.

---

## 🚀 Current Self-Hosted Deployment Status

**🔒 PRODUCTION READY - SAPIENCE FORECASTER ACTIVE**

- ✅ **Agent Type**: Sapience Forecasting & Trading Agent
- ✅ **Network**: Arbitrum One (EAS Attestations) & Ethereal
- ✅ **Integration**: `@sapience/sdk` v0.2.0
- **Process Manager**: PM2 (`cognivern-agent`)
- **Server Location**: `/opt/cognivern` on `snel-bot`

## 📋 Architecture Overview

```
Frontend (Vercel) → HTTPS → api.thisyearnofear.com (Nginx) → Local Agent (Port 10000) → Arbitrum RPC
```

- **Frontend**: Deployed on Vercel (`cognivern.vercel.app`)
- **Backend**: Deployed on Hetzner server (`snel-bot`) at `/opt/cognivern`
- **Process**: Node.js managed by PM2
- **Blockchain**: Arbitrum One (via RPC)

## 🔧 Server Configuration

The agent is deployed on the `snel-bot` server.

### **Directory Structure**
```bash
/opt/cognivern/
├── .env                # Secrets (SAPIENCE_PRIVATE_KEY, API_KEY)
├── dist/               # Compiled JS code
├── node_modules/       # Dependencies
└── logs/               # PM2 logs
```

### **Management Commands**

**Check Status:**
```bash
pm2 status cognivern-agent
```

**View Logs:**
```bash
pm2 logs cognivern-agent
```

**Restart Agent:**
```bash
pm2 restart cognivern-agent
```

**Update & Redeploy:**
```bash
cd /opt/cognivern
git pull
pnpm install
pnpm build
pm2 restart cognivern-agent
```

## 🔒 Security Implementation

- **Private Keys**: Stored in `.env` (git-ignored), never exposed in code.
- **RPC Communication**: Over HTTPS to secure Arbitrum nodes.
- **API Access**: Protected by `X-API-KEY` header.

## 🌐 Environment Variables

Ensure `.env` on the server contains:

```env
NODE_ENV=production
PORT=10000
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
SAPIENCE_PRIVATE_KEY=your_private_key_here
API_KEY=your_api_key_here
```

## 🚀 Production Optimization

The agent runs in `production` mode, which:
- Disables debug logging
- Enables strict policy enforcement
- Uses optimized build artifacts (`dist/`)

## 📊 Monitoring

Monitor the agent's performance and connectivity:

1.  **Process Health**: `pm2 monit`
2.  **API Health Check**: `curl http://localhost:10000/health`
3.  **Logs**: Check `~/.pm2/logs/cognivern-agent-out.log` and `error.log`

## 🚨 Troubleshooting

**Agent not starting?**
- Check Node.js version (`node -v`). Must be v18+.
- Verify `.env` exists and has valid keys.
- Check for port conflicts (Port 10000).

**Forecasts failing?**
- Verify Arbitrum ETH balance for gas.
- Check RPC URL connectivity.
- Inspect logs for specific SDK errors.