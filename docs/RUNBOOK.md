# Operator Runbook

Incident response procedures for Cognivern production operators.

**Server**: `snel-bot` (user: `deploy`)
**API**: `https://cognivern.thisyearnofear.com`
**PM2 process**: `cognivern-backend`

See also: [OPS.md](./OPS.md) for deployment paths and PM2 commands.

---

## Quick Diagnostics

Run these first when investigating any issue:

```bash
# 1. Health check with dependency status
curl -s https://cognivern.thisyearnofear.com/health?deep=true | jq

# 2. SLO metrics (latency percentiles + error rates)
curl -s https://cognivern.thisyearnofear.com/api/health/slo | jq

# 3. Recent logs (last 200 lines, no streaming)
ssh snel-bot "pm2 logs cognivern-backend --lines 200 --nostream"

# 4. Error-only logs
ssh snel-bot "pm2 logs cognivern-backend --err --lines 100 --nostream"

# 5. Process status + resource usage
ssh snel-bot "pm2 describe cognivern-backend"

# 6. Correlation ID tracing — pass x-request-id from a failing request
#    to grep across logs
ssh snel-bot "grep 'REQUEST_ID_HERE' /opt/cognivern/shared/logs/*.log"
```

---

## Incident Playbooks

### 1. Governance Evaluations Timing Out

**Symptom**: `/api/governance/evaluate` returns 504 or takes >5s. SLO shows `p95Ms > 3000` and `sloMet: false`.

**Likely cause**: Fhenix co-processor unreachable, or SQLite lock contention from concurrent writes.

**Diagnose**:
```bash
# Check if Fhenix is the bottleneck
curl -s https://cognivern.thisyearnofear.com/health?deep=true | jq '.dependencies.fhenix'

# Check for SQLite lock errors in recent logs
ssh snel-bot "pm2 logs cognivern-backend --err --lines 50 --nostream | grep -i 'SQLITE_BUSY\|database is locked'"
```

**Fix**:
- If Fhenix is down: set `CONTROL_EVAL_MODE=false` in `.env` to bypass FHE evaluation path. Restart: `pm2 restart cognivern-backend --update-env`
- If SQLite locks: check for runaway processes writing to the DB. `pm2 list` — look for high CPU. Restart the process.

**Escalate**: If Fhenix testnet is down for >1hr, notify the Fhenix partner channel.

---

### 2. FHE Decisions Stuck Pending

**Symptom**: `ConfidentialSpendPolicy` evaluations on-chain never emit `SpendEvaluated` events. Tasks remain in pending state.

**Likely cause**: Fhenix co-processor (`0xeA30c4B...7848D9`) is offline or the testnet was migrated.

**Diagnose**:
```bash
# Check the Fhenix testnet RPC
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  $FHENIX_RPC_URL

# Check recent on-chain events
ssh snel-bot "pm2 logs cognivern-backend --lines 100 --nostream | grep -i 'SpendEvaluated\|fhenix\|coFHE'"
```

**Fix**:
- If RPC is unreachable, there is no local fix — Fhenix infra issue.
- If testnet was migrated, update `FHENIX_RPC_URL` and `TASK_MANAGER_ADDRESS` in `.env`.
- Temporarily disable on-chain FHE evaluation to restore governance functionality.

**Escalate**: Check Fhenix Discord/status page. File a support ticket if outage >2hr.

---

### 3. SQLite Lock Errors

**Symptom**: Logs show `SQLITE_BUSY: database is locked` or `database table is locked`. Users see 500 errors on governance or audit endpoints.

**Likely cause**: Multiple processes or threads writing to the same SQLite file concurrently. PM2 cluster mode or a stuck background job.

**Diagnose**:
```bash
# Check if PM2 is running in cluster mode
ssh snel-bot "pm2 describe cognivern-backend | grep -i 'exec mode'"

# Check for other processes accessing the DB
ssh snel-bot "fuser /opt/cognivern/shared/data/*.db 2>/dev/null"

# Check for stuck transactions
ssh snel-bot "ls -la /opt/cognivern/shared/data/*.db*"
```

**Fix**:
- Ensure PM2 is in `fork` mode (not `cluster`): `pm2 delete cognivern-backend && pm2 start ecosystem.config.cjs`
- If a `.db-journal` or `.db-wal` file is orphaned (process crashed), restart: `pm2 restart cognivern-backend`
- Last resort: backup the DB, delete the journal, restart.

**Escalate**: If data corruption is suspected, restore from `/opt/cognivern/backups/`.

