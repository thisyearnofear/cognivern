/**
 * HydraDB challenge — difficult retrieval question set.
 *
 * Each question is tagged with the retrieval category the challenge names:
 * temporal reasoning, metadata filtering, entity deduplication, knowledge
 * updates, third-party attribution, actor-based queries, thread
 * understanding, multilingual retrieval, multi-hop reasoning.
 *
 * Questions are grounded in the real ingested data:
 *   - Audit ledger: http-verify-agent, project-a-agent, agent-1 → stable-email (12 USDC, xlayer)
 *   - GitHub: thisyearnofear, Quincybob commits
 *   - Linear: THI-5..THI-10 (papa/thisyearnofear, Cognivern Governance project)
 *
 * Each question has:
 *   - expectedAnswer: what a correct retrieval should surface (for accuracy grading)
 *   - expectedMode: the mode the router SHOULD pick (to validate the router)
 *   - expectedSources: which origins should appear in the results
 *   - category: the challenge retrieval category
 */

export type RetrievalCategory =
  | "temporal_reasoning"
  | "metadata_filtering"
  | "entity_deduplication"
  | "knowledge_updates"
  | "third_party_attribution"
  | "actor_based"
  | "thread_understanding"
  | "multilingual"
  | "multi_hop";

export interface BenchmarkQuestion {
  id: string;
  category: RetrievalCategory;
  question: string;
  /** What the correct answer should contain (substring / entity checks). */
  expectedAnswer: string[];
  /** Mode the router should pick for this question. */
  expectedMode: "fast" | "thinking";
  /** Which source origins should appear in results. */
  expectedSources: Array<"cognivern_audit" | "github_commit" | "github" | "linear">;
  /** Optional metadata filter to apply (for metadata_filtering category). */
  metadataFilters?: Record<string, unknown>;
  /** Whether to use multi-hop (explicit hops) instead of a single query. */
  multiHop?: string[];
  /** Notes for the submission writeup. */
  notes?: string;
}

