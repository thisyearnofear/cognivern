# Sapience Hackathon: Judges Guide

Welcome to the Cognivern evaluation guide. This document points you directly to the evidence of our **working, production-ready autonomous agent platform.**

## 🎯 Submission Summary
Cognivern is a multi-chain governance platform that optimizes autonomous agents for prediction markets. We have prioritized **strategic accuracy**, **architectural resilience**, and **immutable memory**.

---

## 📍 Evidence 1: Live On-Chain Activity (Arbitrum EAS)
Our agent is currently live and submitting real forecasts to the Sapience protocol on Arbitrum One.

- **Agent Wallet:** `0xc8F0D4FF31166Daf37804C20eeFd059e041E64dC`
- **Arbiscan Link:** [View EAS Attestations](https://arbiscan.io/address/0xc8F0D4FF31166Daf37804C20eeFd059e041E64dC)
- **Proof of Accuracy:** Our agent uses a **Horizon-Weighted Strategy**, prioritizing markets with the furthest resolution date to maximize Brier Score weighting.

## 📍 Evidence 2: Real-Time Reasoning Dashboard
Cognivern features a unified dashboard that showcases the agent's **"Thoughts"**—the actual LLM reasoning behind its predictions.

- **Dashboard:** [Link to your hosted frontend if applicable, otherwise: `http://snel-bot:10000`]
- **What to look for:** Under the **Activity Feed**, you will see real-time forecasts. Note the reasoning text; it is generated dynamically by our **Multi-LLM Resilience Layer** (Primary: Moonshot Kimi K2 | Fallback: Groq Llama 3.3).

## 📍 Evidence 3: Persistent Memory (Recall Network)
Every decision our agent makes is backed by an immutable reasoning record on the **Recall Network**. 

- **Technical Implementation:** Refer to `src/services/SapienceService.ts`. After every Arbitrum transaction, the agent triggers a `recallService.store()` call to persist its logic.
- **Why this matters:** It provides a verifiable audit trail of "Autonomous Intelligence" that persists across agent restarts.

---

## 🛠️ Unique Technical Achievements

### 1. Multi-LLM Fallback Architecture
We implemented a custom failover logic that ensures the agent remains operational even if primary LLM providers (Routeway.ai) are throttled or offline. The agent automatically shifts to Groq to guarantee that no strategic market window is missed.

### 2. Strategic Brain (Horizon Optimization)
Unlike basic bots that pick random markets, Cognivern's brain specifically hunts for markets with the **longest resolution window**. This mathematically secures the highest possible weighting for our forecasting scores.

### 3. Fail-Safe GraphQL
We transitioned from a basic SDK implementation to a **Direct Fetch GraphQL layer**. This allowed us to fix field validation errors in real-time and provide 100% uptime for market data ingestion.

---

## 📂 Key Source Code
- `src/services/AutomatedForecastingService.ts`: The core "brain" and Horizon Strategy.
- `src/services/SapienceService.ts`: The blockchain execution and Recall persistence.
- `src/modules/agents/services/AgentOrchestrator.ts`: Unified coordination of governance and execution.

---

**Cognivern is more than an agent; it's a governance framework for the future of prediction markets.**
