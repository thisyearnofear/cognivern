import { elizaLogger, IAgentRuntime, Memory, Provider, State, ServiceType } from "@elizaos/core";
import { RecallService } from "../services/recall.service.ts";

export const recallCotProvider: Provider = {
  get: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state?: State
  ): Promise<Error | string> => {
    try {
      const recallService = _runtime.services.get("recall" as ServiceType) as RecallService;
      const res = await recallService.retrieveOrderedChainOfThoughtLogs("cot-new");
      return JSON.stringify(res, null, 2);
    } catch (error) {
      return error instanceof Error
        ? error.message
        : "Unable to get storage provider";
    }
  },
};
