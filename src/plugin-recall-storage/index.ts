import { Plugin } from "@elizaos/core";
import { recallCotProvider } from "./providers/index.ts";
import {RecallService} from "./services/recall.service.ts";

export const recallStoragePlugin: Plugin = {
  name: "Recall Storage Plugin",
  description: "Provides basic Recall storage functionality",
//   actions: [gateDataAction],
//   evaluators: [knowledgeEvaluator],
  providers: [recallCotProvider],
  services: [RecallService.getInstance()],
};

export default recallStoragePlugin;
