/**
 * ChainGPT Audit Service
 *
 * Uses ChainGPT's Smart Contract Auditor API for runtime pre-spend security checks.
 * When an agent's spend targets a contract address, this service calls the auditor
 * and denies/holds the spend if Critical/High vulnerabilities are found.
 *
 * This is the first product to use ChainGPT's auditor for runtime defense, not just CI.
 */

import logger from "../utils/logger.js";

export interface AuditResult {
  safe: boolean;
  score: number; // 0-100, higher is safer
  severity: "critical" | "high" | "medium" | "low" | "informational";
  findings: AuditFinding[];
  summary: string;
  auditedAt: string;
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

    // Call ChainGPT Auditor API
    const audit = await this.callAuditor(contractAddress, options);

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
      // Build the audit prompt
      let auditPrompt = `Audit the following smart contract for security vulnerabilities:
Contract Address: ${contractAddress}
Blockchain: Ethereum

Please analyze for:
- Reentrancy vulnerabilities
- Flash loan attack vectors
- Price oracle manipulation
- Access control issues
- Unchecked external calls
- Integer overflow/underflow
- Gas optimization issues

Provide a security score (0-100), list findings with severity (critical/high/medium/low/informational), and a summary.`;

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
   */
  private parseAuditText(text: string, contractAddress: string): AuditResult {
    // Extract score from response (look for patterns like "Score: 85" or "85/100")
    const scoreMatch = text.match(/(?:score|rating|security score)[:\s]*(\d+)(?:\/100)?/i);
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : this.estimateScore(text);

    // Extract findings with severity
    const findings: AuditFinding[] = [];
    const severityPattern = /(?:critical|high|medium|low|informational)/gi;
    const severityMatches = text.match(severityPattern) || [];

    // Look for bullet points or numbered findings
    const findingPattern = /(?:[-•*]|\d+\.)\s*([^\n]+?)(?:\s*\(?(critical|high|medium|low|informational)\)?)?/gi;
    let match;
    while ((match = findingPattern.exec(text)) !== null) {
      const title = match[1].trim();
      const severity = (match[2]?.toLowerCase() || "informational") as AuditFinding["severity"];

      if (title.length > 10 && title.length < 200) {
        findings.push({
          title,
          description: "",
          severity,
        });
      }
    }

    // If no findings extracted, create a summary finding
    if (findings.length === 0) {
      const hasIssues = /vulnerability|issue|warning|risk|exploit/i.test(text);
      if (hasIssues) {
        findings.push({
          title: "Potential issues detected",
          description: text.substring(0, 500),
          severity: score < 70 ? "medium" : "low",
        });
      }
    }

    const hasCritical = findings.some(f => f.severity === "critical");
    const hasHigh = findings.some(f => f.severity === "high");

    return {
      safe: score >= 70 && !hasCritical && !hasHigh,
      score,
      severity: hasCritical ? "critical" : hasHigh ? "high" : score < 50 ? "medium" : "low",
      findings,
      summary: text.substring(0, 300),
      auditedAt: new Date().toISOString(),
    };
  }

  /**
   * Estimate score from text content
   */
  private estimateScore(text: string): number {
    const lowerText = text.toLowerCase();

    if (/critical|severe|major vulnerability|high risk/i.test(text)) return 30;
    if (/high.*risk|significant|serious/i.test(text)) return 45;
    if (/medium.*risk|moderate|warning/i.test(text)) return 60;
    if (/low.*risk|minor|informational|no.*issues|secure|safe|well.*written/i.test(text)) return 85;

    return 70; // Default moderate score
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
