// Unified API service layer to eliminate fetch duplication across components
import { getApiUrl } from '../utils/api';

// Base API configuration
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'X-API-KEY': import.meta.env.VITE_API_KEY || 'development-api-key',
};

// Generic API response type
interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
}

// Base API service class
class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(getApiUrl(endpoint), {
        headers: { ...DEFAULT_HEADERS, ...options.headers },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      return { data, success: true };
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      return {
        error: error instanceof Error ? error.message : 'Unknown API error',
        success: false,
      };
    }
  }

  // GET request
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
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
  async getPolicies() {
    return this.get('/api/policies');
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

// Dashboard-specific API service
export class DashboardApiService extends ApiService {
  // Get dashboard metrics
  async getMetrics() {
    return this.get('/api/metrics/daily');
  }

  // Get system health
  async getSystemHealth() {
    return this.get('/api/system/health');
  }

  // Get activity feed
  async getActivityFeed() {
    return this.get('/api/activity/feed');
  }

  // Get competitions
  async getCompetitions(status?: string) {
    const endpoint = status ? `/api/competitions?status=${status}` : '/api/competitions';
    return this.get(endpoint);
  }
}

// Vincent-specific API service
export class VincentApiService extends ApiService {
  // Get Vincent status
  async getStatus() {
    return this.get('/api/vincent/status');
  }

  // Update Vincent consent
  async updateConsent(appId: string, consent: boolean) {
    return this.post('/api/vincent/consent', { appId, consent });
  }

  // Update Vincent policies
  async updatePolicies(policies: any) {
    return this.put('/api/vincent/policies', policies);
  }
}

// Export singleton instances
export const agentApi = new AgentApiService();
export const mcpApi = new MCPApiService();
export const policyApi = new PolicyApiService();
export const dashboardApi = new DashboardApiService();
export const vincentApi = new VincentApiService();

// Export default instance for general use
export default new ApiService();