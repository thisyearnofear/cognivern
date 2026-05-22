# Cognivern UX Audit Report

> **Date:** 2026-05-22  
> **Auditor:** Automated browser audit (Browser Use) + Code analysis  
> **Target URL:** https://cognivern.vercel.app  
> **Tools:** Browser Use AI automation (77-step session), static code analysis of `src/frontend/`

---

## Executive Summary

Cognivern is an AI agent governance platform targeting teams building autonomous agents that move money. The product concept is clear and the visual identity is polished, but there are **several severe functional bugs and UX problems** that would cause most first-time visitors to leave confused. The most critical issue is a full-page rendering bug in the dashboard that hides all content behind a massive blue gradient block.

---

## 1. Landing Page

### 🔴 Issue 1 — Hero Section Incomplete Above the Fold
**Location:** Landing page, initial viewport

The hero animation/shield graphic and the tagline pill ("For teams running AI agents that move money") are visible, but the main headline is **cut off at the very bottom of the screen**. Sub-copy, CTAs, and social proof are all **below the fold**. A first-time visitor sees a generic animated shield and nothing else — they have no idea what the product does without scrolling.

### 🔴 Issue 2 — Unclear "Open Wallet Standard" Button in Header
**Location:** Top navigation bar (right side)

The most visually prominent header element is a **green pill labeled "Open Wallet Standard"** with a lock icon. This is rendered as a filled button (the primary CTA style), but "Try Demo →" — the actual primary action — is rendered as plain text. This is **inverted hierarchy**: the badge/certification label looks like the CTA, and the real CTA looks secondary. First-time users will be confused about what "Open Wallet Standard" even means.

### 🟡 Issue 3 — Stats That Don't Inspire Confidence
**Location:** Landing page, hero section

Three metrics are shown: **"4 Chains Supported", "100% Transactions Audited", "<2 min Avg. Setup Time"**. The 100% Transactions Audited sounds like a made-up demo stat (0 out of 0 transactions), and "4 Chains Supported" is a weak differentiator. These feel like placeholder copy rather than real social proof.

### 🟡 Issue 4 — Section Label Clutter
**Location:** "TRY IT NOW" section label above "Scan Any Contract"

The pill label "TRY IT NOW" appears in the middle of the page over a section that already has a heading. It reads as redundant. Combined with the contract scanner, two CTA sections, and a "LIVE GOVERNANCE" block, the landing page has too many competing interaction areas with no clear hierarchy.

### 🟡 Issue 5 — Live Governance Feed Uses Real-Looking Timestamps That Aren't Live
**Location:** Landing page, LIVE GOVERNANCE section

Three rows show "2s ago", "14s ago", "28s ago" with APPROVED / HELD / AUDITED statuses. These appear to be animated demo data, but there's no clear label explaining they're simulated. First-time visitors may think this is real live activity or may notice the timestamps never change, creating distrust.

### 🟡 Issue 6 — Footer is Minimal to the Point of Being Unhelpful
**Location:** Bottom of landing page

The footer contains only one line: "Multi-Chain: X Layer + Filecoin + 0G + Fhenix · Open Wallet Standard Compliant · Powered by ChainGPT AI · Built with ❤️ for autonomous agent governance". No links, no privacy policy, no contact, no docs, no navigation — unusual for a B2B SaaS product targeting teams managing money.

---

## 2. Dashboard — Critical Bugs

### 🔴🔴 Issue 7 — CRITICAL: Giant Blue Block Hides All Content on Every Page
**Location:** Dashboard, Agents, and Runs pages — main content area  
**Code:** `src/frontend/src/components/dashboard/UnifiedDashboard.tsx`

**This is the most severe bug on the site.**

The "Live Governance Activity Feed" section renders as a **1,851px-tall blue gradient block** that occupies the entire viewport. Users must scroll ~900–1400px to see any actual dashboard content. On the Agents page, the entire visible area is just a blue gradient — there is no indication that anything is below, no scroll hint, no visible content. To a first-time user, every page except Policies and Audit looks completely blank/broken.

