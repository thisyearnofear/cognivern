import { ethers } from "ethers";
import { PriceFeedReading } from "../types.js";

const AGGREGATOR_V3_ABI = [
  {
    inputs: [],
    name: "latestRoundData",
    outputs: [
      { internalType: "uint80", name: "roundId", type: "uint80" },
      { internalType: "int256", name: "answer", type: "int256" },
      { internalType: "uint256", name: "startedAt", type: "uint256" },
      { internalType: "uint256", name: "updatedAt", type: "uint256" },
      { internalType: "uint80", name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
];

export interface EvmAdapter {
  readPriceFeeds(params: {
    rpcUrl: string;
    feeds: Array<{ name: string; address: `0x${string}` }>;
  }): Promise<PriceFeedReading[]>;
}

export class DefaultEvmAdapter implements EvmAdapter {
  async readPriceFeeds(params: {
    rpcUrl: string;
    feeds: Array<{ name: string; address: `0x${string}` }>;
  }): Promise<PriceFeedReading[]> {
    const provider = new ethers.JsonRpcProvider(params.rpcUrl);

    const readings = await Promise.all(
      params.feeds.map(async (f) => {
        const contract = new ethers.Contract(f.address, AGGREGATOR_V3_ABI, provider);
        const [roundData, decimals] = await Promise.all([
          contract.latestRoundData(),
          contract.decimals(),
        ]);

        const updatedAtSec = Number(roundData.updatedAt);
        return {
          feedName: f.name,
          feedAddress: f.address,
          value: roundData.answer.toString(),
          decimals: Number(decimals),
          updatedAt: new Date(updatedAtSec * 1000).toISOString(),
        } satisfies PriceFeedReading;
      })
    );

    return readings;
  }
}
