# Cognivern Frontend PRD

## Product Overview

Cognivern is a control plane for autonomous agent wallet operations. It provides governed spend management, AI-driven policy evaluation, and audit-ready transaction trails for AI agents operating across blockchains.

## Target Users

- AI agent developers who need spend governance
- Teams managing autonomous agents with wallet access
- Compliance officers auditing AI-driven transactions

## User Stories

### Landing Page
- As a visitor, I want to see a hero section explaining what Cognivern does
- As a visitor, I want to see a live spend demo showing policy evaluation
- As a visitor, I want to see network architecture showing which chains are used
- As a visitor, I want to see API code examples for integration

### Dashboard
- As a user, I want to see an overview of my agents and their spend activity
- As a user, I want to see statistics about on-chain actions and active policies
- As a user, I want to navigate to different sections via a sidebar

### Agents
- As a user, I want to view a list of all my registered agents
- As a user, I want to click on an agent to see its details and decision history
- As a user, I want to access the agent workshop to create new agents

### Governance
- As a user, I want to create governance policies with spend rules
- As a user, I want to evaluate actions against my policies
- As a user, I want to see policy versions and change history

### Spend Demo
- As a user, I want to interactively test spend scenarios
- As a user, I want to see how policies evaluate in real-time
- As a user, I want to see the flow from request to approval/rejection

### Audit Trail
- As a user, I want to view audit logs with evidence hashes
- As a user, I want to see compliance status of my transactions

### Copilot
- As a user, I want to view copilot workflow runs
- As a user, I want to see run details with event timelines

### CRE Runs
- As a user, I want to view CRE run history
- As a user, I want to click on a run to see its details

### PromptOS Terminal
- As a user, I want to interact with a terminal interface for PromptOS

### Settings
- As a user, I want to configure my workspace settings
- As a user, I want to manage API keys and integrations

### Integrations
- As a user, I want to view and manage my API keys
- As a user, I want to configure webhooks

## Functional Requirements

1. Landing page renders without errors with hero, demo, and architecture sections
2. Dashboard shows agent stats and spend overview
3. Sidebar navigation works for all dashboard pages
4. Agent list loads and displays registered agents
5. Agent detail page shows agent information
6. Agent workshop page loads for creating agents
7. Governance check page loads with evaluation form
8. Policies page loads showing policy list
9. Audit page loads showing audit trail
10. Copilot page loads showing run list
11. CRE runs page loads showing run history
12. Spend demo page loads with interactive controls
13. PromptOS terminal page loads with xterm interface
14. Settings page loads with workspace configuration
15. Integrate page loads with API key management
16. Onboarding page loads for new users
17. All pages are responsive and render without console errors
18. Dark/light theme toggle works if present
19. Page transitions animate smoothly
20. Error states display gracefully when API is unavailable

## Technical Specifications

- Framework: Next.js 16 with App Router
- UI: React 19, Tailwind CSS 4
- State: Zustand, TanStack Query, SWR
- Web3: Wagmi, Viem, RainbowKit
- Animation: Framer Motion
- Charts: Recharts
- Terminal: xterm.js
- Icons: Lucide React
- Notifications: Sonner
- Theme: next-themes