---

### 4. MongoDB Connection Flapping

**Symptom**: Intermittent 500 errors. Logs show `MongoServerSelectionError` or `connection timed out`.

**Likely cause**: Atlas cluster paused (free tier auto-pause), network issue, or connection string misconfiguration.

**Diagnose**:
```bash
# Check MongoDB connectivity
ssh snel-bot "pm2 logs cognivern-backend --err --lines 50 --nostream | grep -i 'mongo'"

# Test connection directly
ssh snel-bot "mongosh 'mongodb+srv://...' --eval 'db.runCommand({ping:1})'" 2>/dev/null || echo "mongosh not available"

# Check if .env has correct MONGODB_URI
ssh snel-bot "grep MONGODB_URI /opt/cognivern/shared/.env | head -1"
```

**Fix**:
- If Atlas paused: log into Atlas dashboard and resume the cluster. Wait 2-5 min.
- If connection string is wrong: update `MONGODB_URI` in `/opt/cognivern/shared/.env`, restart.
- If network issue: check firewall rules and Atlas IP whitelist (add server IP).

**Escalate**: If Atlas cluster needs upgrade from free tier, coordinate with project owner.

---

### 5. Rate Limit False Positives

**Symptom**: Legitimate API requests returning 429. Users or agents report being blocked.

**Likely cause**: Rate limit thresholds too aggressive, or shared IP (NAT/Vercel edge) hitting per-IP limits.

**Diagnose**:
```bash
# Check current rate limit config
ssh snel-bot "grep -i 'RATE_LIMIT\|RATE' /opt/cognivern/shared/.env"

# Check rate limit store for blocked IPs
ssh snel-bot "cat /opt/cognivern/shared/data/rate-limit-store.json 2>/dev/null | jq 'keys'"

# Check which IPs are hitting limits
ssh snel-bot "pm2 logs cognivern-backend --lines 200 --nostream | grep '429\|rate.limit' | tail -20"
```

**Fix**:
- Increase limits: set `RATE_LIMIT_WINDOW_MS=60000` and `RATE_LIMIT_MAX_REQUESTS=200` in `.env`, restart.
- Clear the rate limit store: `ssh snel-bot "echo '{}' > /opt/cognivern/shared/data/rate-limit-store.json && pm2 restart cognivern-backend"`
- Whitelist specific IPs: add to `RATE_LIMIT_WHITELIST` env var (comma-separated).

**Escalate**: If legitimate traffic patterns changed significantly, review rate limit strategy with the team.

---

### 6. Disk Filling Up Under /opt/cognivern/shared

**Symptom**: `No space left on device` errors. PM2 logs show write failures. Service crashes.

**Likely cause**: Log files grew unchecked, SQLite WAL files accumulated, or CRE run storage expanded.

**Diagnose**:
```bash
# Check disk usage
ssh snel-bot "df -h /opt/cognivern && du -sh /opt/cognivern/shared/* | sort -rh"

# Check log sizes
ssh snel-bot "ls -lh /opt/cognivern/shared/logs/"

# Check PM2 log rotation config
ssh snel-bot "pm2 conf pm2-logrotate"
```

**Fix**:
```bash
# Truncate logs (keep last 1000 lines)
ssh snel-bot 'cd /opt/cognivern/shared/logs && for f in *.log; do tail -1000 "$f" > "$f.tmp" && mv "$f.tmp" "$f"; done'

# Clear pnpm cache
ssh snel-bot "pnpm store prune"

# Compact SQLite databases
ssh snel-bot "sqlite3 /opt/cognivern/shared/data/cre-runs.db 'VACUUM;' 2>/dev/null"

# Ensure log rotation is configured
ssh snel-bot "pm2 set pm2-logrotate:max_size 10M && pm2 set pm2-logrotate:retain 7 && pm2 set pm2-logrotate:compress true"
```

**Escalate**: If disk usage is from CRE run data (not logs), discuss data retention policy with the team before deleting.

---

### 7. Workspace Data Corrupted

**Symptom**: Specific workspace returns 500 on all governance requests. Other workspaces are fine. Error logs reference policy parsing or workspace lookup failures.

**Likely cause**: Corrupt policy JSON in SQLite, or workspace record with invalid state.

**Diagnose**:
```bash
# Check the workspace's policies
ssh snel-bot "sqlite3 /opt/cognivern/shared/data/governance.db \"SELECT id, name, status, substr(rules, 1, 100) FROM workspace_policies WHERE workspace_id = 'WORKSPACE_ID';\""

# Check for malformed JSON in rules
ssh snel-bot "sqlite3 /opt/cognivern/shared/data/governance.db \"SELECT id FROM workspace_policies WHERE json_valid(rules) = 0;\""
```

