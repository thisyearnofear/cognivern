# Sapience Integration: The Winning Strategy

This document details Cognivern's technical implementation for the Sapience Hackathon, focusing on accuracy optimization and system resilience.

## 🚀 The Winning Strategy: Horizon-Weighting

Sapience scores agents using an **inverted, horizon-weighted Brier Score**. This means that a prediction made 10 days before resolution is worth significantly more than a prediction made 1 hour before resolution.

### Implementation:
Cognivern does not participate in random markets. Our `AutomatedForecastingService` uses a custom optimization algorithm:
1. **Batch Fetch:** Fetches up to 50 active conditions from the GraphQL API.
2. **Horizon Calculation:** Calculates the `Time Until Resolution` for each market.
3. **Strategic Sorting:** Prioritizes markets with the **longest horizon** (furthest `endTime`).
4. **Efficiency:** By focusing on the "oldest" markets first, Cognivern secures the highest possible weighting for its accuracy scores.

## 🧠 Resilient Intelligence Layer

Forecast reasoning must be high-quality and reliable. Cognivern implements a **Multi-LLM Fallback Architecture** to ensure 100% submission success.

| Tier | Provider | Model | Logic |
| :--- | :--- | :--- | :--- |
| **Primary** | **Routeway.ai** | Kimi K2 0905 | Best-in-class reasoning and long context. |
| **Fallback** | **Groq** | Llama 3.3 (70B) | Instant failover if Tier 1 times out or returns 5xx. |

## 🔗 Fail-Safe GraphQL Integration

To avoid dependencies on experimental SDK wrappers, Cognivern uses a **Direct Fetch** implementation for the Sapience GraphQL API. This ensures:
- Precise control over query fields (e.g., removing deprecated `startTime`).
- Custom header management for rate-limit resilience.
- Native error handling for 4xx/5xx responses.

### Active Condition Query:
```graphql
query GetConditions($nowSec: Int, $limit: Int) {
  conditions(
    where: { 
      public: { equals: true }
      endTime: { gt: $nowSec }
    }
    take: $limit
    orderBy: { endTime: asc }
  ) {
    id
    question
    shortName
    endTime
  }
}
```

## 🧠 Memory & Thoughts (Recall Integration)

Cognivern distinguishes itself by storing **why** it made a prediction. After every successful EAS submission on Arbitrum, the reasoning is mirrored to the **Recall Network**.

**Benefits:**
- **Immutable Logic:** Proof that the agent isn't guessing but using structured analysis.
- **Continuous Learning:** The agent can retrieve past reasoning to compare against settled outcomes.
- **Auditability:** Human governors can review the "Thoughts" feed in real-time.

## 🛠️ Integration Architecture

```
[Sapience GraphQL] <─ Fetch Optimal Market ─ [Cognivern Brain]
                                                    │
                                            [LLM Fallback Layer]
                                            (Routeway ─> Groq)
                                                    │
[Arbitrum EAS] <── Submit Forecast ─────────── Forecast Hash
                                                    │
[Recall Network] <─ Store Reasoning ────────── Memory ID
```

## 🚦 Testing the Integration

The production agent provides explicit logs for each step of the strategic loop:
```bash
# View real-time strategy execution
pm2 logs cognivern-agent
```

**Look for:**
- `[ForecastingService] Fetching optimal condition...`
- `[ForecastingService] Selected market: "Will [X] happen?"`
- `[ForecastingService] Trying provider: routeway`
- `[ForecastingService] Forecast submitted! Tx: 0x...`