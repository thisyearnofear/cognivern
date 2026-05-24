# Agents Under Pressure — Build Your Own OS

> Hackathon: [Agents Under Pressure](https://www.aivalley.io/hackathons/agents-under-pressure-build-your-own-os)
> Window: 48 hours
> Plan compiled: 2026-05-24
> Status: **Planning**

---

## Thesis

The OS layer is the last unbundled primitive in AI. Cognivern already has the backend primitives — intent routing, agent orchestration, audit trails, governance — that map directly to the hackathon's concept manifest. This plan skins existing infrastructure with a beautiful OS metaphor.

---

## Chosen Concepts

**Primary: PromptOS (Concept 02)** — zero-syntax command line
**Secondary: DevFactory (Concept 04)** — multi-agent dev grid

This pairing is recommended by the hackathon brief itself and is the best fit for our existing codebase.

---

## Why Cognivern Is Positioned to Win

| Primitive | Existing Endpoint / Module | Maps To |
|-----------|---------------------------|---------|
| NL intent routing | `POST /api/intent` | PromptOS kernel |
| Agent orchestration | `src/backend/modules/agents`, Cloudflare Workers agents | DevFactory cores |
| Run ledger | `GET /api/cre/runs` | Agent status grid |
| Audit trail | `GET /api/audit/logs` | ChronosOS event log |
| Policy engine | `POST /api/governance/evaluate` | JarvisOS identity filter |
| Frontend | Next.js 16 + Tailwind v4 + Motion v12 | OS shell UI |

---

## Stack Gap Analysis

| Recommended | Status | Action |
|-------------|--------|--------|
| Next.js 15 | ✅ Have Next.js 16 | None |
| xterm.js | ❌ Missing | `pnpm add xterm @xterm/addon-fit` |
| Vercel AI SDK | ❌ Missing | `pnpm add ai @ai-sdk/openai` |
| Supabase Realtime | ❌ Missing (optional) | Only if adding ChaosOS viral element |
| Tailwind v4 | ✅ Present | None |
| Motion | ✅ Present (v12) | None |

---

## Core Principles Alignment

This plan adheres to Cognivern's core principles:

- **ENHANCEMENT FIRST**: Every feature builds on existing endpoints (`/api/intent`, `/api/cre/runs`, `/api/audit/logs`). No new backend systems — only UI layers on existing infrastructure.
- **DRY**: Terminal and grid are consumers of existing APIs, not parallel implementations. Single source of truth for intent routing, agent status, and audit data.
- **CLEAN**: The Vercel AI SDK streaming layer **wraps** the existing intent handler — it does not create a second LLM call path. Flow: `Terminal input → AI SDK stream → /api/intent (existing) → structured response → streamed back`.
- **MODULAR**: Each new component (`Terminal.tsx`, `AgentGrid.tsx`, `os/page.tsx`) is composable, testable, and independent.
- **ORGANIZED**: New files follow existing `src/frontend/components/` and `src/frontend/app/` structure. The `os/` subdomain grouping is consistent with domain-driven design.
- **CONSOLIDATION / PREVENT BLOAT**: Phase 0 audits for dead code before adding anything. Post-hackathon kill criteria ensure nothing lingers without product justification.

---

## Build Plan (48hr)

### Phase 0 — Audit & Consolidate (Hours 0–2)

- [ ] Audit `src/frontend/` for unused components, dead routes, and redundant dependencies
- [ ] Remove any dead code found (consolidation before addition)
- [ ] Verify existing `/api/intent` request/response schema — document as the integration contract
- [ ] Confirm Socket.IO or polling setup for real-time data from `/api/cre/runs`

### Phase 1 — Foundation (Hours 2–8)

- [ ] Install dependencies: `xterm`, `@xterm/addon-fit`, `ai`, `@ai-sdk/openai`
- [ ] Create `src/frontend/app/os/page.tsx` — main OS shell layout
- [ ] Create `src/frontend/components/os/Terminal.tsx` — xterm.js terminal component
- [ ] Wire terminal input → `POST /api/intent` → stream response back via Vercel AI SDK
- [ ] Boot sequence animation (Motion): fake kernel messages, then prompt ready

### Phase 2 — PromptOS Core (Hours 8–16)

- [ ] Enhance `/api/intent` to return structured JSON action schemas (not just text)
- [ ] Render action results in terminal with styled output (colored status, progress bars)
- [ ] Add command history (up/down arrows) and tab completion for common intents
- [ ] Virtual filesystem display: `ls`, `cd`, `cat` mapped to agent workspace state
- [ ] Error handling: graceful fallbacks when intent parsing fails

### Phase 3 — DevFactory Grid (Hours 16–24)

- [ ] Create `src/frontend/components/os/AgentGrid.tsx` — real-time agent allocation map
- [ ] Subscribe to `/api/cre/runs` via polling or Socket.IO for live agent status
- [ ] Visual states per agent core: `BUSY`, `IDLE`, `CRSH`, `SYNC` with color coding
- [ ] Motion animations: core spin-up, crash shake, re-route flow lines
- [ ] Auto-patch log feed at bottom of grid (from audit trail)

### Phase 4 — Integration, Testing & Polish (Hours 24–36)

- [ ] Connect terminal commands to agent grid: typing intent → grid lights up
- [ ] Split-screen layout: terminal left, agent grid right
- [ ] Add sound design cues (optional): keystroke sounds, agent spawn chimes
- [ ] Dark OS theme: monospace fonts, scan lines, subtle CRT glow via CSS
- [ ] Mobile responsive (judges may view on phones)
- [ ] Unit tests for Terminal → intent API integration (input dispatch, response rendering)
- [ ] Unit tests for AgentGrid status rendering (BUSY/IDLE/CRSH/SYNC states)
- [ ] Integration test: NL command → intent API → grid status update flow

### Phase 5 — Demo Flow (Hours 36–42)

- [ ] Script the demo narrative (see Demo Script below)
- [ ] Build auto-demo mode: pre-scripted commands that type themselves
- [ ] Ensure the "killer moment" works reliably: NL command → grid activates → code assembles
- [ ] Record backup video in case of live demo failure
- [ ] Deploy to Vercel, test on production URL

### Phase 6 — Buffer & Submission (Hours 42–48)

- [ ] Final bug fixes and edge case handling
- [ ] Write submission copy: README, screenshots, architecture diagram
- [ ] Submit

---

## Demo Script (3 minutes)

```
1. [0:00] Black screen. Boot sequence. Kernel messages scroll.
         "cognivern os v0.1 · agent kernel loaded · 4 cores online"

2. [0:20] Terminal prompt appears. Type:
         » look at my project files and scaffold a REST API from them

3. [0:30] Agent grid lights up. Cores go BUSY. Animated task routing.
         Terminal streams: "parsing intent... spawning 3 agents..."

4. [0:50] Results appear: file tree, generated code blocks, status ✓
         Grid shows cores completing, going IDLE.

5. [1:10] Type: » the auth middleware looks wrong, fix it
         One core spins up. Shows diff. Auto-patches.

6. [1:30] Type: » deploy this to staging
         Grid shows deployment pipeline. URL appears.

7. [1:50] Open the deployed URL in browser. It works.

8. [2:10] "What you just saw: natural language → structured execution →
          multi-agent orchestration → deployed code. No flags. No POSIX.
          No man pages. Just intent."

9. [2:30] Show the agent grid close-up. "Every agent is a core.
          You can see them think, crash, recover. The OS is transparent."

10.[2:50] Closing slide: "The OS layer is the last unbundled primitive
          in AI. We just shipped the first one."
```

---

## Product Value (Beyond the Hackathon)

These aren't throwaway demo features. Each concept fills a real gap in Cognivern's product:

| Concept | Hackathon Demo | Permanent Product Value |
|---------|---------------|------------------------|
| **PromptOS** | NL terminal UI | Unlocks non-developer users. Biggest TAM expansion. Lowers barrier from "read API docs" to "type a sentence." |
| **DevFactory Grid** | Agent allocation map | Observability dashboard. #1 request in agent platforms. Converts invisible infra to visible trust. Drives retention. |
| **ChronosOS** (stretch) | Timeline scrubber | Undo/replay for agent actions. Safety net that encourages bolder delegation. |
| **JarvisOS** (stretch) | Identity file | Personalized agent behavior. Stickiness moat — switching costs skyrocket once the system learns your style. |

### Before vs After

| Dimension | Before | After |
|-----------|--------|-------|
| Who can use it | Developers with API knowledge | Anyone who can type intent |
| Visibility | JSON logs, API responses | Real-time visual agent grid |
| Interaction model | REST API calls | Conversational terminal + live dashboard |
| Emotional response | "It works" | "This is magic" |

---

## Effort Estimates

| Component | Hours | Risk |
|-----------|-------|------|
| Phase 0: Audit & consolidate | 2 | Low |
| xterm.js terminal component | 2 | Low |
| Vercel AI SDK streaming | 2 | Low |
| Intent → action schema enhancement | 3 | Medium |
| Agent grid visualization | 4 | Medium |
| Real-time agent status subscription | 2 | Low |
| OS theme & animations | 3 | Low |
| Testing (unit + integration) | 3 | Low |
| Demo scripting & auto-demo mode | 3 | Low |
| Integration & polish | 4 | Medium |
| Deployment & submission | 2 | Low |
| **Total** | **30** | — |

Buffer: 18 hours (of 48) for unknowns, sleep, and iteration.

---

## Post-Hackathon Keep/Kill Criteria

To comply with **CONSOLIDATION** and **PREVENT BLOAT** principles:

- Each new component must have at least one user-facing use case beyond the demo
- Components not integrated into the main product within **2 sprints** get **deleted** (not deprecated)
- New dependencies (`xterm`, `@xterm/addon-fit`, `ai`, `@ai-sdk/openai`) get removed if their features are cut
- If the PromptOS terminal doesn't ship to users, the `os/` route and all associated components are deleted entirely
- No feature flags or soft-deprecation — either it's in the product or it's gone

---

## Success Criteria

- [ ] User types natural language → agents execute structured actions → results stream back
- [ ] Agent grid shows real-time status of all active agents with visual state transitions
- [ ] Demo runs end-to-end without manual intervention (auto-demo mode)
- [ ] Deployed to production Vercel URL
- [ ] Judges can interact with the terminal live

---

## References

- Hackathon brief: https://www.aivalley.io/hackathons/agents-under-pressure-build-your-own-os
- Existing intent API: `src/backend/modules/api/`
- Agent modules: `src/backend/modules/agents/`
- CRE run ledger: `src/backend/cre/`
- Frontend: `src/frontend/`
