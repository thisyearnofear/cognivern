/**
 * HTTP client for Cleanverse API (CVI / CVA).
 * All requests send `api-id`. Encrypted endpoints wrap the body as `{ data }`.
 */

import { cleanverseConfig } from "@backend/shared/config/index.js";
import { encodePayload } from "./crypto.js";

export interface CleanverseRequestOptions {
  endpoint: string;
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  encrypted?: boolean;
}

export interface CleanverseApiResponse<T = unknown> {
  code: number;
  message?: string;
  result?: T;
  count?: number;
}

export class CleanverseClient {
  async request<T = unknown>(
    options: CleanverseRequestOptions,
  ): Promise<CleanverseApiResponse<T>> {
    const { endpoint, method = "POST", body = {}, encrypted = false } = options;

    if (!cleanverseConfig.apiId || !cleanverseConfig.apiKey) {
      throw new Error(
        "CLEANVERSE_API_ID and CLEANVERSE_API_KEY must be set to call Cleanverse",
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "api-id": cleanverseConfig.apiId,
    };

    const requestBody = encrypted
      ? JSON.stringify({ data: encodePayload(body, cleanverseConfig.apiKey) })
      : JSON.stringify(body);

    const url = `${cleanverseConfig.apiUrl}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers,
      body: method === "POST" ? requestBody : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Cleanverse API error ${response.status}: ${text}`);
    }

    return (await response.json()) as CleanverseApiResponse<T>;
  }
}

export const cleanverseClient = new CleanverseClient();