**Root cause analysis:** The live governance feed wrapper has a computed height of 1851px and a full blue gradient background, with the `DemoBanner` pinned near the bottom of that section. All real content — agent cards, stat tiles, governance alerts, the treasury section — is hidden below this block.

### 🔴 Issue 8 — "Keep exploring" Button Exits Demo Instead of Dismissing Banner
**Location:** `src/frontend/src/components/onboarding/DemoBanner.tsx` (line 92: `onClick={exitDemoMode}`)  
**Store action:** `src/frontend/src/stores/appStore.ts` — `exitDemoMode` sets `demoExplored: false`

Clicking **"Keep exploring"** calls `exitDemoMode()` which sets `demoExplored: false`. This causes the `AuthGuard` in `App.tsx` (line 62) to redirect back to the landing page (`/`).

This is the exact opposite of what the label implies — users expect "Keep exploring" to dismiss the banner and let them explore the demo. Instead, it **destroys their session and boots them out**.

### 🔴 Issue 9 — Sidebar Navigation Not Clickable as Standard Links
**Location:** `src/frontend/src/components/layout/ImprovedSidebar.tsx` — nav items rendered as `<div>`

The sidebar items are rendered as `<div>` elements, not `<a>` tags or `<button>` elements. React click handlers make them work programmatically, but they provide no keyboard navigation, no right-click "Open in new tab", no browser history on direct URL entry, and no discoverability for accessibility tools. This is a fundamental accessibility and navigation pattern problem.

### 🔴 Issue 10 — Direct URL Navigation to /dashboard Redirects to Landing Page
**Location:** `src/frontend/src/App.tsx` — Route structure and `AuthGuard` logic

Typing `cognivern.vercel.app/dashboard` directly in the address bar redirects to `/` (landing page). The demo is only accessible via the "Try Demo" button click flow. This breaks shareability, bookmarking, and any link anyone might share to the dashboard.

**Root cause:** `canAccessApp = isOnboarded || isInDemo` where `isInDemo = preferences.demoExplored`. Since `demoExplored` defaults to `false`, users who haven't first visited the landing page and clicked "Try Demo" will always be redirected.

---

## 3. Individual Dashboard Pages

### Agents Page

### 🟡 Issue 11 — Intelligence Activity Stream Chart Nearly Empty
**Location:** Agents page → Portfolio Agent → Activity tab → "Intelligence Activity Stream"

The chart renders as a large grey rectangle with only 3 tiny label fragments visible at the top edge. The chart body is completely blank — no data points, no axes visible, no gridlines. This looks broken even though the system claims to be in DEMO/LIVE mode.

### 🟡 Issue 12 — "SIMULATION DATA STREAM" Label is Unclear
**Location:** Agents page → Portfolio Agent card

A small label reads "SIMULATION DATA STREAM". It's unclear what this means to a first-time user — is it simulated data? The term needs context or a tooltip.

### Policies Page (Best-Working Section)
- Content is visible near the top of the page
- Policy template cards are well-designed and readable
- However, **stats all show 0** (0 Total Policies, 0 Active Policies, 0 Governed Agents)

### Audit Page

### 🟡 Issue 13 — All Audit Metrics Show Zero
**Location:** Audit page

Metrics: 0 Total Actions Logged, 0.0% Compliance Rate, 0ms Avg Response Time, 0 Critical Issues. The landing page promised "sample data to explore the flow" but no demo data is pre-loaded in the audit view.

### Runs Page

### 🟡 Issue 14 — "Run + Attest" Button Has No Visual Distinction from Destructive Action
**Location:** Runs page, button toolbar

**"Run + Attest"** is solid red. The red button implies danger/destructive action, but in this context it's a primary workflow action. Color signals the wrong intent.

---

## 4. General Design & Polish Issues

### 🟡 Issue 15 — "CV" Avatar vs. Shield Logo Inconsistency
**Location:** Sidebar top vs Landing page header

The sidebar shows a "CV" text avatar for Cognivern, while the landing page uses a proper shield SVG logo.

### 🟡 Issue 16 — Unknown Icons in Top Navbar
**Location:** Dashboard header, right side

