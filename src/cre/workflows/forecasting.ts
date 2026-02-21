import { SapienceService } from "../../services/SapienceService.js";
import { DefaultEvmAdapter } from "../adapters/evm.js";
import { DefaultHttpAdapter } from "../adapters/http.js";
import { DefaultLlmAdapter } from "../adapters/llm.js";
import { CreRunRecorder } from "../runRecorder.js";
import {
  AttestationRequest,
  CreRun,
  ForecastInput,
  SapienceCondition,
} from "../types.js";

export type ForecastingWorkflowParams = {
  mode: CreRun["mode"]; // local now; cre later
  sapienceGraphqlEndpoint?: string;
  arbitrumRpcUrl?: string;
  chainlinkFeeds?: Array<{ name: string; address: `0x${string}` }>;
  writeAttestation?: boolean;
};

// Arbitrum One Chainlink Price Feeds (Mainnet)
// Source: https://docs.chain.link/data-feeds/price-feeds/addresses?network=arbitrum
const DEFAULT_FEEDS_ARBITRUM = [
  {
    name: "ETH / USD",
    address: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
  },
  {
    name: "BTC / USD",
    address: "0x6ce185860a4963106506C203335A2910413708e9",
  },
  {
    name: "LINK / USD",
    address: "0x86E53CF1B870786351Da77A57575e79CB55812CB",
  },
] satisfies Array<{ name: string; address: `0x${string}` }>;

function selectByHorizon(conditions: SapienceCondition[]): SapienceCondition | null {
  if (!conditions.length) return null;
  // pick the one with farthest endTime (horizon-weighted)
  return [...conditions].sort((a, b) => b.endTime - a.endTime)[0];
}

export async function runForecastingWorkflow(
  params: ForecastingWorkflowParams
): Promise<CreRun> {
  const recorder = new CreRunRecorder({ workflow: "forecasting", mode: params.mode });

  const http = new DefaultHttpAdapter();
  const evm = new DefaultEvmAdapter();
  const llm = new DefaultLlmAdapter();

  const sapienceGraphqlEndpoint =
    params.sapienceGraphqlEndpoint || "https://api.sapience.xyz/graphql";
  const arbitrumRpcUrl =
    params.arbitrumRpcUrl || process.env.ARBITRUM_RPC_URL || "";

  try {
    // Step 1: HTTP fetch markets
    const s1 = recorder.startStep("http", "fetch_sapience_conditions", {
      endpoint: sapienceGraphqlEndpoint,
    });
    const conditions = await http.fetchSapienceConditions({
      endpoint: sapienceGraphqlEndpoint,
      nowSec: Math.floor(Date.now() / 1000),
      take: 50,
    });
    recorder.addArtifact({ type: "sapience_conditions", data: conditions });
    s1.end({ ok: true, summary: `Fetched ${conditions.length} conditions` });

    // Step 2: select market
    const s2 = recorder.startStep("compute", "select_market_by_horizon");
    const condition = selectByHorizon(conditions);
    if (!condition) throw new Error("No active conditions found");
    s2.end({ ok: true, summary: `Selected condition ${condition.id}` });

    // Step 3: EVM read feeds
    const feeds = params.chainlinkFeeds || DEFAULT_FEEDS_ARBITRUM;
    const s3 = recorder.startStep("evm_read", "read_chainlink_price_feeds", {
      feedCount: feeds.length,
    });
    const priceFeeds = feeds.length
      ? await evm.readPriceFeeds({ rpcUrl: arbitrumRpcUrl, feeds })
      : [];
    recorder.addArtifact({ type: "chainlink_price_feeds", data: priceFeeds });
    s3.end({ ok: true, summary: `Read ${priceFeeds.length} feeds` });

    // Step 4: confidential LLM forecast (local adapter for now)
    const s4 = recorder.startStep(
      "confidential_http",
      "generate_forecast_confidentially"
    );
    const forecastInput: ForecastInput = { condition, priceFeeds };
    const forecast = await llm.generateForecast(forecastInput);
    recorder.addArtifact({ type: "llm_forecast", data: forecast });
    s4.end({ ok: true, summary: `Forecast: ${forecast.probability}%` });

    // Step 5: EVM write attestation (optional)
    if (params.writeAttestation) {
      const s5 = recorder.startStep("evm_write", "submit_attestation_via_sapience");

      const sapience = new SapienceService();
      const req: AttestationRequest = {
        conditionId: condition.id as `0x${string}`,
        probability: forecast.probability,
        reasoning: forecast.reasoning,
      };
      recorder.addArtifact({ type: "attestation_request", data: req });

      const txHash = await sapience.submitForecast({
        marketId: req.conditionId,
        probability: req.probability,
        confidence: Math.abs(req.probability - 50) / 50,
        reasoning: req.reasoning,
      });

      recorder.addArtifact({
        type: "attestation_result",
        data: { txHash },
      });

      s5.end({ ok: true, summary: `Attested: ${txHash}` });
    }

    recorder.finish(true);
    return recorder.getRun();
  } catch (error: any) {
    recorder.addArtifact({
      type: "error",
      data: {
        message: error?.message || String(error),
        stack: error?.stack,
      },
    });
    recorder.finish(false);
    return recorder.getRun();
  }
}
