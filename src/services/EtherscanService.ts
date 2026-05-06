/**
 * Etherscan API Service
 *
 * Comprehensive contract analysis using Etherscan's API endpoints.
 * Provides verification status, source code, ABI, transactions, and more.
 */

import logger from "../utils/logger.js";

export interface EtherscanContractInfo {
  address: string;
  verified: boolean;
  contractName?: string;
  compiler?: string;
  optimizationUsed?: boolean;
  runs?: number;
  sourceCode?: string;
  abi?: string;
  implementation?: string; // Proxy target if applicable
  isProxy?: boolean;
}

export interface EtherscanTransactionInfo {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
}

export interface EtherscanAnalysis {
  contract: EtherscanContractInfo;
  firstSeen?: EtherscanTransactionInfo;
  recentActivity: EtherscanTransactionInfo[];
  tokenTransfers: Array<{
    hash: string;
    from: string;
    to: string;
    value: string;
    tokenName: string;
    tokenSymbol: string;
  }>;
  securitySignals: {
    hasHighValueTransfers: boolean;
    recentActivityCount: number;
    ageInDays: number | null;
    isVerified: boolean;
    hasProxy: boolean;
    hasSourceCode: boolean;
  };
}

export class EtherscanService {
  private apiKey: string;
  private baseUrl: string;

  constructor(config?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = config?.apiKey || process.env.ETHERSCAN_API_KEY || "";
    this.baseUrl = config?.baseUrl || "https://api.etherscan.io/api";
  }

  /**
   * Get comprehensive contract analysis
   */
  async analyzeContract(address: string): Promise<EtherscanAnalysis> {
    const [contractInfo, firstTx, recentTxs, tokenTransfers] = await Promise.all([
      this.getContractInfo(address),
      this.getFirstTransaction(address),
      this.getRecentTransactions(address, 10),
      this.getTokenTransfers(address, 10),
    ]);

    const ageInDays = firstTx
      ? Math.floor((Date.now() / 1000 - firstTx.timestamp) / 86400)
      : null;

    const hasHighValueTransfers = recentTxs.some(tx => {
      const value = parseFloat(tx.value) / 1e18; // Convert wei to ETH
      return value > 10; // > 10 ETH
    });

    return {
      contract: contractInfo,
      firstSeen: firstTx,
      recentActivity: recentTxs,
      tokenTransfers,
      securitySignals: {
        hasHighValueTransfers,
        recentActivityCount: recentTxs.length,
        ageInDays,
        isVerified: contractInfo.verified,
        hasProxy: contractInfo.isProxy,
        hasSourceCode: contractInfo.sourceCode !== "",
      },
    };
  }

  /**
   * Get contract verification status and source code
   */
  async getContractInfo(address: string): Promise<EtherscanContractInfo> {
    const data = await this.fetchApi({
      module: "contract",
      action: "getsourcecode",
      address,
    });

    const result = data.result?.[0] || {};

    // Check if it's a proxy contract
    const isProxy = result.Implementation !== "";
    const implementation = isProxy ? result.Implementation : undefined;

    return {
      address,
      verified: result.SourceCode !== "",
      contractName: result.ContractName || undefined,
      compiler: result.CompilerVersion || undefined,
      optimizationUsed: result.OptimizationUsed === "1",
      runs: result.Runs ? parseInt(result.Runs) : undefined,
      sourceCode: result.SourceCode || undefined,
      abi: result.ABI !== "Contract source code not verified" ? result.ABI : undefined,
      implementation,
      isProxy,
    };
  }

