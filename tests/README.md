# Tests

Use the narrowest test surface that covers your change. Some suites are local and deterministic; others require external services, credentials, or a disposable environment.

## Test matrix

| Surface             | Location                             | Command                                                               | Notes                                                 |
| ------------------- | ------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------- |
| Backend/unit        | `tests/unit/` and backend test files | `pnpm vitest run`                                                     | Default local unit coverage                           |
| Backend integration | `tests/integration/`                 | `pnpm test:integration`                                               | May use databases, chains, or service doubles         |
| Frontend unit       | `src/frontend/tests/`                | `cd src/frontend && pnpm vitest run`                                  | Frontend Vitest config uses jsdom where needed        |
| Browser smoke       | `tests/e2e/`                         | `pnpm test:e2e tests/e2e/landing.spec.ts tests/e2e/demo-flow.spec.ts` | Starts the frontend on port 3000                      |
| Solidity/Fhenix     | `contracts/fhenix/test/`             | `npx hardhat --config contracts/fhenix/hardhat.config.cjs test`       | Uses the CoFHE Hardhat setup                          |
| Daml/Canton         | `daml/` and Canton integration tests | See [Daml README](../daml/README.md)                                  | Use local sandbox unless explicitly working on DevNet |
| TestSprite backend  | `.testsprite/tests/`                 | TestSprite/Python commands in [Developer Guide](../docs/DEV.md)       | External/generated suite; not the default local loop  |
| TestSprite frontend | `src/frontend/testsprite_tests/`     | TestSprite commands                                                   | Generated browser assets; not the default local loop  |

## Baseline before a PR

```bash
pnpm typecheck
pnpm vitest run
```

`pnpm lint` is the CI lint command and runs the frontend's canonical Next.js ESLint configuration.

Add the focused command for your area. For frontend changes, also run:

```bash
cd src/frontend
pnpm typecheck
pnpm lint
pnpm vitest run
```

For public/demo UI changes, run the two public browser smoke files. Authenticated browser coverage requires a disposable test account; never use production credentials.

## Test safety

- Prefer mocks and local fixtures for external providers.
- Do not send transactions or deploy contracts unless the task explicitly requires it.
- Do not create persistent test rounds on the live Canton DevNet.
- Treat `.testsprite/`, `test-results/`, and browser reports as generated/external artifacts rather than primary source tests.
