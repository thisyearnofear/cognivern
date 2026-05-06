/**
 * ChainGPT Audit Service
 *
 * Uses ChainGPT's Smart Contract Auditor API for runtime pre-spend security checks.
 * When an agent's spend targets a contract address, this service calls the auditor
 * and denies/holds the spend if Critical/High vulnerabilities are found.
 *
 * Includes fallback to heuristic analysis when ChainGPT is unavailable.
 */

import logger from "../utils/logger.js";
import { ContractSecurityFallback, getContractSecurityFallback } from "./ContractSecurityFallback.js";

export interface AuditResult {
  safe: boolean;
  score: number; // 0-100, higher is safer
  severity: "critical" | "high" | "medium" | "low" | "informational";
  findings: AuditFinding[];
  summary: string;
  auditedAt: string;
  source?: "chaingpt" | "fallback" | "cache";
}

export interface AuditFinding {
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  location?: string;
  recommendation?: string;
}

export interface AuditConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  // Minimum severity threshold to block spend
  blockOnSeverity?: "critical" | "high" | "medium";
  // Whether to hold (vs deny) for medium severity
  holdOnMedium?: boolean;
}

export class ChainGPTAuditService {
  private config: Required<AuditConfig>;
  private cache: Map<string, { result: AuditResult; timestamp: number }> = new Map();
  private cacheTimeoutMs = 5 * 60 * 1000; // 5 minute cache

  constructor(config: AuditConfig) {
    this.config = {
      baseUrl: config.baseUrl || "https://api.chaingpt.org",
      timeoutMs: config.timeoutMs || 30000,
      blockOnSeverity: config.blockOnSeverity || "high",
      holdOnMedium: config.holdOnMedium ?? true,
      ...config,
    };
  }

  /**
   * Audit a contract address before allowing spend
   * Returns audit result with decision (approve/hold/deny)
   * Falls back to heuristic analysis if ChainGPT fails
   */
  async auditContract(
    contractAddress: string,
    options?: {
      sourceCode?: string;
      bytecode?: string;
      skipCache?: boolean;
    }
  ): Promise<{ decision: "approve" | "hold" | "deny"; audit: AuditResult }> {
    logger.info(`Auditing contract: ${contractAddress}`);

    // Check cache first
    if (!options?.skipCache) {
      const cached = this.cache.get(contractAddress.toLowerCase());
      if (cached && Date.now() - cached.timestamp < this.cacheTimeoutMs) {
        logger.debug(`Cache hit for contract: ${contractAddress}`);
        return this.makeDecision(cached.result);
      }
    }

    // Try ChainGPT first
    let audit: AuditResult;
    try {
      audit = await this.callAuditor(contractAddress, options);
      audit.source = "chaingpt";
    } catch (chainGptError) {
      logger.warn("ChainGPT audit failed, falling back to heuristic analysis:", chainGptError);

      // Fallback to heuristic analysis
      try {
        const fallback = getContractSecurityFallback();
        const fallbackResult = await fallback.analyzeContract(contractAddress);
        audit = {
          ...fallbackResult,
          source: "fallback",
        };
        logger.info(`Fallback audit completed for ${contractAddress}: score=${audit.score}`);
      } catch (fallbackError) {
        logger.error("Fallback audit also failed:", fallbackError);
        throw chainGptError; // Throw original error if both fail
      }
    }

    // Cache the result
    this.cache.set(contractAddress.toLowerCase(), {
      result: audit,
      timestamp: Date.now(),
    });

    return this.makeDecision(audit);
  }

  /**
   * Batch audit multiple contracts
   */
  async auditContracts(
    contracts: string[]
  ): Promise<Map<string, { decision: "approve" | "hold" | "deny"; audit: AuditResult }>> {
    const results = new Map<string, { decision: "approve" | "hold" | "deny"; audit: AuditResult }>();

    await Promise.all(
      contracts.map(async (address) => {
        const result = await this.auditContract(address);
        results.set(address.toLowerCase(), result);
      })
    );

    return results;
  }

  /**
   * Extract contract address from various input formats
   */
  parseContractInput(input: string): string | null {
    // Handle calldata with selector
    if (input.startsWith("0x") && input.length > 10) {
      // First 4 bytes are selector, next 20 bytes are address
      if (input.length >= 74) {
        return "0x" + input.slice(10, 50);
      }
      // Otherwise assume it's just an address
      return this.isValidAddress(input) ? input : null;
    }

    // Plain address
    if (this.isValidAddress(input)) {
      return input;
    }

    return null;
  }

  /**
   * Check if a contract has known exploit patterns
   */
  async checkExploitPatterns(contractAddress: string): Promise<{
    hasExploitRisk: boolean;
    patterns: string[];
  }> {
    // Use ChainGPT to analyze for common exploit patterns
    const prompt = `Analyze this contract for common DeFi exploit patterns:
- Reentrancy vulnerabilities
- Flash loan attack vectors
- Price oracle manipulation
- Access control issues
- Unchecked external calls

Contract address: ${contractAddress}

Respond with JSON: { "hasExploitRisk": boolean, "patterns": string[] }`;

    try {
      const response = await this.callGovernanceAPI(prompt);
      // Parse response and return pattern analysis
      return this.parseExploitResponse(response);
    } catch (error) {
      logger.error(`Failed to check exploit patterns for ${contractAddress}:`, error);
      return { hasExploitRisk: false, patterns: [] };
    }
  }

