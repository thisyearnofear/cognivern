import { EventSourcePolyfill } from 'event-source-polyfill';
import logger from '../utils/logger.js';
import { config, mcpConfig } from '../config.js';

export interface MCPMessage {
  id: string;
  type: string;
  data: any;
  timestamp: string;
}

export interface MCPAgentSpec {
  name: string;
  description: string;
  instructions: string;
  tools?: Array<{ type: string; [key: string]: any }>;
  image?: string;
  categories?: string[];
  chainIds?: number[];
  version?: string;
}

export class MCPClientService {
  private eventSource: EventSourcePolyfill | null = null;
  private serverUrl: string;
  private apiKey: string | undefined;
  private connected: boolean = false;
  private messageHandlers: Map<string, (message: MCPMessage) => void> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000; // Start with 2 seconds

  constructor(serverName?: string) {
    const server = serverName || config.MCP_DEFAULT_SERVER;
    const serverConfig = mcpConfig.mcpServers[server];

    if (!serverConfig) {
      throw new Error(`MCP server "${server}" not found in configuration`);
    }

    this.serverUrl = serverConfig.url;
    this.apiKey = config.MCP_API_KEY;
  }

  /**
   * Connect to the MCP server
   */
  public connect(): void {
    if (!config.MCP_ENABLED) {
      logger.info('MCP is disabled, skipping connection');
      return;
    }

    if (this.connected) {
      logger.info('Already connected to MCP server');
      return;
    }

    try {
      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      this.eventSource = new EventSourcePolyfill(this.serverUrl, {
        headers,
        withCredentials: false,
      });

      this.eventSource.onopen = () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 2000; // Reset delay on successful connection
        logger.info(`Connected to MCP server: ${this.serverUrl}`);
      };

      this.eventSource.onerror = (error) => {
        logger.error('Error connecting to MCP server:', error);
        this.connected = false;
        this.handleReconnect();
      };

      this.eventSource.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as MCPMessage;
          logger.debug('Received MCP message:', message);

          // Call any registered handlers for this message type
          const handler = this.messageHandlers.get(message.type);
          if (handler) {
            handler(message);
          }

          // Call the wildcard handler if it exists
          const wildcardHandler = this.messageHandlers.get('*');
          if (wildcardHandler) {
            wildcardHandler(message);
          }
        } catch (error) {
          logger.error('Error processing MCP message:', error);
        }
      };
    } catch (error) {
      logger.error('Failed to connect to MCP server:', error);
      this.handleReconnect();
    }
  }

  /**
   * Disconnect from the MCP server
   */
  public disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.connected = false;
      logger.info('Disconnected from MCP server');
    }
  }

  /**
   * Register a handler for a specific message type
   * @param messageType The message type to handle, or '*' for all messages
   * @param handler The handler function
   */
  public onMessage(messageType: string, handler: (message: MCPMessage) => void): void {
    this.messageHandlers.set(messageType, handler);
  }

  /**
   * Send a message to the MCP server
   * @param type The message type
   * @param data The message data
   */
  public async sendMessage(type: string, data: any): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    try {
      const message: MCPMessage = {
        id: `msg-${Date.now()}`,
        type,
        data,
        timestamp: new Date().toISOString(),
      };

      // Use the API endpoint instead of the SSE endpoint for sending messages
      // The SSE endpoint (this.serverUrl) is only for receiving events
      let apiUrl = this.serverUrl;

      // If the URL already contains /api/messages, use it as is
      if (apiUrl.includes('/api/messages')) {
        // URL is already correct
      }
      // If the URL contains /sse, replace it with /api/messages
      else if (apiUrl.includes('/sse')) {
        apiUrl = apiUrl.replace('/sse', '/api/messages');
      }
      // Otherwise, append /api/messages to the base URL
      else {
        // Remove trailing slash if present
        if (apiUrl.endsWith('/')) {
          apiUrl = apiUrl.slice(0, -1);
        }
        apiUrl = `${apiUrl}/api/messages`;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      logger.debug('Sent MCP message:', message);
    } catch (error) {
      logger.error('Error sending MCP message:', error);
      throw error;
    }
  }

  /**
   * Register an agent with the MCP server
   * @param agentSpec The agent specification
   */
  public async registerAgent(agentSpec: MCPAgentSpec): Promise<void> {
    try {
      await this.sendMessage('register-agent', {
        spec: agentSpec,
      });
      logger.info(`Registered agent "${agentSpec.name}" with MCP server`);
    } catch (error) {
      logger.error(`Failed to register agent "${agentSpec.name}":`, error);
      throw error;
    }
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`Failed to reconnect to MCP server after ${this.maxReconnectAttempts} attempts`);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1); // Exponential backoff

    logger.info(
      `Attempting to reconnect to MCP server in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    setTimeout(() => {
      this.disconnect(); // Ensure clean disconnect
      this.connect();
    }, delay);
  }

  /**
   * Check if connected to the MCP server
   */
  public isConnected(): boolean {
    return this.connected;
  }
}
