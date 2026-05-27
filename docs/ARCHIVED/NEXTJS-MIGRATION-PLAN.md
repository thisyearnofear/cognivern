# Next.js 16 Migration Plan

> **Date:** 2026-05-22
> **Target:** Migrate from Vite SPA (React 18 + Emotion + react-router-dom) to Next.js 16 (App Router + Tailwind CSS + Server Components + shadcn/ui)
> **Rationale:** No users yet — full rewrite without backward-compatibility constraints. Current SPA has poor first paint, JS-dependent rendering, Emotion runtime overhead, and no SSR.

---

## Why

### Current Problems

- **SPA with zero SSR** — first paint requires JS download, parse, and execute. Browser automation tools render the page as a blank shell.
- **Emotion CSS-in-JS runtime** — 15KB+ runtime, forces all components to be Client Components, style injection happens in the browser.
- **react-router-dom** — client-side routing means every navigation re-downloads and re-executes JS.
- **Manual data fetching** — 600-line ApiService class with polling patterns, API keys exposed in browser.
- **Empty `<head>`** — no meta tags, no OG images, no structured data. The landing page has zero SEO.
- **UX debt** — sidebar renders as `<div>` not `<button>`, collapsed states unreliable, blue 1851px banner bug, direct URL routing broken. These were patched but the SPA model makes them easy to reintroduce.

### What Next.js + Tailwind + shadcn/ui Gives You

- **Server Components** — landing page renders to HTML on the server. Zero JavaScript shipped for static content.
- **Tailwind CSS** — zero-runtime styles, build-time generated, CSS variables for theming. No `"use client"` requirement.
- **shadcn/ui** — accessible, keyboard-navigable primitives (sidebar, button, card, dialog, command palette) built on Radix UI. Ships as source code you own and customize.
- **App Router** — file-system routing, layouts, loading states, error boundaries built-in.
- **BFF pattern** — API route handlers proxy to backend, hide API keys from browser.
- **Metadata API** — per-route `<head>` control, OG images, structured data.
- **Turbopack** — faster dev startup (~400% faster than current Vite).

---

## UI/UX Design Principles (from reference research)

Three key references informed this design. Here's what each contributes uniquely:

### Reference 1: Jason-uxui/project-dashboard (shadcn sidebar + Gantt timeline)

**What it does well:**

- **Hover-reveal actions** — sidebar items show a `···` menu on hover, keeping the default state clean
- **Progress circles** — compact SVG circles showing completion % with a transition on dashoffset change, used in the sidebar for "Active Projects"
- **Draggable Gantt timeline** — project rows with draggable bars, zoom controls (Day/Week/Month/Quarter), "today" line, sticky name column. Full project/task hierarchy with collapse.
- **Step wizard** — 5-step project creation wizard with animated transitions (`AnimatePresence`), a stepper sidebar, and a "Quick Create" mode for power users
- **Avatar dropdown** — sidebar footer with user avatar, email, and dropdown for settings/logout
- **Command palette** — `⌘K` search bar with keyboard shortcut hint

**What to borrow for Cognivern:**

- The **progress circles** for agent policy compliance scores in the sidebar
- The **hover-reveal actions** pattern on sidebar items
- The **sticky sidebar rows + scrollable timeline** pattern for the audit trail / run ledger
- The **step wizard** pattern for onboarding flow (replace current SmartOnboarding)

### Reference 2: Codrops EaseReverseClipMenu (GSAP clip animations)

**What it does well:**

- **Clip-path reveals** instead of opacity fades — text "unwraps" from left/right using `clip-path: inset()`
- **easeReverse** — the GSAP `easeReverse` flag makes reverse animations use the same eased timing as forward, so closing feels choreographed and deliberate, not abrupt
- **Cover image scatter** — background images are positioned on a CSS grid, then on menu open they animate radially outward with rotation and opacity fade (each at different delay based on distance from viewport center)
- **Interrupt handling** — if you click again mid-animation, the timeline rebuilds with a `timeScale` multiplier (4×) so interruptions feel fast and responsive
- **Accessibility** — `aria-hidden`, `aria-expanded`, `tabIndex` toggling on the menu; Escape key closes; keyboard navigation

**What to borrow for Cognivern:**

