/**
 * Shared Types - Single Source of Truth
 *
 * All types used across the platform are defined here to ensure consistency
 * and eliminate duplication between API, agents, and frontend.
 */
export type AgentType = "governance" | "portfolio" | "sapience" | "recall" | "vincent" | "trading" | "analysis" | "monitoring" | "filecoin" | "social-trading" | "contract" | "governance" | "external-trading" | "custom";
export type AgentStatus = "active" | "inactive" | "pending" | "paused" | "error" | "maintenance";
export interface Agent extends BaseAgent {
    owner: string;
    registeredAt: string;
    lastActivity: string;
    currentPolicyId?: string;
    createdAt?: string | Date;
    updatedAt?: string | Date;
}
export interface BaseAgent {
    id: string;
    name: string;
    type: AgentType;
    status: AgentStatus;
    capabilities: string[];
    createdAt?: string | Date;
    updatedAt?: string | Date;
}
export interface AgentMetrics {
    uptime: number;
    successRate: number;
    errorRate: number;
    avgResponseTime: number;
    totalRequests: number;
    lastActive: string;
    actionsToday: number;
    responseTime?: number;
}
export interface AgentState {
    isActive: boolean;
    lastActivity: string;
    lastUpdate?: string;
    tradesExecuted?: number;
    metrics: AgentMetrics;
    performance?: {
        totalReturn: number;
        winRate: number;
        sharpeRatio: number;
        complianceScore?: number;
        autonomyLevel?: number;
        riskProfile?: "low" | "medium" | "high" | "critical";
    };
    riskMetrics?: {
        currentRiskScore: number;
        violationsToday: number;
        complianceRate: number;
    };
    financialMetrics?: {
        totalValue: number;
        dailyPnL: number;
        winRate: number;
    };
}
export type TradingAction = "buy" | "sell" | "hold";
export interface TradingDecision {
    id?: string;
    action: TradingAction;
    symbol: string;
    quantity: number;
    price: number;
    confidence: number;
    reasoning: string;
    riskScore: number;
    timestamp: string | Date;
    agentType?: AgentType;
    agentId?: string;
    sentimentData?: {
        sentiment: number;
        confidence: number;
        sources: string[];
    };
}
export interface TradingPerformance {
    totalReturn: number;
    winRate: number;
    sharpeRatio: number;
    totalTrades?: number;
    profitableTrades?: number;
    averageReturn?: number;
    maxDrawdown?: number;
}
export type PolicyStatus = "active" | "inactive" | "draft" | "deprecated" | "archived";
export interface Policy {
    id: string;
    name: string;
    description: string;
    version: string;
    rules: PolicyRule[];
    creator: string;
    status: PolicyStatus;
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, any>;
    appliedToAgents?: string[];
    effectivenessScore?: number;
    violationsPrevented?: number;
}
export interface PolicyRule {
    id: string;
    type: string | "ALLOW" | "DENY" | "REQUIRE" | "RATE_LIMIT";
    condition: string;
    action: string;
    parameters?: Record<string, any>;
    metadata?: Record<string, any>;
    priority?: number;
    enabled?: boolean;
}
export interface PolicyCheck {
    policyId: string;
    result: boolean;
    reason?: string;
}
export type OwsAgentStatus = "active" | "standby" | "error" | "disabled";
export interface OwsAgent {
    id: string;
    name: string;
    description: string;
    type: "governance" | "portfolio" | "research" | "procurement" | "oversight";
    status: OwsAgentStatus;
    walletId?: string;
    apiKeyId?: string;
    policyIds: string[];
    createdAt: string;
    metadata?: Record<string, unknown>;
}
export interface OwsAgentMetrics {
    agentId: string;
    totalSpendRequests: number;
    approvedRequests: number;
    deniedRequests: number;
    heldRequests: number;
    lastActivityAt?: string;
    complianceRate: number;
}
export interface SpendRequest {
    id: string;
    agentId: string;
    recipient: string;
    amount: string;
    asset: string;
    reason: string;
    status: "pending" | "approved" | "denied" | "held";
    policyEvaluations: PolicyCheck[];
    createdAt: string;
    resolvedAt?: string;
    evidence?: {
        hash: string;
        artifactIds: string[];
    };
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    timestamp: string;
}
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface DashboardMetrics {
    totalAgents: number;
    activeAgents: number;
    totalForecasts: number;
    complianceRate: number;
    averageAttestationTime: number;
}
export interface HealthStatus {
    status: "healthy" | "unhealthy" | "degraded";
    timestamp: string;
    uptime: number;
    version: string;
    dependencies: Record<string, DependencyHealth>;
}
export interface SystemHealth {
    overall: "healthy" | "warning" | "critical";
    status?: "healthy" | "unhealthy" | "degraded";
    timestamp: string;
    uptime: number;
    version: string;
    components: {
        arbitrum: "online" | "degraded" | "offline";
        eas: "operational" | "delayed" | "failed";
        ethereal: "online" | "degraded" | "offline";
        policies: "active" | "warning" | "error";
    };
    metrics: DashboardMetrics;
    dependencies?: Record<string, DependencyHealth>;
}
export interface DependencyHealth {
    status: "healthy" | "unhealthy";
    responseTime?: number;
    error?: string;
}
export type UxEventType = "run_console_view" | "run_cancel" | "run_retry" | "run_retry_from_step" | "run_plan_opened" | "run_plan_saved" | "run_approval_approve" | "run_approval_reject" | "agent_shadow_start" | "agent_shadow_stop" | "onboarding_complete" | "dashboard_refresh";
export interface UxEvent {
    eventType: UxEventType;
    payload: Record<string, unknown>;
    timestamp: string;
}
export interface SpendOsStatus {
    isConnected: boolean;
    hasConsent: boolean;
    appId: string;
    delegateeAddress?: string;
    policies: {
        dailySpendingLimit: number;
        allowedTokens: string[];
        maxTradeSize: number;
    };
    isConfigured: boolean;
}
export type VincentStatus = SpendOsStatus;
export interface ServiceConfig {
    name: string;
    version: string;
    environment: "development" | "production" | "test";
    port?: number;
    logLevel: "error" | "warn" | "info" | "debug";
}
export interface UseAgentState {
    agent: Agent | null;
    status: AgentState;
    isLoading: boolean;
    error: string | null;
    startAgent: () => Promise<void>;
    stopAgent: () => Promise<void>;
    refreshData: () => Promise<void>;
}
export interface UseTradingData {
    decisions: TradingDecision[];
    isLoading: boolean;
    error: string | null;
    refreshData: () => Promise<void>;
}
export type ChainId = `eip155:${number}` | `solana:${string}`;
export type AccountId = `${ChainId}:${string}`;
export type WalletId = string;
export type ChainType = "evm" | "solana" | "starknet";
export interface OwsAccountDescriptor {
    accountId: AccountId;
    address: string;
    derivationPath: string;
    chainId: ChainId;
}
export interface OwsWalletDescriptor {
    id: WalletId;
    name: string;
    createdAt: string;
    chainType: ChainType;
    accounts: OwsAccountDescriptor[];
    metadata: Record<string, unknown>;
}
export interface OwsApiKey {
    id: string;
    name: string;
    tokenHash: string;
    createdAt: string;
    walletIds: WalletId[];
    policyIds: string[];
    expiresAt?: string;
}
export interface SerializedTransaction {
    to: string;
    from: string;
    value: string;
    data?: string;
    nonce?: number;
    gasLimit?: string;
    gasPrice?: string;
    chainId: number;
}
export interface SignRequest {
    walletId: WalletId;
    chainId: ChainId;
    transaction: SerializedTransaction;
    simulate?: boolean;
}
export interface SignAndSendRequest extends SignRequest {
    maxRetries?: number;
    confirmations?: number;
}
export interface SignMessageRequest {
    walletId: WalletId;
    chainId: ChainId;
    message: string | Uint8Array;
    encoding?: "utf8" | "hex";
}
export type PolicyAction = "deny" | "warn";
export interface OwsPolicy {
    id: string;
    name: string;
    executable: string;
    config?: Record<string, unknown>;
    action: PolicyAction;
}
export interface PolicyContext {
    transaction: SerializedTransaction;
    chainId: ChainId;
    wallet: OwsWalletDescriptor;
    simulation?: SimulationResult;
    timestamp: string;
    apiKeyId: string;
}
export interface PolicyResult {
    allow: boolean;
    reason?: string;
}
export interface SimulationResult {
    success: boolean;
    gasUsed?: string;
    balanceChanges?: Record<string, string>;
    logs?: string[];
    error?: string;
}
//# sourceMappingURL=index.d.ts.map