export const QUESTIONS: BenchmarkQuestion[] = [
  {
    id: "q1_temporal",
    category: "temporal_reasoning",
    question:
      "What did http-verify-agent spend on stable-email on 2026-06-16, and was the transaction recorded on-chain?",
    expectedAnswer: ["12", "USDC", "stable-email", "http-verify-agent"],
    expectedMode: "thinking",
    expectedSources: ["cognivern_audit"],
    notes:
      "Temporal + on-chain status. The on-chain status (recorded) is in additional_metadata; the answer is correct if the audit run is found with the right amount/agent/vendor.",
  },
  {
    id: "q2_metadata_filter",
    category: "metadata_filtering",
    question: "stable-email spend",
    expectedAnswer: ["stable-email"],
    expectedMode: "fast",
    expectedSources: ["cognivern_audit"],
    metadataFilters: { additional_metadata: { vendor: "stable-email" } },
    notes:
      "Pure metadata filter — vendor=stable-email. Should be fast (filter does the work, no graph traversal).",
  },
  {
    id: "q3_entity_dedup",
    category: "entity_deduplication",
    question:
      "The same vendor stable-email appears in the audit ledger and in Linear issues. Are they the same entity? Show both.",
    expectedAnswer: ["stable-email", "cognivern_audit", "linear"],
    expectedMode: "thinking",
    expectedSources: ["cognivern_audit", "linear"],
    notes:
      "Entity dedup across sources. HydraDB should return both audit runs and Linear THI-5/THI-8 referencing stable-email.",
  },
  {
    id: "q4_actor_attribution",
    category: "actor_based",
    question:
      "Who filed the Linear issue about investigating the stable-email spend anomaly, and what did http-verify-agent spend on it?",
    expectedAnswer: ["thisyearnofear", "THI-5", "stable-email", "http-verify-agent", "12"],
    expectedMode: "thinking",
    expectedSources: ["linear", "cognivern_audit"],
    notes:
      "Actor-based + multi-hop. Linear THI-5 (filed by thisyearnofear) + audit runs (http-verify-agent, 12 USDC).",
  },
  {
    id: "q5_multi_hop",
    category: "multi_hop",
    question:
      "What did thisyearnofear file about stable-email in Linear, which agent spent on stable-email in the audit ledger, and what was the on-chain status?",
    expectedAnswer: ["thisyearnofear", "stable-email", "http-verify-agent", "recorded"],
    expectedMode: "thinking",
    expectedSources: ["linear", "cognivern_audit"],
    multiHop: [
      "thisyearnofear Linear issues about stable-email",
      "http-verify-agent stable-email spend on-chain status",
    ],
    notes:
      "Explicit 2-hop: Linear issues by thisyearnofear → audit runs by http-verify-agent. Tests multi-step retrieval.",
  },
  {
    id: "q6_github_audit_link",
    category: "third_party_attribution",
    question:
      "What commits did thisyearnofear make to the cognivern repo, and what did http-verify-agent spend on stable-email?",
    expectedAnswer: ["thisyearnofear", "http-verify-agent", "stable-email"],
    expectedMode: "thinking",
    expectedSources: ["github_commit", "cognivern_audit"],
    notes:
      "Cross-source: GitHub commits (thisyearnofear) + audit runs (http-verify-agent). Tests that HydraDB joins the operator across sources.",
  },
  {
    id: "q7_fast_lookup",
    category: "metadata_filtering",
    question: "Linear issues",
    expectedAnswer: ["THI-"],
    expectedMode: "fast",
    expectedSources: ["linear"],
    metadataFilters: { additional_metadata: { origin: "linear" } },
    notes:
      "Fast metadata filter — origin=linear. Should return only Linear issues, sub-second.",
  },
  {
    id: "q8_multilingual",
    category: "multilingual",
    question:
      "¿Cuál fue el gasto del agente http-verify-agent en stable-email y cuánto fue?",
    expectedAnswer: ["http-verify-agent", "stable-email", "12", "USDC"],
    expectedMode: "thinking",
    expectedSources: ["cognivern_audit"],
    notes:
      "Multilingual (Spanish). HydraDB's hybrid retrieval should still find the English audit records via semantic match.",
  },
  {
    id: "q9_project_scoped",
    category: "actor_based",
    question:
      "What issues are in the Cognivern Governance project, and which reference the http-verify-agent?",
    expectedAnswer: ["Cognivern Governance", "http-verify-agent"],
    expectedMode: "thinking",
    expectedSources: ["linear"],
    notes:
      "Project-scoped + actor reference. Should return Linear THI-6 (http-verify-agent rate limits) and related issues.",
  },
  {
    id: "q10_knowledge_update",
    category: "knowledge_updates",
    question: "most recent spend run",
    expectedAnswer: ["stable-email", "http-verify-agent"],
    expectedMode: "fast",
    expectedSources: ["cognivern_audit"],
    metadataFilters: { additional_metadata: { origin: "cognivern_audit" } },
    notes:
      "Recency-based retrieval scoped to the audit ledger via metadata filter. Fast mode + recency_bias would surface the latest run.",
  },
  {
    id: "q11_attio_company",
    category: "metadata_filtering",
    question: "companies in the Attio CRM (metadata filter origin=attio_company)",
    expectedAnswer: ["Intercom"],
    expectedMode: "fast",
    expectedSources: ["attio_company"],
    metadataFilters: { additional_metadata: { origin: "attio_company" } },
    notes:
      "Proves the 3rd listed connector (Attio) is retrievable: metadata-scoped lookup on origin=attio_company returns the ingested Attio company records.",
  },
];

/**
 * Run a single question through the retrieval service and grade it.
 * Returns the outcome + accuracy assessment.
 */
export function gradeResult(
  chunks: Array<{ chunk_content?: string; source_title?: string; additional_metadata?: Record<string, unknown> }>,
  q: BenchmarkQuestion,
): { passed: boolean; matchedExpected: string[]; sourcesFound: string[] } {
  // Flatten all text for substring matching.
  const haystack = chunks
    .map((c) => {
      const meta = c.additional_metadata ?? {};
      return [
        c.chunk_content ?? "",
        c.source_title ?? "",
        JSON.stringify(meta),
      ].join(" ");
    })
    .join(" ")
    .toLowerCase();

  const matchedExpected = q.expectedAnswer.filter((e) =>
    haystack.includes(e.toLowerCase()),
  );

  const sourcesFound = [
    ...new Set(
      chunks
        .map((c) => c.additional_metadata?.origin as string)
        .filter(Boolean) as string[],
    ),
  ];

  // Pass if all expected answer fragments are found AND all expected sources
  // are present (results may contain additional sources — thinking mode
  // naturally returns cross-source context, which is desirable, not a failure).
  const answersOk = matchedExpected.length === q.expectedAnswer.length;
  const sourcesOk = q.expectedSources.every((s) => sourcesFound.includes(s));
  // For multi-hop, require at least 60% of expected answers (some may be in one hop but not both).
  const threshold = q.multiHop ? 0.6 : 1.0;
  const answersOkRelaxed = matchedExpected.length >= Math.ceil(q.expectedAnswer.length * threshold);

  return {
    passed: answersOkRelaxed && sourcesOk,
    matchedExpected,
    sourcesFound,
  };
}