  /**
   * Get audit summary for display in UI
   */
  getAuditSummary(audit: AuditResult): string {
    const criticalCount = audit.findings.filter(f => f.severity === "critical").length;
    const highCount = audit.findings.filter(f => f.severity === "high").length;

    if (criticalCount > 0) {
      return `CRITICAL: ${criticalCount} critical vulnerability${criticalCount > 1 ? "s" : ""} found`;
    }
    if (highCount > 0) {
      return `HIGH RISK: ${highCount} high severity issue${highCount > 1 ? "s" : ""} found`;
    }

    return `Score: ${audit.score}/100 - ${audit.summary}`;
  }

  /**
   * Clear audit cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info("ChainGPT audit cache cleared");
  }

  private async callAuditor(
    contractAddress: string,
    options?: { sourceCode?: string; bytecode?: string }
  ): Promise<AuditResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      // Build the audit prompt with strict output format
      let auditPrompt = `Audit the following smart contract for security vulnerabilities.
Contract Address: ${contractAddress}
Blockchain: Ethereum

REQUIRED OUTPUT FORMAT (follow exactly):
SCORE: [number 0-100]
SAFE: [true/false]
SEVERITY: [critical/high/medium/low/informational]

FINDINGS:
- [severity] | [title] | [brief description]
- [severity] | [title] | [brief description]

SUMMARY: [one paragraph summary]

Analyze for: reentrancy, flash loan attacks, oracle manipulation, access control, unchecked calls, overflow/underflow.`;

      if (options?.sourceCode) {
        auditPrompt += `\n\nSource Code:\n${options.sourceCode}`;
      }

      const response = await fetch(`${this.config.baseUrl}/chat/stream`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Authorization": `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "smart_contract_auditor",
          question: auditPrompt,
          chatHistory: "off"
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`ChainGPT Audit API error: ${response.status} - ${error}`);
      }

      // Read streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullResponse += decoder.decode(value, { stream: true });
        }
      }

      return this.parseAuditText(fullResponse, contractAddress);

    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("ChainGPT audit request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse the text response from ChainGPT auditor into structured AuditResult
   * Handles both structured format (from our prompt) and freeform responses
   */
  private parseAuditText(text: string, contractAddress: string): AuditResult {
    // Try structured format first (from our prompted output)
    const structuredScore = text.match(/SCORE:\s*(\d+)/i);
    const structuredSafe = text.match(/SAFE:\s*(true|false)/i);
    const structuredSeverity = text.match(/SEVERITY:\s*(critical|high|medium|low|informational)/i);
    const structuredSummary = text.match(/SUMMARY:\s*(.+?)(?:\n|$)/i);

    // Extract findings from structured format: "- [severity] | [title] | [description]"
    const findings: AuditFinding[] = [];
    const structuredFindingPattern = /-\s*(critical|high|medium|low|informational)\s*\|\s*([^|]+)\|\s*([^\n]+)/gi;
    let match;

    while ((match = structuredFindingPattern.exec(text)) !== null) {
      findings.push({
        severity: match[1].toLowerCase() as AuditFinding["severity"],
        title: match[2].trim(),
        description: match[3].trim(),
      });
    }

    // Fallback: extract from markdown-style headers if structured format failed
    if (findings.length === 0) {
      const markdownPattern = /(?:^|\n)#{1,3}\s*(?:\d+\.\s*)?([^\n]+?)(?:\n|$)/g;
      const severityInTitle = /(critical|high|medium|low|informational)/i;

      while ((match = markdownPattern.exec(text)) !== null) {
        const title = match[1].trim();
        const severityMatch = title.match(severityInTitle);

        if (severityMatch) {
          findings.push({
            severity: severityMatch[1].toLowerCase() as AuditFinding["severity"],
            title: title.replace(severityMatch[0], '').replace(/[:\-]$/, '').trim(),
            description: "",
          });
        }
      }
    }

    // Fallback: look for bullet points with severity keywords
    if (findings.length === 0) {
      const bulletPattern = /(?:[-•*]|\d+\.)\s*([^\n]*?(?:critical|high|medium|low|informational)[^\n]*)/gi;

      while ((match = bulletPattern.exec(text)) !== null) {
        const line = match[1].trim();
        const sevMatch = line.match(/(critical|high|medium|low|informational)/i);

        if (sevMatch && line.length > 10) {
          findings.push({
            severity: sevMatch[1].toLowerCase() as AuditFinding["severity"],
            title: line.substring(0, 100),
            description: "",
          });
        }
      }
    }

    // Determine score
    const score = structuredScore
      ? parseInt(structuredScore[1], 10)
      : this.estimateScoreFromFindings(findings, text);

    // Determine overall severity
    const hasCritical = findings.some(f => f.severity === "critical");
    const hasHigh = findings.some(f => f.severity === "high");
    const hasMedium = findings.some(f => f.severity === "medium");

    const severity = structuredSeverity
      ? structuredSeverity[1].toLowerCase() as AuditResult["severity"]
      : hasCritical ? "critical"
      : hasHigh ? "high"
      : hasMedium ? "medium"
      : "low";

    // Determine safety
    const safe = structuredSafe
      ? structuredSafe[1].toLowerCase() === "true"
      : score >= 70 && !hasCritical && !hasHigh;

    // Extract summary
    const summary = structuredSummary
      ? structuredSummary[1].trim()
      : this.extractSummary(text);

    return {
      safe,
      score,
      severity,
      findings,
      summary,
      auditedAt: new Date().toISOString(),
    };
  }