**Fix**:
- If rules JSON is malformed: export, fix, re-import via SQL.
- If workspace record is missing/corrupt: restore from backup or re-create via API.
- Nuclear option: restore the entire DB from `/opt/cognivern/backups/`.

**Escalate**: Always escalate workspace data issues — user data is involved.

---

## Rollback Procedure

### Application Rollback

```bash
# 1. Check available backups
ssh snel-bot "ls -lt /opt/cognivern/backups/ | head -10"

# 2. Stop the service
ssh snel-bot "pm2 stop cognivern-backend"

# 3. Backup current bundle
ssh snel-bot "cp /opt/cognivern/app/bundle/server.mjs /opt/cognivern/backups/server.mjs.pre-rollback.$(date +%Y%m%d)"

# 4. Restore last-good bundle
ssh snel-bot "cp /opt/cognivern/backups/server.mjs.PREVIOUS /opt/cognivern/app/bundle/server.mjs"

# 5. Restart
ssh snel-bot "pm2 restart cognivern-backend"

# 6. Verify
curl -s https://cognivern.thisyearnofear.com/health?deep=true | jq
```

### Contract Rollback

1. Redeploy the previous contract version using Hardhat.
2. Update contract addresses in `/opt/cognivern/shared/.env`.
3. Restart: `pm2 restart cognivern-backend --update-env`
4. Verify on-chain state matches.

### Database Rollback

```bash
# Stop service first
ssh snel-bot "pm2 stop cognivern-backend"

# Backup current DB
ssh snel-bot "cp /opt/cognivern/shared/data/governance.db /opt/cognivern/backups/governance.db.pre-rollback.$(date +%Y%m%d)"

# Restore from backup
ssh snel-bot "cp /opt/cognivern/backups/governance.db.BACKUP_DATE /opt/cognivern/shared/data/governance.db"

# Restart
ssh snel-bot "pm2 restart cognivern-backend"
```

---

## On-Call Escalation

### Contact Chain

1. **First responder**: Check PM2 logs and SLO endpoint. Most issues resolve with a restart.
2. **Infrastructure issues** (server, networking, disk): Server admin — see SSH config for `snel-bot` details.
3. **Blockchain/FHE issues**: Check partner status pages:
   - Fhenix: Discord `#testnet-support`
   - Filecoin Calibration: `#fil-calibration` on Filecoin Slack
   - X Layer: OKX developer support
   - Arbitrum Sepolia: Arbitrum Discord `#dev-support`
4. **Data loss or security incidents**: Project owner immediately.

### Key Resources

- **Deployer wallet**: `0x5912d140b58c62ff007D803D25ea7CcC818548D3` — private key in server `.env` (`FHENIX_PRIVATE_KEY` / `ARBITRUM_PRIVATE_KEY`)
- **Atlas dashboard**: MongoDB Atlas → Cluster0 → `papajams_db_user`
- **Vercel frontend**: vercel.com → cognivern project → deployments
- **CI/CD**: GitHub Actions → `CI` workflow on `main` branch
- **Domain**: `cognivern.thisyearnofear.com` → nginx on `snel-bot`

### When to Wake Someone Up

- Production API down for >5 minutes and a restart doesn't fix it
- On-chain contract state is inconsistent (funds at risk)
- Unauthorized access detected in logs
- Data corruption affecting multiple workspaces
- Disk full and unable to free space safely

---

## Postmortem Template

After resolving an incident, document it:

```markdown
# Postmortem: [Brief Title]

**Date**: YYYY-MM-DD
**Duration**: X minutes
**Severity**: P1/P2/P3
**Author**: [Name]

## Impact
- What broke for users/agents?
- How many requests/workspaces affected?
- Any data loss?

## Timeline
- HH:MM — Alert triggered / issue noticed
- HH:MM — Investigation started
- HH:MM — Root cause identified
- HH:MM — Fix deployed
- HH:MM — Service confirmed healthy

## Root Cause
What caused the incident? Be specific (config value, code path, external dependency).

## Resolution
What fixed it? Include exact commands run.

## Follow-ups
- [ ] Action item 1 (owner, due date)
- [ ] Action item 2 (owner, due date)

## Lessons Learned
- What went well?
- What could be improved?
- What monitoring would have caught this earlier?
```
