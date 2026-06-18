# Deployment

Generic deployment guide for Cognivern. Server-specific operational details
(incident playbooks, internal paths, rollback procedures) are kept in a
private `OPS.md` that is not committed to the repository.

## Architecture

```text
Internet → VPS → Express API (PM2) → optional Filecoin / LLMs
                    ↕
              Vercel (Frontend)
```

The backend runs as a PM2 fork-mode process on a VPS. The frontend deploys
to Vercel automatically on push to `main`.

## Deploy

### Artifact Deploy (Recommended)

Builds locally, ships a tarball to the server, restarts PM2:

```bash
pnpm deploy:hetzner
```

This runs two scripts:
1. `scripts/deploy/build-backend-artifact.sh` — compiles backend, bundles `dist/` + `config/` + `package.json` into a `.tgz`
2. `scripts/deploy/deploy-backend-artifact-hetzner.sh` — SCPs tarball, extracts, installs prod deps, restarts PM2, runs health check

No build happens on the server — it just extracts and restarts.

### Quick Restart

```bash
ssh <server> "pm2 restart cognivern-backend --update-env"
```

## Required Environment Variables

See `.env.example` for the full list. Minimum for production:

| Variable | Purpose |
| -------- | ------- |
| `NODE_ENV` | `production` |
| `PORT` | API port (must match nginx `proxy_pass`) |
| `API_KEY` | API authentication key |
| `JWT_SECRET` | JWT signing secret — authMiddleware throws if missing |
| `OWS_VAULT_SECRET` | Secret used to encrypt the local OWS vault |

Optional integrations: `FILECOIN_PRIVATE_KEY`, `FHENIX_PRIVATE_KEY`, `MONGODB_URI`, `CHAINGPT_API_KEY`, `OPENAI_API_KEY`. See `.env.example` for the complete list.

## PM2 Management

```bash
pm2 list
pm2 describe cognivern-backend
pm2 logs cognivern-backend --lines 50
pm2 logs cognivern-backend --err
pm2 restart cognivern-backend --update-env
pm2 save
```

PM2 must run in `fork` mode (not cluster) — SQLite requires single-process access.

## Log Rotation

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

## Reverse Proxy (nginx)

The backend listens on `$PORT`. nginx must `proxy_pass` to the same port.
A reference config is at `deploy/nginx/cognivern.conf`:

```bash
sudo cp deploy/nginx/cognivern.conf /etc/nginx/sites-enabled/cognivern
sudo nginx -t && sudo systemctl reload nginx
```

A port mismatch between `$PORT` and nginx makes every public endpoint return 502.

## Health Checks

```bash
curl http://127.0.0.1:<PORT>/health           # from server
curl https://<your-domain>/health?deep=true    # from outside
curl -s https://<your-domain>/api/health/slo   # SLO metrics
```

## SQLite Tables

Auto-created on first boot via idempotent `CREATE TABLE IF NOT EXISTS`:
`users`, `workspaces`, `nonces`, `api_keys`, `workspace_agents`, `workspace_policies`, `policy_versions`, `workspace_members`, `copilot_runs`, `copilot_events`.

No manual migration step required.

## Security Notes

- Never commit `.env` files or private keys
- API keys hashed with scrypt before storage
- JWT tokens revocable via server-side blacklist
- Rate limiting persistent across restarts (file-backed stores)
- SIWE authentication uses nonce replay protection
- Helmet CSP, CORS, body size limits, trust-proxy configured for production

## Related Docs

- [Architecture](./ARCHITECTURE.md) — System design, integrations, data flows
- [Developer Guide](./DEVELOPER.md) — Local setup, APIs, testing
