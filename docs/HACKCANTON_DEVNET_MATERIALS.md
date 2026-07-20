# HackCanton S2 DevNet Node Materials

Source: https://hackathon.appsfactory.cc/season-2#materials (section "Hackathon DevNet node materials")

## DevNet endpoints

| Resource | URL / Endpoint |
|---|---|
| Wallet UI | `https://wallet.validator.hackcanton-01.devnet.naas.noders.services` |
| CNS (Canton Name Service) | `https://cns.validator.hackcanton-01.devnet.naas.noders.services` |
| gRPC Ledger API (port 5001) | `ledger-api-grpc.participant.hackcanton-01.devnet.naas.noders.services:443` |
| **JSON Ledger API (port 7575)** | `https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services:443` |
| Validator / Scan API (port 5003) | `https://validator-api-http.validator.hackcanton-01.devnet.naas.noders.services:443` |
| Logs / Grafana | `https://grafana.participant.hackcanton-01.devnet.naas.noders.services` |
| Audience (for JWT) | `https://hackcanton-01.devnet.naas.noders.services` |
| OIDC token URL | `https://keycloak.naas.noders.services/realms/noders-appsfactory/protocol/openid-connect/token` |

## Authentication

Use a password grant against the NODERS Keycloak realm. The client is pre-configured for the hackathon:

```bash
curl -sS 'https://keycloak.naas.noders.services/realms/noders-appsfactory/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=password' \
  --data-urlencode 'client_id=web-app-ui-hackcanton-01-devnet' \
  --data-urlencode 'username=<YOUR_APPSFACTORY_EMAIL>' \
  --data-urlencode 'password=<YOUR_APPSFACTORY_PASSWORD>' \
  --data-urlencode 'scope=openid daml_ledger_api offline_access'
```

The response contains an `access_token`. Use it as a `Bearer` token on all JSON Ledger API requests.

## Completed DevNet setup

| Step | Status | Value |
|---|---|---|
| DAR uploaded | Done | package `d62e13ab174d…` (LF 2.1, upgrades `51789b5390cb…`; built with a Daml 3.x SDK). Note: the repo's `daml.yaml` now pins the installed **3.4.11** (LF 2.1); a rebuild produces a new package id. |
| Package ID | `d62e13ab174d8da690a44c6dd354a223f8c70e43a0ac7e17b8385bfd8b291fad` |
| Parties allocated | Done | `auctioner-cognivern::122003aa...`, `alice-cognivern::122003aa...`, `bob-cognivern::122003aa...`, `charlie-cognivern::122003aa...` |
| Wallet onboarding | Done | Daml user ID: `e6c5f9fc-98ed-491f-b228-00cf931a05cc` |
| `actAs` rights granted | Done | Rights assigned to user `e6c5f9fc-98ed-491f-b228-00cf931a05cc` for all four parties |
| v2 client migration | Done | `src/backend/canton/CantonLedgerClient.ts` supports v1 sandbox and v2 DevNet |
| Backend DevNet proof | Done | Local backend wired to DevNet passed `canton-devnet-proof.ts`: roundId `0x58012d8c...` |
| Production cutover | Done | Hetzner backend env updated with DevNet JSON API v2 config; `pnpm deploy:hetzner` deployed `cognivern-backend`. `pnpm canton:proof` passed against `https://cognivern.thisyearnofear.com`. Demo video re-recorded against the DevNet-backed live UI |

## Allocated parties

```text
auctioner-cognivern::122003aa7c491e00a453145c4d2cd3dbf5db8908b4e663c9944baed57fd66effa668
alice-cognivern::122003aa7c491e00a453145c4d2cd3dbf5db8908b4e663c9944baed57fd66effa668
bob-cognivern::122003aa7c491e00a453145c4d2cd3dbf5db8908b4e663c9944baed57fd66effa668
charlie-cognivern::122003aa7c491e00a453145c4d2cd3dbf5db8908b4e663c9944baed57fd66effa668
```

## Authenticated Daml user ID

The wallet onboarding created the Daml user for the Keycloak account. The user ID is the Keycloak `sub` UUID, not the login email:

```text
e6c5f9fc-98ed-491f-b228-00cf931a05cc
```

## Bootstrap script

If you ever need to re-upload to a fresh participant with admin credentials:

```bash
pnpm tsx scripts/hack/bootstrap-devnet.ts
```

This uploads the DAR, records the new package ID, allocates the demo parties, and writes `.artifacts/devnet-bootstrap.json`.
