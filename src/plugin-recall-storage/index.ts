import { Plugin } from "@elizaos/core";
import { recallCotProvider } from "./providers/index.ts";
import { RecallService } from "./services/recall.service.ts";
import { buyCreditAction } from "./actions/buy-credit.ts";

export const recallStoragePlugin: Plugin = {
  name: "Recall Storage Plugin",
  description: "Provides basic Recall storage functionality",
  actions: [buyCreditAction],
  //   evaluators: [knowledgeEvaluator],
  providers: [recallCotProvider],
  services: [RecallService.getInstance()],
};

export default recallStoragePlugin;
