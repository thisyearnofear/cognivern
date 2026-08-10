# Cognivern FCC extension sources (mirrored)

These files are the customized Flare Compute Extension handlers for CSP-Flare.
The **runtime clone** lives on `nuncio-vultr` at `/opt/cognivern-flare/fce` (see
gitignored `docs/OPS.md`). Keep this mirror in sync when changing OPType logic.

| Path | Role |
| --- | --- |
| `internal/config/config.go` | `SPEND_POLICY` / `REGISTER_POLICY` / `EVALUATE_SPEND` |
| `internal/extension/extension.go` | TEE-private budgets + counters + evaluate |
| `pkg/types/types.go` | JSON request/response types |
| `nuncio.env.example` | Exotic port binds for Coolify coexistence |
| `cognivern-flare.traefik.yaml` | Traefik dynamic route template |

Do **not** commit real private keys. Host topology stays in `docs/OPS.md`.