- The **clip-path text reveal** for the landing page hero headline (instead of a simple fade-in)
- The **radial scatter** animation for the shield logo background elements on page load
- The **interrupt handling** pattern — if a user clicks a nav item while an animation is running, speed it up 4× instead of queuing
- The **background grid scatter** as a loading/splash screen aesthetic (the "cover" of images flying apart to reveal the app)

### Reference 3: General Dashboard Principles (Medium article)

**Core principles to apply:**

1. **Dark-first by default** — developer/agent governance tool, dark mode should be default
2. **Content density** — show data, not chrome. Thin borders, subtle dividers, no heavy card shadows
3. **Progressive disclosure** — hover-reveal actions, expandable sections, collapsible sidebar
4. **Consistent spacing grid** — use Tailwind's spacing scale uniformly (no more ad-hoc `designTokens.spacing[3]` vs `[4]` confusion)
5. **Empty states with guidance** — every empty data view should show a clear next action, not just "No data"
6. **Keyboard-first navigation** — `⌘K` for search, `⌘B` for sidebar toggle, arrow keys for list navigation
7. **Real-time feel** — optimistic updates, skeleton loaders, streaming responses

### Visual Language Summary

| Before (Emotion SPA)                          | After (Next.js + Tailwind + shadcn)                            |
| --------------------------------------------- | -------------------------------------------------------------- |
| Heavy card shadows (`box-shadow: 0 4px 24px`) | Subtle elevation (`shadow-sm`, `border-border/40`)             |
| Inline gradient backgrounds on cards          | Solid backgrounds with accent border-left                      |
| `"CV"` text logo                              | Shield SVG icon + brand name                                   |
| Manual sidebar state machine                  | `SidebarProvider` with cookie persistence                      |
| Fade-in animations on every element           | Clip-path reveals + radial scatter (selective, not everywhere) |
| Competing CTA areas                           | Clear hierarchy via progressive disclosure                     |
| Polling every 30s                             | SSE/WebSocket for real-time feel                               |
| Empty states say "No data"                    | Empty states say "Add your first..." with CTA                  |

---

## Tech Stack

| Layer         | Choice                                | Rationale                                             |
| ------------- | ------------------------------------- | ----------------------------------------------------- |
| Framework     | Next.js 16 App Router                 | SSR, RSC, file-system routing, middleware             |
| Styling       | Tailwind CSS v4                       | Zero runtime, dark mode via class strategy            |
| UI Primitives | shadcn/ui (Radix-based)               | Accessible sidebar, dialog, command palette, dropdown |
| Icons         | lucide-react (keep)                   | Already in use, tree-shakeable                        |
| Charts        | recharts (keep, ssr:false)            | Already in use                                        |
| State         | Zustand (keep)                        | Works in Next.js with hydration guard                 |
| Data Fetching | Server Actions + TanStack React Query | Replace custom ApiService hooks                       |
| Animation     | tailwind-merge + CSS transitions      | Avoid GSAP dependency; use CSS where possible         |
| Font          | Geist Sans (Next.js default)          | Replace current system font stack                     |

## Strategy: Aggressive Full Rewrite

Since there are no users, we don't need incremental migration or backward compatibility. The plan is:

1. **Scaffold** new Next.js 16 app in `src/frontend/` (replace current Vite app)
2. **Initialize shadcn/ui** — `npx shadcn@latest init` sets up the component system
3. **Strip Emotion** entirely — replace with Tailwind utility classes + shadcn primitives
4. **Rewrite sidebar** — use shadcn's `SidebarProvider` pattern (the current manual `sidebarState` state machine becomes a simple React context)
5. **Rewrite routing** — react-router-dom → App Router file-system routes
6. **Rewrite data fetching** — custom hooks → server actions + React Query on client
7. **Keep** Zustand stores (with hydration guard), lucide-react icons, recharts, web3 SDKs (as client-only dynamic imports)
8. **Deploy** — single Vercel project, no Vite config

---

## Phase 1: Foundation (Week 1)

### 1.1 Scaffold Next.js 16 + shadcn/ui

```bash
cd src/frontend
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir
npx shadcn@latest init
npx shadcn@latest add sidebar button card dialog dropdown-menu tooltip badge
```

This replaces `package.json`, `tsconfig.json`, `vite.config.ts` with Next.js equivalents. shadcn/ui adds Radix-based accessible primitives as source code in `src/components/ui/`.

### 1.2 Configure Tailwind with Design Tokens