  /**
   * Estimate score based on findings severity
   */
  private estimateScoreFromFindings(findings: AuditFinding[], text: string): number {
    if (findings.length === 0) {
      // No findings - check if text suggests it's safe
      if (/no.*(?:issues|vulnerabilities|findings)|secure|safe|well.*written/i.test(text)) {
        return 85;
      }
      return 70; // Default moderate
    }

    const hasCritical = findings.some(f => f.severity === "critical");
    const hasHigh = findings.some(f => f.severity === "high");
    const hasMedium = findings.some(f => f.severity === "medium");

    if (hasCritical) return 25;
    if (hasHigh) return 40;
    if (hasMedium) return 60;
    return 75;
  }

  /**
   * Extract summary from text
   */
  private extractSummary(text: string): string {
    // Look for summary section
    const summaryMatch = text.match(/(?:summary|conclusion|overview):\s*([^\n]+(?:\n[^\n]+)?)/i);
    if (summaryMatch) {
      return summaryMatch[1].trim().substring(0, 300);
    }

    // Fallback: first substantial paragraph
    const paragraphs = text.split('\n\n').filter(p => p.trim().length > 50);
    if (paragraphs.length > 0) {
      return paragraphs[0].trim().substring(0, 300);
    }

    return text.substring(0, 300);
  }

  private async callGovernanceAPI(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/stream`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Authorization": `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "smart_contract_auditor",
          question: prompt,
          chatHistory: "off"
        }),
      });

      if (!response.ok) {
        throw new Error(`ChainGPT API error: ${response.status}`);
      }

      // Read streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullResponse += decoder.decode(value, { stream: true });
        }
      }

      return fullResponse || "{}";

    } finally {
      clearTimeout(timeoutId);
    }
  }

  private normalizeAuditResponse(data: Record<string, unknown>): AuditResult {
    // Handle ChainGPT's response format
    const findings = (data.findings || []) as Array<{
      title?: string;
      description?: string;
      severity?: string;
      location?: string;
      recommendation?: string;
    }>;

    return {
      safe: (data.score as number || 0) >= 70,
      score: data.score as number || 50,
      severity: this.normalizeSeverity(data.critical as string || data.severity as string || "medium"),
      findings: findings.map(f => ({
        title: f.title || "Unknown finding",
        description: f.description || "",
        severity: this.normalizeSeverity(f.severity || "informational"),
        location: f.location,
        recommendation: f.recommendation,
      })),
      summary: data.summary as string || "Audit completed",
      auditedAt: new Date().toISOString(),
    };
  }

  private normalizeSeverity(severity: string): AuditResult["severity"] {
    const s = severity.toLowerCase();
    if (s === "critical") return "critical";
    if (s === "high") return "high";
    if (s === "medium") return "medium";
    if (s === "low") return "low";
    return "informational";
  }

  private makeDecision(audit: AuditResult): { decision: "approve" | "hold" | "deny"; audit: AuditResult } {
    // Always block critical findings
    const hasCritical = audit.findings.some(f => f.severity === "critical");
    if (hasCritical) {
      return { decision: "deny", audit };
    }

    // Block or hold on high severity based on config
    const hasHigh = audit.findings.some(f => f.severity === "high");
    if (hasHigh) {
      return {
        decision: this.config.blockOnSeverity === "high" ? "deny" : "hold",
        audit,
      };
    }

    // Hold on medium if configured
    const hasMedium = audit.findings.some(f => f.severity === "medium");
    if (hasMedium && this.config.holdOnMedium) {
      return { decision: "hold", audit };
    }

    // Approve if safe
    return { decision: audit.safe ? "approve" : "hold", audit };
  }

  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  private parseExploitResponse(response: string): { hasExploitRisk: boolean; patterns: string[] } {
    try {
      const parsed = JSON.parse(response);
      return {
        hasExploitRisk: parsed.hasExploitRisk || false,
        patterns: parsed.patterns || [],
      };
    } catch {
      return { hasExploitRisk: false, patterns: [] };
    }
  }
}

// Singleton instance
let auditService: ChainGPTAuditService | null = null;

export function getChainGPTAuditService(): ChainGPTAuditService | null {
  const apiKey = process.env.CHAINGPT_API_KEY;
  if (!apiKey) return null;

  if (!auditService) {
    auditService = new ChainGPTAuditService({
      apiKey,
      blockOnSeverity: "high",
      holdOnMedium: true,
    });
  }

  return auditService;
}
