// Unified API service layer to eliminate fetch duplication across components
import { getApiUrl, getApiKey } from '../utils/api';

// Base API configuration
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'X-API-KEY': getApiKey(),
};

// Generic API response type
interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
}

// Base API service class with retry logic
class ApiService {
  private async requestWithRetry<T>(
    endpoint: string,
    options: RequestInit = {},
    retries: number = 2, // Reduced from 3
    delay: number = 1000
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(getApiUrl(endpoint), {
          headers: { ...DEFAULT_HEADERS, ...options.headers },
          signal: controller.signal,
          ...options,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          // Don't retry on 4xx errors (client errors like 401, 404)
          if (response.status >= 400 && response.status < 500) {
            // For 401, don't log repeatedly - fail silently for demo mode
            if (response.status === 401) {
              return {
                error: `Authentication required`,
                success: false,
              };
            }
            throw new Error(`API Error: ${response.status} - ${response.statusText}`);
          }
          // Retry on 5xx errors
          if (attempt < retries - 1 && response.status >= 500) {
            await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, attempt)));
            continue;
          }
          throw new Error(`API Error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        return { data, success: true };
      } catch (error) {
        clearTimeout(timeout);

        // Handle abort errors
        if (error instanceof Error && error.name === 'AbortError') {
          return {
            error: 'Request timeout - server took too long to respond',
            success: false,
          };
        }

        // Network error or fetch failed
        if (attempt < retries - 1) {
          // Only log in development to avoid console spam
          if (!import.meta.env.PROD) {
            console.warn(
              `API request attempt ${attempt + 1} failed for ${endpoint}, retrying...`,
              error
            );
          }
          await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, attempt)));
        } else {
          // Only log final failure in development
          if (!import.meta.env.PROD) {
            console.error(`API request failed for ${endpoint} after ${retries} attempts:`, error);
          }
          return {
            error:
              error instanceof Error ? error.message : 'Network error - failed to reach server',
            success: false,
          };
        }
      }
    }

    return {
      error: 'Failed after all retry attempts',
      success: false,
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    return this.requestWithRetry(endpoint, options);
  }

  // GET request
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  // Health check
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(getApiUrl('/health'), {
        method: 'GET',
        headers: DEFAULT_HEADERS,
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // POST request
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PUT request
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // DELETE request
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Agent-specific API service
export class AgentApiService extends ApiService {
  // Get agent status
  async getAgentStatus(agentType: string): Promise<ApiResponse<any>> {
    return this.get(`/api/agents/${agentType}/status`);
  }

  // Start agent
  async startAgent(agentType: string): Promise<ApiResponse<any>> {
    return this.post(`/api/agents/${agentType}/start`);
  }

  // Stop agent
  async stopAgent(agentType: string): Promise<ApiResponse<any>> {
    return this.post(`/api/agents/${agentType}/stop`);
  }

  // Get trading decisions
  async getTradingDecisions(agentType: string): Promise<ApiResponse<any[]>> {
    return this.get<any[]>(`/api/agents/${agentType}/decisions`);
  }

  // Get agent metrics
  async getAgentMetrics(agentType: string): Promise<ApiResponse<any>> {
    return this.get(`/api/agents/${agentType}/metrics`);
  }

  // Get voice briefing for an agent
  async getAgentBriefing(agentId: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(getApiUrl(`/api/agents/${agentId}/briefing`), {
        headers: {
          ...DEFAULT_HEADERS,
        },
      });

      if (!response.ok) {
        throw new Error(`Briefing Error: ${response.status}`);
      }

      const script = decodeURIComponent(response.headers.get('X-Briefing-Script') || '');
      const audioBlob = await response.blob();

      return {
        success: true,
        data: {
          audioUrl: URL.createObjectURL(audioBlob),
          script,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch briefing',
      };
    }
  }

  // COMPARISON ENDPOINTS - New functionality for agent comparison

  // Compare multiple agents
  async compareAgents(params: {
    agentIds?: string[];
    agentTypes?: string[];
    ecosystems?: string[];
    status?: string[];
    timeRange?: { start: string; end: string };
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  }): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams();

    if (params.agentIds) queryParams.set('agentIds', params.agentIds.join(','));
    if (params.agentTypes) queryParams.set('agentTypes', params.agentTypes.join(','));
    if (params.ecosystems) queryParams.set('ecosystems', params.ecosystems.join(','));
    if (params.status) queryParams.set('status', params.status.join(','));
    if (params.timeRange) {
      queryParams.set('startDate', params.timeRange.start);
      queryParams.set('endDate', params.timeRange.end);
    }
    if (params.sortBy) queryParams.set('sortBy', params.sortBy);
    if (params.sortDirection) queryParams.set('sortDirection', params.sortDirection);

    const query = queryParams.toString();
    return this.get<any[]>(`/api/agents/compare${query ? `?${query}` : ''}`);
  }

  // Get leaderboard across ecosystems
  async getLeaderboard(params?: {
    ecosystem?: string;
    metric?: 'winRate' | 'totalReturn' | 'sharpeRatio';
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams();

    if (params?.ecosystem) queryParams.set('ecosystem', params.ecosystem);
    if (params?.metric) queryParams.set('metric', params.metric);
    if (params?.limit) queryParams.set('limit', params.limit.toString());

    const query = queryParams.toString();
    return this.get<any[]>(`/api/agents/leaderboard${query ? `?${query}` : ''}`);
  }

  // Get aggregate statistics
  async getAggregateStats(params?: {
    agentTypes?: string[];
    ecosystems?: string[];
    timeRange?: { start: string; end: string };
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();

    if (params?.agentTypes) queryParams.set('agentTypes', params.agentTypes.join(','));
    if (params?.ecosystems) queryParams.set('ecosystems', params.ecosystems.join(','));
    if (params?.timeRange) {
      queryParams.set('startDate', params.timeRange.start);
      queryParams.set('endDate', params.timeRange.end);
    }

    const query = queryParams.toString();
    return this.get(`/api/agents/stats${query ? `?${query}` : ''}`);
  }

  // Get all agents with basic info (for filtering)
  async listAgents(params?: {
    status?: string[];
    types?: string[];
    ecosystems?: string[];
  }): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams();

    if (params?.status) queryParams.set('status', params.status.join(','));
    if (params?.types) queryParams.set('types', params.types.join(','));
    if (params?.ecosystems) queryParams.set('ecosystems', params.ecosystems.join(','));

    const query = queryParams.toString();
    return this.get<any[]>(`/api/agents${query ? `?${query}` : ''}`);
  }

  // Get connected agents and governance links
  async getConnections() {
    return this.get('/api/agents/connections');
  }

  // Get recent activity from audit logs for dashboard surfaces
  async getRecentActivity() {
    const response = await this.get<{
      success?: boolean;
      data?: { logs?: any[] };
    }>('/api/audit/logs');

    if (!response.success || !response.data) {
      return response;
    }

    const payload = response.data;
    return {
      ...response,
      data: {
        logs: Array.isArray(payload.data?.logs) ? payload.data.logs : [],
      },
    };
  }

  // Get audit insights for governance quests
  async getInsights() {
    return this.get<any[]>('/api/audit/insights');
  }

  // Resolve a governance quest (Functional Layer)
  async resolveQuest(questId: string) {
    return this.post<{ success: boolean }>(`/api/audit/insights/${questId}/resolve`);
  }

  // Get unified dashboard bundle (Consolidation)
  async getDashboardBundle() {
    return this.get<any>('/api/dashboard/bundle');
  }

  // Get unified dashboard/control-plane data
  async getUnifiedDashboard() {
    return this.get<any>('/api/dashboard/unified');
  }

  // Register a new user-owned agent (New Feature)
  async registerAgent(agent: {
    type: string;
    name: string;
    address: string;
    description?: string;
    riskLevel?: string;
  }) {
    return this.post('/api/agents/register', agent);
  }
}

// MCP-specific API service
export class MCPApiService extends ApiService {
  // Get MCP status
  async getStatus() {
    return this.get('/api/mcp/status');
  }

  // Reconnect MCP
  async reconnect() {
    return this.post('/api/mcp/reconnect');
  }

  // Get MCP agents
  async getAgents() {
    return this.get('/api/mcp/agents');
  }
}

// Policy-specific API service
export class PolicyApiService extends ApiService {
  // Get all policies
  async getPolicies(): Promise<ApiResponse<any[]>> {
    return this.get<any[]>('/api/policies');
  }

  // Create policy
  async createPolicy(policy: any) {
    return this.post('/api/policies', policy);
  }

  // Update policy
  async updatePolicy(id: string, policy: any) {
    return this.put(`/api/policies/${id}`, policy);
  }

  // Delete policy
  async deletePolicy(id: string) {
    return this.delete(`/api/policies/${id}`);
  }

  // Get policy violations
  async getViolations() {
    return this.get('/api/policies/violations');
  }
}

// SpendOS-specific API service
export class SpendOsApiService extends ApiService {
  // Get SpendOS status
  async getStatus() {
    return this.get('/api/spendos/status');
  }

  // Get SpendOS decisions
  async getDecisions() {
    return this.get('/api/spendos/decisions');
  }
}

// Spend Execution Layer API service
export class SpendApiService extends ApiService {
  /**
   * Request a spend execution
   */
  async requestSpend(data: {
    agentId: string;
    recipient: string;
    amount: string;
    asset: string;
    reason: string;
    metadata?: Record<string, any>;
  }) {
    return this.post('/api/spend', data);
  }

  /**
   * Preview/simulate a spend without executing
   */
  async previewSpend(data: {
    agentId: string;
    recipient: string;
    amount: string;
    asset: string;
    reason: string;
    metadata?: Record<string, any>;
  }) {
    return this.post('/api/spend/preview', data);
  }

  /**
   * Get execution layer status
   */
  async getStatus() {
    return this.get('/api/spend/status');
  }

  /**
   * Scan a contract address for security vulnerabilities
   * No authentication required
   */
  async scanContract(address: string) {
    return this.get(`/api/spend/scan?address=${encodeURIComponent(address)}`);
  }

  /**
   * Decrypt confidential data using a permit (Auditor only)
   */
  async decrypt(data: { permit: any; encryptedValue: any; contractAddress: string }) {
    return this.post('/api/fhenix/decrypt', data);
  }
}

// Sapience-specific API service
export class SapienceApiService extends ApiService {
  // Submit manual forecast
  async submitForecast(data: {
    conditionId: string;
    probability: number;
    reasoning: string;
    confidence: number;
  }) {
    return this.post('/api/sapience/forecast', data);
  }

  // Get Sapience status
  async getStatus() {
    return this.get('/api/sapience/status');
  }

  // Get wallet info
  async getWallet() {
    return this.get('/api/sapience/wallet');
  }
}

// Export singleton instances
export const agentApi = new AgentApiService();
export const mcpApi = new MCPApiService();
export const policyApi = new PolicyApiService();
export const spendOsApi = new SpendOsApiService();
export const spendApi = new SpendApiService();
export const sapienceApi = new SapienceApiService();

// OWS-specific API service (Wallet, API Keys)
export class OwsApiService extends ApiService {
  // Get OWS status
  async getStatus() {
    return this.get('/api/ows/status');
  }

  // Bootstrap wallet
  async bootstrap() {
    return this.post('/api/ows/bootstrap', {});
  }

  // List wallets
  async listWallets() {
    return this.get('/api/ows/wallets');
  }

  // Import wallet
  async importWallet(data: { name: string; privateKey: string; chainId?: string }) {
    return this.post('/api/ows/wallets/import', data);
  }

  // Connect external wallet
  async connectExternalWallet(url: string) {
    return this.post('/api/ows/wallets/connect', { url });
  }

  // List API keys
  async listApiKeys() {
    return this.get('/api/ows/api-keys');
  }

  // Create API key
  async createApiKey(data: {
    name: string;
    walletIds: string[];
    policyIds?: string[];
    expiresAt?: string;
  }) {
    return this.post('/api/ows/api-keys', data);
  }

  // Request permissions
  async requestPermissions(data: {
    walletId: string;
    invoker: string;
    permissions: Array<{ type: string; value?: unknown }>;
  }) {
    return this.post('/api/ows/permissions', data);
  }

  // Get unified OWS dashboard
  async getDashboard() {
    return this.get<{
      wallet: {
        id: string;
        name: string;
        chainType: string;
        accounts: Array<{ address: string; chainId: string }>;
      } | null;
      apiKeys: Array<{
        id: string;
        name: string;
        createdAt: string;
        walletCount: number;
        policyCount: number;
      }>;
      agents: Array<{
        id: string;
        name: string;
        type: string;
        status: string;
        policyCount: number;
      }>;
      permissions: Array<{ type: string; value?: unknown }>;
      hasWallet: boolean;
      hasApiKeys: boolean;
      hasAgents: boolean;
    }>('/api/ows/dashboard');
  }

  // List OWS agents
  async listAgents() {
    return this.get('/api/ows/agents');
  }

  // Register OWS agent
  async createAgent(data: {
    name: string;
    description?: string;
    type: string;
    walletId?: string;
    apiKeyId?: string;
    policyIds?: string[];
    metadata?: Record<string, unknown>;
  }) {
    return this.post('/api/ows/agents', data);
  }
}

export const owsApi = new OwsApiService();
// Export X Layer API service
export {
  getGovernanceContract,
  getStorageContract,
  getAIGovernanceContract,
  fetchGovernanceStats,
  fetchStorageStats,
  fetchAIGovernanceStats,
  fetchAllPolicyIds,
  fetchAllAgentIds,
  fetchActiveProviders,
  checkXLayerConnection,
  fetchPolicyDetails,
  fetchAgentDetails,
} from './xlayerApi';

// Export default instance for general use
export default new ApiService();
