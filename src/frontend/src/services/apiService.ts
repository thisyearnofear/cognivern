// Unified API service layer to eliminate fetch duplication across components
import { getApiUrl } from "../utils/api";

// Base API configuration
const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "X-API-KEY": import.meta.env.VITE_API_KEY || "development-api-key",
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
    delay: number = 1000,
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
          // Don't retry on 4xx errors, only on 5xx or network errors
          if (response.status >= 400 && response.status < 500) {
            throw new Error(
              `API Error: ${response.status} - ${response.statusText}`,
            );
          }
          // Retry on 5xx errors
          if (attempt < retries - 1 && response.status >= 500) {
            await new Promise((resolve) =>
              setTimeout(resolve, delay * Math.pow(2, attempt)),
            );
            continue;
          }
          throw new Error(
            `API Error: ${response.status} - ${response.statusText}`,
          );
        }

        const data = await response.json();
        return { data, success: true };
      } catch (error) {
        clearTimeout(timeout);

        // Handle abort errors
        if (error instanceof Error && error.name === "AbortError") {
          return {
            error: "Request timeout - server took too long to respond",
            success: false,
          };
        }

        // Network error or fetch failed
        if (attempt < retries - 1) {
          console.warn(
            `API request attempt ${attempt + 1} failed for ${endpoint}, retrying...`,
            error,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, delay * Math.pow(2, attempt)),
          );
        } else {
          console.error(
            `API request failed for ${endpoint} after ${retries} attempts:`,
            error,
          );
          return {
            error:
              error instanceof Error
                ? error.message
                : "Network error - failed to reach server",
            success: false,
          };
        }
      }
    }

    return {
      error: "Failed after all retry attempts",
      success: false,
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    return this.requestWithRetry(endpoint, options);
  }

  // GET request
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  // POST request
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PUT request
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // DELETE request
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

// Agent-specific API service
export class AgentApiService extends ApiService {
  // Get agent status
  async getAgentStatus(agentType: string) {
    return this.get(`/api/agents/${agentType}/status`);
  }

  // Start agent
  async startAgent(agentType: string) {
    return this.post(`/api/agents/${agentType}/start`);
  }

  // Stop agent
  async stopAgent(agentType: string) {
    return this.post(`/api/agents/${agentType}/stop`);
  }

  // Get trading decisions
  async getTradingDecisions(agentType: string) {
    return this.get(`/api/agents/${agentType}/decisions`);
  }

  // Get agent metrics
  async getAgentMetrics(agentType: string) {
    return this.get(`/api/agents/${agentType}/metrics`);
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
    sortDirection?: "asc" | "desc";
  }) {
    const queryParams = new URLSearchParams();

    if (params.agentIds) queryParams.set("agentIds", params.agentIds.join(","));
    if (params.agentTypes)
      queryParams.set("agentTypes", params.agentTypes.join(","));
    if (params.ecosystems)
      queryParams.set("ecosystems", params.ecosystems.join(","));
    if (params.status) queryParams.set("status", params.status.join(","));
    if (params.timeRange) {
      queryParams.set("startDate", params.timeRange.start);
      queryParams.set("endDate", params.timeRange.end);
    }
    if (params.sortBy) queryParams.set("sortBy", params.sortBy);
    if (params.sortDirection)
      queryParams.set("sortDirection", params.sortDirection);

    const query = queryParams.toString();
    return this.get(`/api/agents/compare${query ? `?${query}` : ""}`);
  }

  // Get leaderboard across ecosystems
  async getLeaderboard(params?: {
    ecosystem?: string;
    metric?: "winRate" | "totalReturn" | "sharpeRatio";
    limit?: number;
  }) {
    const queryParams = new URLSearchParams();

    if (params?.ecosystem) queryParams.set("ecosystem", params.ecosystem);
    if (params?.metric) queryParams.set("metric", params.metric);
    if (params?.limit) queryParams.set("limit", params.limit.toString());

    const query = queryParams.toString();
    return this.get(`/api/agents/leaderboard${query ? `?${query}` : ""}`);
  }

  // Get aggregate statistics
  async getAggregateStats(params?: {
    agentTypes?: string[];
    ecosystems?: string[];
    timeRange?: { start: string; end: string };
  }) {
    const queryParams = new URLSearchParams();

    if (params?.agentTypes)
      queryParams.set("agentTypes", params.agentTypes.join(","));
    if (params?.ecosystems)
      queryParams.set("ecosystems", params.ecosystems.join(","));
    if (params?.timeRange) {
      queryParams.set("startDate", params.timeRange.start);
      queryParams.set("endDate", params.timeRange.end);
    }

    const query = queryParams.toString();
    return this.get(`/api/agents/stats${query ? `?${query}` : ""}`);
  }

  // Get all agents with basic info (for filtering)
  async listAgents(params?: {
    status?: string[];
    types?: string[];
    ecosystems?: string[];
  }) {
    const queryParams = new URLSearchParams();

    if (params?.status) queryParams.set("status", params.status.join(","));
    if (params?.types) queryParams.set("types", params.types.join(","));
    if (params?.ecosystems)
      queryParams.set("ecosystems", params.ecosystems.join(","));

    const query = queryParams.toString();
    return this.get(`/api/agents${query ? `?${query}` : ""}`);
  }
}

// MCP-specific API service
export class MCPApiService extends ApiService {
  // Get MCP status
  async getStatus() {
    return this.get("/api/mcp/status");
  }

  // Reconnect MCP
  async reconnect() {
    return this.post("/api/mcp/reconnect");
  }

  // Get MCP agents
  async getAgents() {
    return this.get("/api/mcp/agents");
  }
}

// Policy-specific API service
export class PolicyApiService extends ApiService {
  // Get all policies
  async getPolicies() {
    return this.get("/api/policies");
  }

  // Create policy
  async createPolicy(policy: any) {
    return this.post("/api/policies", policy);
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
    return this.get("/api/policies/violations");
  }
}

// Dashboard-specific API service
export class DashboardApiService extends ApiService {
  // Get dashboard metrics
  async getMetrics() {
    return this.get("/api/metrics/daily");
  }

  // Get system health
  async getSystemHealth() {
    return this.get("/api/system/health");
  }

  // Get activity feed
  async getActivityFeed() {
    return this.get("/api/activity/feed");
  }

  // Get competitions
  async getCompetitions(status?: string) {
    const endpoint = status
      ? `/api/competitions?status=${status}`
      : "/api/competitions";
    return this.get(endpoint);
  }
}

// Vincent-specific API service
export class VincentApiService extends ApiService {
  // Get Vincent status
  async getStatus() {
    return this.get("/api/vincent/status");
  }

  // Update Vincent consent
  async updateConsent(appId: string, consent: boolean) {
    return this.post("/api/vincent/consent", { appId, consent });
  }

  // Update Vincent policies
  async updatePolicies(policies: any) {
    return this.put("/api/vincent/policies", policies);
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
    return this.post("/api/sapience/forecast", data);
  }

  // Get Sapience status
  async getStatus() {
    return this.get("/api/sapience/status");
  }

  // Get wallet info
  async getWallet() {
    return this.get("/api/sapience/wallet");
  }
}

// Export singleton instances
export const agentApi = new AgentApiService();
export const mcpApi = new MCPApiService();
export const policyApi = new PolicyApiService();
export const dashboardApi = new DashboardApiService();
export const vincentApi = new VincentApiService();
export const sapienceApi = new SapienceApiService();

// Export default instance for general use
export default new ApiService();
