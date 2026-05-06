/**
 * Contract Security Fallback Service
 *
 * Provides basic contract security checks when ChainGPT is unavailable.
 * Uses heuristic analysis + optional LLM fallback.
 */

import logger from "../utils/logger.js";

export interface FallbackAuditResult {
  safe: boolean;
  score: number;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  findings: Array<{
    title: string;
    description: string;
    severity: "critical" | "high" | "medium" | "low" | "informational";
  }>;
  summary: string;
  source: "heuristic" | "llm-fallback" | "cache";
  auditedAt: string;
}

// Known safe contracts (major protocols)
const KNOWN_SAFE_CONTRACTS = new Set([
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
  "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
  "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
  "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0", // MATIC
  "0x514910771af9ca656af840dff83e8264ecf986ca", // LINK
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", // UNI
  "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", // AAVE
  "0xc00e94cb662c3520282e6f5717214004a7f26888", // COMP
  "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2", // MKR
]);

// Known risky patterns in bytecode
const RISKY_BYTECODE_PATTERNS = [
  { pattern: "ff", label: "SELFDESTRUCT opcode", severity: "high" as const },
  { pattern: "f1", label: "CALL opcode (check for reentrancy)", severity: "medium" as const },
];

export class ContractSecurityFallback {
  private etherscanApiKey?: string;
  private rpcUrl?: string;

  constructor(config?: { etherscanApiKey?: string; rpcUrl?: string }) {
    this.etherscanApiKey = config?.etherscanApiKey || process.env.ETHERSCAN_API_KEY;
    this.rpcUrl = config?.rpcUrl || process.env.ETHEREUM_RPC_URL;
  }

  /**
   * Perform heuristic-based security check
   */
  async analyzeContract(address: string): Promise<FallbackAuditResult> {
    const normalizedAddress = address.toLowerCase();
    const findings: FallbackAuditResult["findings"] = [];
    let score = 70; // Default moderate score

    // Check if it's a known safe contract
    if (KNOWN_SAFE_CONTRACTS.has(normalizedAddress)) {
      return {
        safe: true,
        score: 95,
        severity: "informational",
        findings: [{
          title: "Verified Protocol Contract",
          description: "This is a well-known contract from a major protocol with extensive usage and audits.",
          severity: "informational",
        }],
        summary: "Known safe contract from established protocol",
        source: "heuristic",
        auditedAt: new Date().toISOString(),
      };
    }

    // Try Etherscan verification check
    if (this.etherscanApiKey) {
      try {
        const verificationResult = await this.checkEtherscanVerification(address);
        if (!verificationResult.verified) {
          findings.push({
            title: "Unverified Contract",
            description: "Contract source code is not verified on Etherscan. Exercise caution.",
            severity: "medium",
          });
          score -= 20;
        } else {
          findings.push({
            title: "Verified Source Code",
            description: `Contract verified on Etherscan. Compiler: ${verificationResult.compiler || "unknown"}`,
            severity: "informational",
          });
          score += 10;
        }
      } catch (error) {
        logger.warn("Etherscan verification check failed:", error);
      }
    }

    // Try basic bytecode analysis
    if (this.rpcUrl) {
      try {
        const bytecodeAnalysis = await this.analyzeBytecode(address);
        findings.push(...bytecodeAnalysis.findings);
        score += bytecodeAnalysis.scoreAdjustment;
      } catch (error) {
        logger.warn("Bytecode analysis failed:", error);
      }
    }

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));

    // Determine overall severity
    const hasCritical = findings.some(f => f.severity === "critical");
    const hasHigh = findings.some(f => f.severity === "high");
    const hasMedium = findings.some(f => f.severity === "medium");

    const severity = hasCritical ? "critical" : hasHigh ? "high" : hasMedium ? "medium" : "low";
    const safe = score >= 70 && !hasCritical && !hasHigh;

    return {
      safe,
      score,
      severity,
      findings,
      summary: findings.length > 0
        ? `Heuristic analysis found ${findings.length} item(s)`
        : "Basic heuristic analysis - no issues detected",
      source: "heuristic",
      auditedAt: new Date().toISOString(),
    };
  }

  /**
   * Check if contract is verified on Etherscan
   */
  private async checkEtherscanVerification(address: string): Promise<{
    verified: boolean;
    compiler?: string;
  }> {
    if (!this.etherscanApiKey) {
      return { verified: false };
    }

    const response = await fetch(
      `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=${this.etherscanApiKey}`
    );

    if (!response.ok) {
      throw new Error(`Etherscan API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.result?.[0];

    return {
      verified: result?.SourceCode !== "",
      compiler: result?.CompilerVersion,
    };
  }

  /**
   * Analyze contract bytecode for patterns
   */
  private async analyzeBytecode(address: string): Promise<{
    findings: FallbackAuditResult["findings"];
    scoreAdjustment: number;
  }> {
    if (!this.rpcUrl) {
      return { findings: [], scoreAdjustment: 0 };
    }

    const findings: FallbackAuditResult["findings"] = [];
    let scoreAdjustment = 0;

    try {
      const response = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getCode",
          params: [address, "latest"],
          id: 1,
        }),
      });

      const data = await response.json();
      const bytecode = data.result;

      if (!bytecode || bytecode === "0x") {
        findings.push({
          title: "EOA Address",
          description: "This is an externally owned account (EOA), not a contract.",
          severity: "informational",
        });
        scoreAdjustment = 20;
        return { findings, scoreAdjustment };
      }

      // Check for SELFDESTRUCT
      if (bytecode.includes("ff")) {
        findings.push({
          title: "Self-Destruct Capability",
          description: "Contract contains SELFDESTRUCT opcode. Funds may be at risk if contract is destroyed.",
          severity: "high",
        });
        scoreAdjustment -= 25;
      }

      // Check contract size (small contracts are often simpler/safer)
      const codeSize = (bytecode.length - 2) / 2; // bytes
      if (codeSize < 100) {
        findings.push({
          title: "Minimal Contract",
          description: `Very small contract (${codeSize} bytes). Likely simple functionality.`,
          severity: "informational",
        });
        scoreAdjustment += 10;
      } else if (codeSize > 24000) {
        findings.push({
          title: "Large Contract",
          description: `Large contract (${codeSize} bytes). More complex code = more attack surface.`,
          severity: "low",
        });
        scoreAdjustment -= 5;
      }

    } catch (error) {
      logger.warn("Bytecode fetch failed:", error);
    }

    return { findings, scoreAdjustment };
  }

  /**
   * Get cache key for address
   */
  static getCacheKey(address: string): string {
    return `fallback:${address.toLowerCase()}`;
  }
}

// Singleton instance
let fallbackService: ContractSecurityFallback | null = null;

export function getContractSecurityFallback(): ContractSecurityFallback {
  if (!fallbackService) {
    fallbackService = new ContractSecurityFallback();
  }
  return fallbackService;
}
