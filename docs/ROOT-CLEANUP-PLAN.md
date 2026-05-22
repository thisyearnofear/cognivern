# Root Organization Cleanup

> **Date:** 2026-05-22  
> **Current Rating:** 6/10 (frontend 9/10, root 3/10)

---

## Problems Found

### 1. Hidden Tool Directories (13 in root)

These are AI agent artifacts from various tools that touched this repo. 8 are already in `.gitignore` but take up mental space in the repo root:

| Directory | Origin | Action |
|---|---|---|
| `.aider.tags.cache.v4/` | Aider (gitignored) | Delete locally, no commit needed |
| `.blackbox/` | Blackbox AI (gitignored) | Delete locally |
| `.blackboxcli/` | Blackbox CLI (gitignored) | Delete locally |
| `.claude/` | Claude Code (committed) | Audit — may have project settings |
| `.commandcode/` | Command Code (gitignored) | Delete locally |
| `.junie/` | Junie (gitignored) | Delete locally |
| `.qwen/` | Qwen (gitignored) | Delete locally |
| `.zencoder/` | ZenCoder (gitignored) | Delete locally |
| `.zenflow/` | ZenFlow (gitignored) | Delete locally |
| `.artifacts/` | Unknown | Audit first |
| `.vscode/` | VS Code settings | Keep, ensure gitignored |
| `.github/` | CI/CD | Keep |
| `.husky/` | Git hooks | Keep |

### 2. Backend Code Scattered Across `src/`

The backend has no explicit organizational prefix. Everything under `src/` except `src/frontend/` is backend:

```
src/
├── frontend/          ← clearly labeled
├── modules/           ← backend
├── services/          ← backend
├── cre/               ← backend (CRE = run execution engine)
├── policies/          ← backend
├── di/                ← backend (dependency injection)
├── metrics/           ← backend
├── shared/            ← shared types
├── types/             ← backend types (duplicate of shared/types?)
└── utils/             ← backend utils (logger, crypto)
```

Should be:
```
src/
├── frontend/          ← Next.js app
├── backend/           ← all backend code
│   ├── modules/
│   ├── services/
│   ├── cre/
│   ├── policies/
│   ├── di/
│   └── metrics/
├── shared/            ← types + utils used by both
└── types/             ← audit first — merge with shared/types?
```

### 3. Duplicate Config Directories

- `config/` at root — contains `eslint.config.mjs`, `prettier.config.mjs`, `ecosystem.config.cjs`, `vite.config.ts`, `mcp-config.json`
- `src/config-reference/mcp-config.json` — duplicate of `config/mcp-config.json`
- `config/ts/` — TypeScript subconfigs for build (`tsconfig.shared.json`, `tsconfig.modules.json`)
- Duplicate `tsconfig.*.json` refs in `package.json` scripts

After migration, `config/vite.config.ts` and `config/ts/tsconfig.*.json` may be dead (frontend migrated to Next.js).

### 4. Stale Files at Root

| File | Status | Action |
|---|---|---|
| `OPS.md` | Unknown — ops guide | Keep or move to `docs/` |
| `vitest.config.ts` | Test config | Keep if tests exist, check |
| `tsconfig.json` | Backend build config | Keep (backed still needs it) |
| `.nvmrc` | Node version pin | Keep |
| `.prettierignore` | Linting | Keep |
| `.secrets.baseline` | Security | Keep (or move to `config/`) |

### 5. Frontend `package.json` Name

`"name": "frontend-next"` — should be `"cognivern-frontend"` or just `"frontend"`.

### 6. Build Scripts Still Reference Old Frontend

`"build:frontend": "cd src/frontend && pnpm install && pnpm build"` — pnpm is correct but the Next.js build script is `next build`, not `pnpm build`.

### 7. `pnpm-workspace.yaml` Needs Update

After folder rename, workspace config must point to new paths.

---

## Cleanup Plan

### Step 1: Delete Gitignored Tool Artifacts (local only)

```bash
rm -rf .aider.tags.cache.v4 .blackbox .blackboxcli .commandcode .junie .qwen .zencoder .zenflow
```

### Step 2: Move Backend Under `src/backend/`

```bash
cd src
mkdir backend
mv modules services cre policies di metrics backend/
```

Update `tsconfig.json` entry points and `package.json` build scripts.

### Step 3: Merge Config Duplicates

- Delete `src/config-reference/` — `config/` is the single source of truth
- Delete `config/vite.config.ts` — dead file after Next.js migration
- Audit `config/ts/` — remove subconfigs that only referenced old frontend

### Step 4: Move Stale Root Files to `docs/` or `config/`

```bash
mv OPS.md docs/
mv .secrets.baseline config/  # or keep at root if CI expects it there
```

### Step 5: Fix Frontend `package.json`

```diff
- "name": "frontend-next",
+ "name": "cognivern-frontend",
```

Update root `package.json`:
```diff
- "build:frontend": "cd src/frontend && pnpm install && pnpm build",
+ "build:frontend": "cd src/frontend && npm run build",
```

### Step 6: Update `pnpm-workspace.yaml`

```yaml
packages:
  - "src/frontend"
```

### Step 7: Gitignore the Tool Dirs (if not already)

```gitignore
.aider*
.blackbox*
.commandcode*
.junie*
.qwen*
.zencoder*
.zenflow*
.artifacts/
```

---

## After Cleanup: Target State

```
cognivern/
├── .github/            # CI/CD workflows
├── .husky/             # Git hooks
├── .vscode/            # Editor settings
├── config/             # All config (eslint, prettier, ts, PM2)
├── contracts/          # Smart contracts
├── deploy/             # Deploy scripts
├── docs/               # UX audit, migration plan, OPS
├── logs/               # Runtime logs
├── scripts/            # Dev/server scripts
├── src/
│   ├── backend/        # All backend code
│   │   ├── modules/
│   │   ├── services/
│   │   ├── cre/
│   │   ├── policies/
│   │   ├── di/
│   │   └── metrics/
│   ├── frontend/       # Next.js app
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── stores/
│   │   ├── next.config.ts
│   │   └── vercel.json
│   ├── shared/         # Types + utils shared by frontend and backend
│   └── types/          # Merge with shared/types or delete
├── tests/              # Test files
├── .gitignore
├── .nvmrc
├── .prettierignore
├── pnpm-workspace.yaml
├── package.json        # Root workspace config
├── tsconfig.json       # Backend TS config
└── README.md
```

**No hidden tool directories. No duplicate config. Clear frontend/backend separation.**

---

## Risk Assessment

- **Backend move (`src/backend/`):** High impact — all backend imports use relative paths so `modules/` → `backend/modules/` breaks nothing inside backend, but `package.json` refs need updating
- **Config merge:** Low risk — just deleting dead files
- **Tool artifacts:** Zero risk — all gitignored already
- **Frontend rename:** Low risk — just package name, no imports change

**Recommended order:** Delete tool artifacts first (quick win), fix frontend naming (quick win), then tackle backend reorganization (more careful testing needed).