Current `designTokens.ts` maps directly to a `tailwind.config.ts` theme extension. The shadcn sidebar system also uses CSS variables for theming which maps naturally to Cognivern's dark/light mode:

```ts
// tailwind.config.ts
export default {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
          950: "#082f49",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          accent: "hsl(var(--sidebar-accent))",
          border: "hsl(var(--sidebar-border))",
        },
        // secondary, semantic (success/warning/error/info), accent, neutral
      },
    },
  },
};
```

### 1.3 Theme via CSS Variables + dark: Class

The shadcn sidebar system uses CSS variables for theming (`--sidebar-background`, `--sidebar-foreground`, etc.) which switch between light/dark values. This replaces both the Emotion ThemeProvider and the current `data-theme` CSS variable approach.

```tsx
// app/layout.tsx — shadcn theme provider wraps theme switching
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  <SidebarProvider>{children}</SidebarProvider>
</ThemeProvider>
```

All Emotion `effectiveTheme === 'dark' ? X : Y` patterns become `dark:bg-sidebar-accent bg-sidebar`.

### 1.4 Configure API Proxy

```ts
// next.config.ts
export default {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://api.thisyearnofear.com/:path*",
      },
    ];
  },
};
```

---

## Phase 2: Layout & Routing (Week 2)

### 2.1 App Router Structure

```
src/frontend/src/
├── app/
│   ├── layout.tsx              # Root layout (ThemeProvider, SidebarProvider)
│   ├── page.tsx                # Landing page (SSR — zero JS for hero content)
│   ├── globals.css             # Tailwind directives + shadcn CSS variables
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Dashboard layout (AppSidebar + main area)
│   │   ├── dashboard/page.tsx  # UnifiedDashboard
│   │   ├── agents/
│   │   │   ├── page.tsx
│   │   │   ├── [agentId]/page.tsx
│   │   │   └── workshop/page.tsx
│   │   ├── policies/page.tsx
│   │   ├── audit/page.tsx
│   │   ├── runs/
│   │   │   ├── page.tsx
│   │   │   └── [runId]/page.tsx
│   │   ├── governance/check/page.tsx
│   │   └── demo/spend/page.tsx
│   └── onboarding/page.tsx
├── components/
│   ├── ui/                     # shadcn primitives (button, card, sidebar, etc.)
│   ├── app-sidebar.tsx         # Application sidebar (nav items, active projects, user)
│   ├── dashboard/              # Existing dashboard components, ported to Tailwind
│   ├── landing/                # Landing page components
│   └── ...                     # All other components, one by one
├── lib/
│   ├── data/                   # Demo/seed data (sidebar nav, agents, policies)
│   └── utils.ts                # cn() helper for class merging
└── middleware.ts               # Auth guards
```

### 2.2 Sidebar (shadcn SidebarProvider pattern)

The current 440-line `ImprovedSidebar.tsx` with manual `sidebarState` juggling (expanded/collapsed/hidden/overlay) is replaced by shadcn's `SidebarProvider`:

```tsx
// components/app-sidebar.tsx
"use client";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>{/* Logo + Workspace name */}</SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          {/* Nav items: Dashboard, Agents, Policies, Audit, Runs */}
          {/* Each gets active state, badges, descriptions */}
        </SidebarGroup>
        <SidebarGroup label="Active Projects">
          {/* Progress circles for agent compliance */}
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {/* User avatar + dropdown (settings, templates, help) */}
      </SidebarFooter>
    </Sidebar>
  );
}
```

**shadcn sidebar gives you for free** (what the current code does manually):

- Collapsible state management via `SidebarProvider` context
- Keyboard shortcut to toggle (`⌘B`)
- Mobile overlay behavior
- State persisted via cookies (replaces localStorage)
- `aria-current="page"` on active nav items (replacing the manual `isActive` check)
- Proper `<button>` elements with keyboard navigation (fixing Issue 9 permanently)

### 2.3 Route Guards → Middleware

Replace `AuthGuard` + `DemoEntry` + `Web3Gate` with Next.js middleware:

```ts
// middleware.ts
export function middleware(request: NextRequest) {
  const demoExplored = request.cookies.get("demoExplored")?.value;
  const onboarded = request.cookies.get("onboardingCompleted")?.value;
  const path = request.nextUrl.pathname;

  // Landing page - redirect to dashboard if already in demo
  if (path === "/" && (demoExplored || onboarded)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Dashboard routes - redirect to landing if not in demo
  if (path.startsWith("/dashboard") && !demoExplored && !onboarded) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}
```

