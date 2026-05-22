import { SapienceCondition } from "../types.js";

export interface HttpAdapter {
  fetchSapienceConditions(params: {
    endpoint: string;
    nowSec: number;
    take: number;
  }): Promise<SapienceCondition[]>;
}

export class DefaultHttpAdapter implements HttpAdapter {
  async fetchSapienceConditions(params: {
    endpoint: string;
    nowSec: number;
    take: number;
  }): Promise<SapienceCondition[]> {
    const query = `
      query GetConditions($nowSec: Int, $limit: Int) {
        conditions(
          where: {
            public: { equals: true }
            endTime: { gt: $nowSec }
          }
          take: $limit
          orderBy: { endTime: asc }
        ) {
          id
          question
          shortName
          endTime
        }
      }
    `;

    const response = await fetch(params.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { nowSec: params.nowSec, limit: params.take },
      }),
    });

    if (!response.ok) {
      throw new Error(`Sapience GraphQL HTTP ${response.status}`);
    }

    const result = (await response.json()) as any;
    const conditions = (result.data?.conditions || []) as SapienceCondition[];
    return conditions;
  }
}
