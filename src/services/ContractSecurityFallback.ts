/**
 * Contract Security Fallback Service
 *
 * Provides contract security checks using multiple sources:
 * - Etherscan API (verification, source code, transactions)
 * - OpenZeppelin Defender (runtime monitoring, alerts)
 * - Bytecode analysis (pattern detection)
 * - Known safe contracts list
 */

import logger from "../utils/logger.js";
import { getEtherscanService, EtherscanAnalysis } from "./EtherscanService.js";
import { getDefenderService } from "./OpenZeppelinDefenderService.js";

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
  source: "etherscan" | "defender" | "heuristic" | "combined";
  auditedAt: string;
  etherscan?: EtherscanAnalysis;
  monitorAlerts?: Array<{
    severity: string;
    message: string;
  }>;
}

// Known safe contracts (major protocols)
const KNOWN_SAFE_CONTRACTS = new Map<string, { name: string; score: number }>([
  ["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", { name: "USDC", score: 95 }],
  ["0xdac17f958d2ee523a2206206994597c13d831ec7", { name: "USDT", score: 90 }],
  ["0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", { name: "WETH", score: 95 }],
  ["0x6b175474e89094c44da98b954eedeac495271d0f", { name: "DAI", score: 95 }],
  ["0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0", { name: "MATIC", score: 90 }],
  ["0x514910771af9ca656af840dff83e8264ecf986ca", { name: "LINK", score: 90 }],
  ["0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", { name: "UNI", score: 90 }],
  ["0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", { name: "AAVE", score: 92 }],
  ["0xc00e94cb662c3520282e6f5717214004a7f26888", { name: "COMP", score: 92 }],
  ["0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2", { name: "MKR", score: 92 }],
  ["0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", { name: "WBTC", score: 90 }],
  ["0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0", { name: "wstETH", score: 92 }],
]);

export class ContractSecurityFallback {
  private rpcUrl?: string;

  constructor(config?: { rpcUrl?: string }) {
    this.rpcUrl = config?.rpcUrl || process.env.ETHEREUM_RPC_URL;
  }

  /**
   * Perform comprehensive security check using all available sources
   */
  async analyzeContract(address: string): Promise<FallbackAuditResult> {
    const normalizedAddress = address.toLowerCase();
    const findings: FallbackAuditResult["findings"] = [];
    let score = 70; // Default moderate score
    let source: FallbackAuditResult["source"] = "heuristic";
    let etherscanAnalysis: EtherscanAnalysis | undefined;
    let monitorAlerts: Array<{ severity: string; message: string }> = [];

    // Check if it's a known safe contract
    const knownContract = KNOWN_SAFE_CONTRACTS.get(normalizedAddress);
    if (knownContract) {
      return {
        safe: true,
        score: knownContract.score,
        severity: "informational",
        findings: [{
          title: `Known Protocol: ${knownContract.name}`,
          description: `This is the ${knownContract.name} contract from a major protocol with extensive usage and audits.`,
          severity: "informational",
        }],
        summary: `Known safe contract (${knownContract.name})`,
        source: "heuristic",
        auditedAt: new Date().toISOString(),
      };
    }

    // Layer 1: Etherscan Analysis
    try {
      const etherscan = getEtherscanService();
      etherscanAnalysis = await etherscan.analyzeContract(address);
      const etherscanScore = etherscan.calculateSecurityScore(etherscanAnalysis);

      findings.push(...etherscanScore.findings);
      score = etherscanScore.score;
      source = "etherscan";
    } catch (error) {
      logger.warn("Etherscan analysis failed:", error);
    }

    // Layer 2: OpenZeppelin Defender Monitoring
    try {
      const defender = getDefenderService();
      if (defender.isConfigured()) {
        const monitorResult = await defender.monitorContract(address);

        if (monitorResult.alerts.length > 0) {
          monitorAlerts = monitorResult.alerts.map(a => ({
            severity: a.severity,
            message: `${a.type}: Alert at ${a.timestamp}`,
          }));

          // Adjust score based on alerts
          score -= monitorResult.riskScore * 0.3; // 30% weight for monitoring

          findings.push({
            title: "Monitoring Alerts",
            description: `${monitorResult.alerts.length} alert(s) found from runtime monitoring.`,
            severity: monitorResult.riskScore > 50 ? "high" : "medium",
          });

          source = "combined";
        }
      }
    } catch (error) {
      logger.warn("Defender monitoring check failed:", error);
    }

    // Layer 3: Bytecode Analysis (if RPC available)
    if (this.rpcUrl) {
      try {
        const bytecodeResult = await this.analyzeBytecode(address);
        findings.push(...bytecodeResult.findings);
        score += bytecodeResult.scoreAdjustment;
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
      summary: this.generateSummary(findings, score, source),
      source,
      auditedAt: new Date().toISOString(),
      etherscan: etherscanAnalysis,
      monitorAlerts,
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
          description: "This is an externally owned account (EOA), not a smart contract.",
          severity: "informational",
        });
        scoreAdjustment = 20;
        return { findings, scoreAdjustment };
      }

      // Check for SELFDESTRUCT
      if (bytecode.includes("ff")) {
        findings.push({
          title: "Self-Destruct Capability",
          description: "Contract contains SELFDESTRUCT opcode. Funds may be permanently lost if triggered.",
          severity: "high",
        });
        scoreAdjustment -= 25;
      }

      // Check contract size
      const codeSize = (bytecode.length - 2) / 2;
      if (codeSize < 100) {
        findings.push({
          title: "Minimal Contract",
          description: `Very small contract (${codeSize} bytes). Likely simple functionality.`,
          severity: "informational",
        });
        scoreAdjustment += 5;
      } else if (codeSize > 24000) {
        findings.push({
          title: "Large Contract",
          description: `Large contract (${codeSize} bytes). Increased complexity may mean more attack surface.`,
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
   * Generate human-readable summary
   */
  private generateSummary(
    findings: FallbackAuditResult["findings"],
    score: number,
    source: FallbackAuditResult["source"]
  ): string {
    const criticalCount = findings.filter(f => f.severity === "critical").length;
    const highCount = findings.filter(f => f.severity === "high").length;
    const mediumCount = findings.filter(f => f.severity === "medium").length;

    const sourceLabel = {
      etherscan: "Etherscan",
      defender: "OpenZeppelin Defender",
      combined: "Etherscan + Defender",
      heuristic: "Heuristic",
    }[source];

    if (criticalCount > 0) {
      return `${sourceLabel}: CRITICAL - ${criticalCount} critical issue(s) found. Do not interact.`;
    }
    if (highCount > 0) {
      return `${sourceLabel}: HIGH RISK - ${highCount} high severity issue(s). Proceed with extreme caution.`;
    }
    if (mediumCount > 0) {
      return `${sourceLabel}: MEDIUM RISK - ${mediumCount} medium severity item(s). Review before proceeding.`;
    }
    if (score >= 80) {
      return `${sourceLabel}: Good security profile. Score: ${score}/100.`;
    }
    return `${sourceLabel}: Analysis complete. Score: ${score}/100. ${findings.length} finding(s).`;
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