A **monitor/screen icon** and **bell icon** with no tooltips visible. The monitor icon is a theme switcher but doesn't look like one.

### 🟡 Issue 17 — "OWS: No Wallet" Status Indicator
**Location:** UnifiedDashboard.tsx — `OwsStatusIndicator` component

"OWS" is unexplained — first-time users won't know this stands for "Open Wallet Standard."

### 🟡 Issue 18 — "← Collapse" Sidebar Button Inconsistent Positioning
**Location:** Bottom of sidebar

Button is at the very bottom of the sidebar, below "Add Agent". Collapse animation and behavior were not smooth in testing.

---

## 5. Summary Table

| # | Severity | Location | Issue | Code File |
|---|----------|----------|-------|-----------|
| 7 | 🔴 Critical | All dashboard pages | 1851px blue block hides all content | UnifiedDashboard.tsx |
| 8 | 🔴 Critical | Demo mode banner | "Keep exploring" exits demo entirely | DemoBanner.tsx → appStore.ts |
| 9 | 🔴 Critical | Left sidebar | Nav items not proper links/buttons | ImprovedSidebar.tsx |
| 10 | 🔴 Critical | Route /dashboard | Direct URL redirects to landing page | App.tsx → routeMeta.tsx |
| 1 | 🔴 High | Landing hero | Key content below fold on first load | LandingPage.tsx |
| 2 | 🔴 High | Header nav | CTA hierarchy inverted | LandingPage.tsx |
| 11 | 🟡 Medium | Agents | Activity chart renders empty | (chart component) |
| 12 | 🟡 Medium | Agents | "SIMULATION DATA STREAM" unclear | (chart component) |
| 13 | 🟡 Medium | Audit | All demo metrics show zero | (audit component) |
| 14 | 🟡 Medium | Runs | Red "Run + Attest" implies destructive | (runs component) |
| 3 | 🟡 Medium | Landing | Misleading "100% Transactions Audited" | LandingPage.tsx |
| 5 | 🟡 Medium | Landing | Fake-live timestamps on governance feed | LandingPage.tsx |
| 15 | 🟡 Low | Sidebar | "CV" avatar vs. shield logo inconsistency | ImprovedSidebar.tsx |
| 16 | 🟡 Low | Dashboard header | Unlabeled icon buttons | (layout component) |
| 17 | 🟡 Low | Dashboard | "OWS: No Wallet" jargon unexplained | UnifiedDashboard.tsx |
| 6 | 🟡 Low | Footer | No links, no navigation | LandingPage.tsx |

---

## 6. Code-Level Root Causes

### Issue 7 — Blue Block Height Bug
**File:** `src/frontend/src/components/dashboard/UnifiedDashboard.tsx`  
The `containerStyles` and layout sections don't have `max-height` constraints on the live governance feed wrapper. The blue gradient background is applied to a wrapper `div` that grows unbounded. Fix: set a `max-height` with `overflow: auto` on the feed section, or collapse it when empty.

### Issue 8 — "Keep exploring" Exits Demo
**File:** `DemoBanner.tsx` (line 92) calls `exitDemoMode()`  
**File:** `appStore.ts` (line 160-165) `exitDemoMode` sets `demoExplored: false`  
**File:** `App.tsx` (lines 43-46) `canAccessApp = isOnboarded || isInDemo`  
When `demoExplored` becomes `false`, the `AuthGuard` redirects to `/`.  
**Fix:** Rename `exitDemoMode` to `dismissBanner` or separate "dismiss banner" from "exit demo mode."

### Issue 9 — Sidebar div Instead of a/button
**File:** `ImprovedSidebar.tsx` — Nav items rendered as `<div>` with `onClick`. No `<a>` tags, no `role` attributes, no keyboard accessibility.

### Issue 10 — Direct URL Can't Access Dashboard
**File:** `App.tsx` (lines 43-46, 59-83)  
`AuthGuard` gates dashboard behind `canAccessPp` which checks `preferences.demoExplored`. On fresh page load without `localStorage` state, `demoExplored` defaults to `false`. No mechanism (query param, cookie, session storage) allows direct entry.