  /**
   * Get the first transaction for a contract (deployment)
   */
  async getFirstTransaction(address: string): Promise<EtherscanTransactionInfo | null> {
    const data = await this.fetchApi({
      module: "account",
      action: "txlist",
      address,
      startblock: "0",
      endblock: "99999999",
      page: "1",
      offset: "1",
      sort: "asc",
    });

    const tx = data.result?.[0];
    if (!tx) return null;

    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value,
      timestamp: parseInt(tx.timeStamp),
    };
  }

  /**
   * Get recent transactions for a contract
   */
  async getRecentTransactions(address: string, limit: number = 10): Promise<EtherscanTransactionInfo[]> {
    const data = await this.fetchApi({
      module: "account",
      action: "txlist",
      address,
      startblock: "0",
      endblock: "99999999",
      page: "1",
      offset: limit.toString(),
      sort: "desc",
    });

    return (data.result || []).map((tx: any) => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value,
      timestamp: parseInt(tx.timeStamp),
    }));
  }

  /**
   * Get ERC20 token transfers for a contract
   */
  async getTokenTransfers(address: string, limit: number = 10): Promise<Array<{
    hash: string;
    from: string;
    to: string;
    value: string;
    tokenName: string;
    tokenSymbol: string;
  }>> {
    const data = await this.fetchApi({
      module: "account",
      action: "tokentx",
      address,
      page: "1",
      offset: limit.toString(),
      sort: "desc",
    });

    return (data.result || []).map((tx: any) => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value,
      tokenName: tx.tokenName,
      tokenSymbol: tx.tokenSymbol,
    }));
  }

  /**
   * Get ETH balance for an address
   */
  async getBalance(address: string): Promise<string> {
    const data = await this.fetchApi({
      module: "account",
      action: "balance",
      address,
      tag: "latest",
    });

    return data.result || "0";
  }

  /**
   * Check if address is a contract
   */
  async isContract(address: string): Promise<boolean> {
    const data = await this.fetchApi({
      module: "proxy",
      action: "eth_getCode",
      address,
      tag: "latest",
    });

    return data.result && data.result !== "0x" && data.result !== "0x0";
  }

  /**
   * Calculate security score based on Etherscan data
   */
  calculateSecurityScore(analysis: EtherscanAnalysis): {
    score: number;
    findings: Array<{ title: string; description: string; severity: "critical" | "high" | "medium" | "low" | "informational" }>;
  } {
    const findings: Array<{ title: string; description: string; severity: "critical" | "high" | "medium" | "low" | "informational" }> = [];
    let score = 70; // Base score

    // Verification status
    if (analysis.securitySignals.isVerified) {
      findings.push({
        title: "Verified Source Code",
        description: `Contract "${analysis.contract.contractName}" is verified on Etherscan.`,
        severity: "informational",
      });
      score += 15;
    } else {
      findings.push({
        title: "Unverified Contract",
        description: "Source code is not verified. Cannot inspect for vulnerabilities.",
        severity: "medium",
      });
      score -= 25;
    }

    // Proxy detection
    if (analysis.securitySignals.hasProxy) {
      findings.push({
        title: "Proxy Contract",
        description: `This is a proxy contract pointing to implementation: ${analysis.contract.implementation}`,
        severity: "medium",
      });
      score -= 10;
    }

    // Contract age
    if (analysis.securitySignals.ageInDays !== null) {
      if (analysis.securitySignals.ageInDays < 7) {
        findings.push({
          title: "Very New Contract",
          description: `Contract is only ${analysis.securitySignals.ageInDays} days old. High risk.`,
          severity: "high",
        });
        score -= 20;
      } else if (analysis.securitySignals.ageInDays < 30) {
        findings.push({
          title: "New Contract",
          description: `Contract is ${analysis.securitySignals.ageInDays} days old. Exercise caution.`,
          severity: "medium",
        });
        score -= 10;
      } else if (analysis.securitySignals.ageInDays > 365) {
        findings.push({
          title: "Established Contract",
          description: `Contract has been active for ${Math.floor(analysis.securitySignals.ageInDays / 365)} year(s).`,
          severity: "informational",
        });
        score += 10;
      }
    }

    // Recent activity
    if (analysis.securitySignals.recentActivityCount === 0) {
      findings.push({
        title: "Inactive Contract",
        description: "No recent transactions. Contract may be abandoned.",
        severity: "low",
      });
      score -= 5;
    }

    // High value transfers
    if (analysis.securitySignals.hasHighValueTransfers) {
      findings.push({
        title: "High Value Activity",
        description: "Contract has recent transactions with >10 ETH. Active treasury.",
        severity: "informational",
      });
    }

    // Compiler version check
    if (analysis.contract.compiler) {
      const compilerVersion = parseFloat(analysis.contract.compiler.replace(/^v/, ""));
      if (compilerVersion < 0.8) {
        findings.push({
          title: "Older Solidity Version",
          description: `Using compiler ${analysis.contract.compiler}. Versions <0.8 lack built-in overflow protection.`,
          severity: "medium",
        });
        score -= 10;
      }
    }

    // Optimization
    if (analysis.contract.optimizationUsed) {
      findings.push({
        title: "Optimized Bytecode",
        description: `Contract compiled with optimization (${analysis.contract.runs} runs).`,
        severity: "informational",
      });
    }

    return { score: Math.max(0, Math.min(100, score)), findings };
  }

  /**
   * Make API request to Etherscan
   */
  private async fetchApi(params: Record<string, string>): Promise<any> {
    const queryParams = new URLSearchParams({
      ...params,
      apikey: this.apiKey,
    });

    const response = await fetch(`${this.baseUrl}?${queryParams}`);

    if (!response.ok) {
      throw new Error(`Etherscan API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === "0" && data.message === "NOTOK") {
      throw new Error(`Etherscan API error: ${data.result}`);
    }

    return data;
  }
}

// Singleton instance
let etherscanService: EtherscanService | null = null;

export function getEtherscanService(): EtherscanService {
  if (!etherscanService) {
    etherscanService = new EtherscanService();
  }
  return etherscanService;
}