This runs on the server before any JS loads — no more "direct URL to /dashboard redirects to landing" bug (fixing Issue 10 for real this time).

### 2.4 Layout Nesting

```tsx
// app/layout.tsx — Root
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

```tsx
// app/(dashboard)/layout.tsx — Dashboard shell with shadcn sidebar
export default function DashboardLayout({ children }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <DemoBanner />
        {children}
      </main>
    </SidebarProvider>
  );
}
```

The sidebar state (collapsed/expanded) is managed by `SidebarProvider` — no more manual `sidebarState` enum, no `getSidebarWidth()` function, no local storage persistence code. All of that is handled by the shadcn sidebar system.

---

## Phase 3: Component Migration (Week 3-4)

### 3.1 Styled Components → Tailwind

**Emotion pattern (before):**

```tsx
/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

<div css={css`
  padding: ${designTokens.spacing[4]};
  background: ${isDark ? tokens.colors.neutral[800] : 'white'};
  border-radius: ${designTokens.borderRadius.lg};
`}>
```

**Tailwind + shadcn pattern (after):**

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

<Card className={cn("p-4", isDark && "dark")}>
  <CardContent>...</CardContent>
</Card>;
```

**Conversion strategy:**

- `*.styles.ts` files → inline Tailwind classes in the component
- `Card`, `Button`, `Badge`, `Tooltip` → shadcn primitives (accessible by default, no custom CSS)
- Dynamic styles based on theme → use `dark:` prefix variants or `cn()` helper
- Dynamic styles based on props/state → use `cn()` with conditional class strings
- `designTokens.colors.primary[600]` → `text-primary-600`
- `designTokens.spacing[4]` → `p-4`
- `designTokens.borderRadius.lg` → `rounded-lg`
- `designTokens.shadows.md` → `shadow-md`
- `designTokens.typography.fontSize.sm` → `text-sm`
- `designTokens.typography.fontWeight.semibold` → `font-semibold`

### 3.2 Data Fetching → Server Actions + Client Hooks

**Before (custom fetch hook):**

```tsx
function useAgentData(agentType: string) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(`/api/agents/${agentType}/status`, { headers: { "X-API-KEY": key } })
      .then((r) => r.json())
      .then(setData);
  }, [agentType]);
  return data;
}
```

**After (server action + client component):**

```ts
// app/actions/agents.ts — Server Action
"use server";
export async function getAgentStatus(agentType: string) {
  const res = await fetch(
    `https://api.thisyearnofear.com/api/agents/${agentType}/status`,
    {
      headers: { "X-API-KEY": process.env.API_KEY },
    },
  );
  return res.json();
}
```

```tsx
// Client component with React Query (for polling)
"use client";
import { useQuery } from "@tanstack/react-query";
import { getAgentStatus } from "@/app/actions/agents";

