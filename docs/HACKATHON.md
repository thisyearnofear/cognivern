# Hackathons

Cognivern has been submitted to multiple hackathons. This doc tracks them.

| Hackathon | Track | Date | Status |
|-----------|-------|------|--------|
| Fhenix Privacy-by-Design Buildathon | Confidential Policy State | 2026-Q2 | Submitted (Waves 1-6) |
| X Layer Arena | Agent Spend Governance | 2026-Q2 | Submitted |
| 0G APAC — Track 3 | Agentic Economy / Autonomous Apps | 2026-Q2 | Submitted |
| OWS Hackathon — Track 02 | Agent Spend Governance & Identity | 2026-Q2 | Submitted |
| Agents Assemble Healthcare AI Endgame | Healthcare Governance | 2026-Q2 | Submitted |
| Agents Under Pressure — Build Your Own OS | PromptOS + DevFactory Grid | 2026-Q2 | Planning |

## Integration Details

Each hackathon contributed a specific integration. See the respective docs:

- **Fhenix** — [`FHENIX_INTEGRATION.md`](./FHENIX_INTEGRATION.md) — Confidential policy state via CoFHE, cross-chain via Hyperlane
- **OWS** — [`ARCHITECTURE.md`](./ARCHITECTURE.md) — Wallet bootstrap, API keys, governed spend execution
- **ChainGPT** — [`CHAINGPT_INTEGRATION.md`](./CHAINGPT_INTEGRATION.md) — Web3 LLM auditor, contract audit policy rules
- **0G** — `ZeroGStorageService` anchors governance decisions to 0G Storage
- **Agents Assemble** — FHIR/SHARP context adapter, Together AI evaluator, Kestra orchestration, MCP tool endpoint

## Demo Flow

```
Policy → Preview (simulate) → Execute (sign) → Audit (review)
```

1. **Create Policy** — `POST /api/governance/policies`
2. **Bootstrap Wallet** — `POST /api/ows/bootstrap`
3. **Issue API Key** — `POST /api/ows/api-keys`
4. **Preview Spend** — `POST /api/spend/preview`
5. **Execute Spend** — `POST /api/spend`
6. **Review Audit** — `GET /api/audit/logs`

## Related Docs

- [Architecture](./ARCHITECTURE.md)
- [Developer Guide](./DEVELOPER.md)
- [Deployment](./DEPLOYMENT.md)