function AgentMonitor({ agentType }: { agentType: string }) {
  const { data } = useQuery({
    queryKey: ["agent", agentType],
    queryFn: () => getAgentStatus(agentType),
    refetchInterval: 30000, // preserves existing polling
  });
  return <div>{/* render */}</div>;
}
```

**API key** moves from browser env vars to server-side env vars (`.env.local` on server, never exposed).

### 3.3 Zustand Hydration

Zustand stores with `localStorage` persist need SSR-safe hydration:

```tsx
// components/ZustandHydration.tsx
"use client";
export function ZustandHydration({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  if (!hydrated) return null; // or a skeleton
  return <>{children}</>;
}
```

### 3.4 Browser-only SDKs (Web3, Fhenix, Recall)

These require `window.ethereum` and must be wrapped:

```tsx
import dynamic from "next/dynamic";
const FhenixProvider = dynamic(
  () => import("@/components/blockchain/FhenixProvider"),
  {
    ssr: false,
  },
);
```

---

## Phase 4: Polish (Week 5)

### 4.1 Metadata & SEO

```tsx
// app/page.tsx — Landing page metadata
export const metadata = {
  title: "Cognivern — AI Agent Governance",
  description: "Govern every agent transaction. Without slowing builders down.",
  openGraph: {
    title: "Cognivern — Agent Governance Platform",
    description: "Checks every spend against your policy in under 100ms.",
    images: ["/og-image.png"],
  },
};
```

### 4.2 Dynamic OG Image

Use `@vercel/og` / `satori` to generate OG images from the shield logo + headline.

### 4.3 Loading & Error States

- `loading.tsx` per route group (skeleton screens replace current `DashboardSkeleton`)
- `error.tsx` per route group (replaces current `UserFriendlyError` pattern)
- Streaming with `React.Suspense` for data-heavy sections

### 4.4 Real-time Updates

Replace the current 30s polling with:

- **SSE** via a Route Handler that streams from the backend
- **WebSocket** for agent activity feed (keep existing EventSource pattern, now in a Server Component)

---

## Files to Delete

After migration, these are no longer needed:

| File/Folder                               | Reason                                           |
| ----------------------------------------- | ------------------------------------------------ |
| `vite.config.ts`                          | Replaced by `next.config.ts`                     |
| `tsconfig.app.json`                       | Replaced by Next.js `tsconfig.json`              |
| `index.html`                              | Replaced by Next.js root layout                  |
| `src/styles/`                             | Replaced by `tailwind.config.ts` + `globals.css` |
| `src/components/layout/routeMeta.tsx`     | Replaced by file-system routing                  |
| `src/components/layout/AuthGuard`         | Replaced by `middleware.ts`                      |
| `@emotion/react`, `@emotion/styled`       | Removed from dependencies                        |
| `react-router-dom`                        | Removed from dependencies                        |
| All `*.styles.ts` files                   | Styles moved to Tailwind classes                 |
| `src/services/apiService.ts`              | Replaced by server actions                       |
| `src/utils/api.ts` (getApiUrl, getApiKey) | Replaced by server-side env + rewrites           |

---

## Dependencies to Add

| Package                    | Purpose                                                  |
| -------------------------- | -------------------------------------------------------- |
| `next@latest`              | Framework                                                |
| `tailwindcss`              | Styling (included in create-next-app)                    |
| `shadcn/ui`                | Accessible UI primitives (sidebar, button, card, dialog) |
| `clsx` or `tailwind-merge` | Conditional class merging                                |
| `@tanstack/react-query`    | Client data fetching with polling (keep)                 |
| `zustand`                  | State management (keep)                                  |
| `lucide-react`             | Icons (keep)                                             |
| `recharts`                 | Charts (keep, dynamic import with ssr:false)             |
| `@vercel/og`               | Dynamic OG image generation                              |

---

## Total Effort Estimate

| Phase         | Tasks                                                   | Est. Time  |
| ------------- | ------------------------------------------------------- | ---------- |
| 1. Foundation | Scaffold, shadcn init, Tailwind config, API proxy       | 2-3 days   |
| 2. Routing    | App Router structure, middleware, shadcn sidebar layout | 3-4 days   |
| 3. Components | Convert 50+ files from Emotion to Tailwind + shadcn     | 10-14 days |
| 4. Data Layer | Server actions, replace ApiService, Zustand hydration   | 5-7 days   |
| 5. Polish     | Metadata, loading states, OG images, real-time          | 3-4 days   |

**Total: ~4-5 weeks** for one developer working full-time.

**Note on shadcn/ui time savings:** The sidebar rewrite alone saves ~400 lines of manual state management code. The shadcn sidebar system handles collapsible state, keyboard shortcuts, mobile overlay, cookie persistence, and accessibility out of the box — what the current codebase does manually across `ImprovedSidebar.tsx`, `useSidebarState.ts`, `ResponsiveLayout.tsx`, and `AppLayout.tsx`.

---

## Migration Order (Recommended)

The safest order is **bottom-up** — convert leaf components (UI primitives) first, then compose them into pages:

1. Tailwind config + shadcn init (Phase 1)
2. shadcn UI primitives — these replace current `components/ui/` Emotion-based components
3. Layout shell (shadcn sidebar + header) — establishes the visual structure and replaces the most complex code
4. Landing page — the only public page, highest SSR value, simplest component
5. Dashboard pages one by one — each page conversion is self-contained
6. Server actions + API layer — do this last since it's backend-facing and doesn't affect visuals
7. Delete old Vite/Emotion files — only after confirming everything works

This way you get a working app after each step and can deploy incrementally. The sidebar + landing page can ship first, then dashboard pages follow independently.
