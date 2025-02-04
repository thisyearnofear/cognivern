// import bodyParser from "body-parser";
// import cors from "cors";
// import express, { Request as ExpressRequest } from "express";
// import { createGoogleGenerativeAI } from "@ai-sdk/google";
// import multer from "multer";
// import {
//     elizaLogger,
//     generateCaption,
//     generateImage,
//     Media,
//     getEmbeddingZeroVector,
//     trimTokens,
//     models,
//     parseJSONObjectFromText,
//     ModelProviderName,
//     parseBooleanFromText,
//     ITextGenerationService,
//     ServiceType
// } from "@elizaos/core";
// import { createAnthropic } from "@ai-sdk/anthropic";
// import { composeContext } from "@elizaos/core";
// import { messageCompletionFooter } from "@elizaos/core";
// import { createOpenAI } from "@ai-sdk/openai";
// import { AgentRuntime } from "@elizaos/core";
// import {
//     Content,
//     Memory,
//     ModelClass,
//     Client,
//     IAgentRuntime,
// } from "@elizaos/core";
// import {
//     generateObject as aiGenerateObject,
//     generateText as aiGenerateText,
//     CoreTool,
//     GenerateObjectResult,
//     StepResult as AIStepResult,
// } from "ai";
// import { stringToUuid } from "@elizaos/core";
// import { settings } from "@elizaos/core";
// import { createApiRouter } from "./api.ts";
// import * as fs from "fs";
// import * as path from "path";

// type Tool = CoreTool<any, any>;
// type StepResult = AIStepResult<any>;

// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         const uploadDir = path.join(process.cwd(), "data", "uploads");
//         // Create the directory if it doesn't exist
//         if (!fs.existsSync(uploadDir)) {
//             fs.mkdirSync(uploadDir, { recursive: true });
//         }
//         cb(null, uploadDir);
//     },
//     filename: (req, file, cb) => {
//         const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
//         cb(null, `${uniqueSuffix}-${file.originalname}`);
//     },
// });

// const upload = multer({ storage });

// // --- Message Handler Template ---
// export const messageHandlerTemplate =
//     // {{goals}}
//     `# Action Examples
// {{actionExamples}}
// (Action examples are for reference only. Do not use the information from them in your response.)

// # Knowledge
// {{knowledge}}

// # Task: Generate dialog and actions for the character {{agentName}}.
// About {{agentName}}:
// {{bio}}
// {{lore}}

// {{providers}}

// {{attachments}}

// # Capabilities
// Note that {{agentName}} is capable of reading/seeing/hearing various forms of media, including images, videos, audio, plaintext and PDFs. Recent attachments have been included above under the "Attachments" section.

// {{messageDirections}}

// {{recentMessages}}

// {{actions}}

// # Instructions: Think step-by-step before responding.

// Step-by-step Reasoning:
// 1. Key Elements:
// [Identify the key elements in the conversation]

// 2. Problem Breakdown:
// [Break down the problem into smaller logical steps]

// 3. Analysis:
// [Analyze relevant knowledge, context, and past interactions]

// 4. Preliminary Conclusion:
// [Formulate initial conclusions based on the analysis]

// Final Response:
// [Present the response based on the above reasoning]

// # Generate the next message for {{agentName}} following the above format.
// ${messageCompletionFooter}`;

// // --- generateText Function ---
// export async function generateText({
//     runtime,
//     context,
//     modelClass,
//     tools = {},
//     onStepFinish,
//     maxSteps = 1,
//     stop,
//     customSystemPrompt,
// }: {
//     runtime: IAgentRuntime;
//     context: string;
//     modelClass: string;
//     tools?: Record<string, CoreTool<any, any>>;
//     onStepFinish?: (event: AIStepResult<any>) => Promise<void> | void;
//     maxSteps?: number;
//     stop?: string[];
//     customSystemPrompt?: string;
// }): Promise<string> {
//     if (!context) {
//         elizaLogger.error("generateText context is empty");
//         return "";
//     }

//     elizaLogger.log("Generating text...");
//     elizaLogger.info("Generating text with options:", {
//         modelProvider: runtime.modelProvider,
//         model: modelClass,
//     });

//     const provider = runtime.modelProvider;
//     const endpoint = runtime.character.modelEndpointOverride || models[provider].endpoint;
//     let model = models[provider].model[modelClass];

//     // Allow character.json settings => secrets to override models
//     switch (provider) {
//         case ModelProviderName.LLAMACLOUD: {
//             switch (modelClass) {
//                 case ModelClass.LARGE:
//                     model = runtime.getSetting("LLAMACLOUD_MODEL_LARGE") || model;
//                     break;
//                 case ModelClass.SMALL:
//                     model = runtime.getSetting("LLAMACLOUD_MODEL_SMALL") || model;
//                     break;
//             }
//         } break;
//         case ModelProviderName.TOGETHER: {
//             switch (modelClass) {
//                 case ModelClass.LARGE:
//                     model = runtime.getSetting("TOGETHER_MODEL_LARGE") || model;
//                     break;
//                 case ModelClass.SMALL:
//                     model = runtime.getSetting("TOGETHER_MODEL_SMALL") || model;
//                     break;
//             }
//         } break;
//         case ModelProviderName.OPENROUTER: {
//             switch (modelClass) {
//                 case ModelClass.LARGE:
//                     model = runtime.getSetting("LARGE_OPENROUTER_MODEL") || model;
//                     break;
//                 case ModelClass.SMALL:
//                     model = runtime.getSetting("SMALL_OPENROUTER_MODEL") || model;
//                     break;
//             }
//         } break;
//     }

//     elizaLogger.info("Selected model:", model);

//     const temperature = 0.6;
//     const frequency_penalty = 0.0;
//     const presence_penalty = 0.0;
//     const max_context_length = 128000;
//     const max_response_length = 8192;

//     const apiKey = runtime.token;
//     const effectiveStop = stop || models[provider].settings.stop;

//     try {
//         context = await trimTokens(context, max_context_length, runtime);
//         let response: string;

//         switch (provider) {
//             case ModelProviderName.OPENAI:
//             case ModelProviderName.ALI_BAILIAN:
//             case ModelProviderName.VOLENGINE:
//             case ModelProviderName.LLAMACLOUD:
//             case ModelProviderName.NANOGPT:
//             case ModelProviderName.HYPERBOLIC:
//             case ModelProviderName.TOGETHER:
//             case ModelProviderName.AKASH_CHAT_API: {
//                 const openai = createOpenAI({
//                     apiKey,
//                     baseURL: endpoint,
//                     fetch: runtime.fetch,
//                 });

//                 const { text } = await aiGenerateText({
//                     model: openai.languageModel(model),
//                     prompt: context,
//                     system: runtime.character.system ?? settings.SYSTEM_PROMPT ?? undefined,
//                     tools,
//                     onStepFinish,
//                     maxSteps,
//                     temperature,
//                     maxTokens: max_response_length,
//                     frequencyPenalty: frequency_penalty,
//                     presencePenalty: presence_penalty,
//                     stopSequences: effectiveStop,
//                 });

//                 response = text;
//                 break;
//             }
//             case ModelProviderName.ETERNALAI: {
//                 elizaLogger.debug("Initializing EternalAI model.");
//                 const openai = createOpenAI({
//                     apiKey,
//                     baseURL: endpoint,
//                     fetch: async (url: string, options: any) => {
//                         const fetching = await runtime.fetch(url, options);
//                         if (parseBooleanFromText(runtime.getSetting("ETERNAL_AI_LOG_REQUEST"))) {
//                             elizaLogger.info("Request data: ", JSON.stringify(options, null, 2));
//                             const clonedResponse = fetching.clone();
//                             clonedResponse.json().then((data) => {
//                                 elizaLogger.info("Response data: ", JSON.stringify(data, null, 2));
//                             });
//                         }
//                         return fetching;
//                     },
//                 });

//                 const { text } = await aiGenerateText({
//                     model: openai.languageModel(model),
//                     prompt: context,
//                     system: runtime.character.system ?? settings.SYSTEM_PROMPT ?? undefined,
//                     temperature,
//                     maxTokens: max_response_length,
//                     frequencyPenalty: frequency_penalty,
//                     presencePenalty: presence_penalty,
//                     stopSequences: effectiveStop,
//                 });

//                 response = text;
//                 break;
//             }
//             case ModelProviderName.ANTHROPIC: {
//                 elizaLogger.debug("Initializing Anthropic model.");
//                 const anthropic = createAnthropic({
//                     apiKey,
//                     fetch: runtime.fetch,
//                 });

//                 const { text } = await aiGenerateText({
//                     model: anthropic.languageModel(model),
//                     prompt: context,
//                     system: runtime.character.system ?? settings.SYSTEM_PROMPT ?? undefined,
//                     tools,
//                     onStepFinish,
//                     maxSteps,
//                     temperature,
//                     maxTokens: max_response_length,
//                     frequencyPenalty: frequency_penalty,
//                     presencePenalty: presence_penalty,
//                     stopSequences: effectiveStop,
//                 });

//                 response = text;
//                 break;
//             }
//             case ModelProviderName.GOOGLE: {
//                 const google = createGoogleGenerativeAI({
//                     apiKey,
//                     fetch: runtime.fetch,
//                 });

//                 const { text } = await aiGenerateText({
//                     model: google(model),
//                     prompt: context,
//                     system: runtime.character.system ?? settings.SYSTEM_PROMPT ?? undefined,
//                     tools,
//                     onStepFinish,
//                     maxSteps,
//                     temperature,
//                     maxTokens: max_response_length,
//                     frequencyPenalty: frequency_penalty,
//                     presencePenalty: presence_penalty,
//                     stopSequences: effectiveStop,
//                 });

//                 response = text;
//                 break;
//             }
//             case ModelProviderName.CLAUDE_VERTEX: {
//                 elizaLogger.debug("Initializing Claude Vertex model.");
//                 const anthropic = createAnthropic({
//                     apiKey,
//                     fetch: runtime.fetch,
//                 });

//                 const { text } = await aiGenerateText({
//                     model: anthropic.languageModel(model),
//                     prompt: context,
//                     system: runtime.character.system ?? settings.SYSTEM_PROMPT ?? undefined,
//                     tools,
//                     onStepFinish,
//                     maxSteps,
//                     temperature,
//                     maxTokens: max_response_length,
//                     frequencyPenalty: frequency_penalty,
//                     presencePenalty: presence_penalty,
//                     stopSequences: effectiveStop,
//                 });

//                 response = text;
//                 break;
//             }
//             case ModelProviderName.GROK: {
//                 elizaLogger.debug("Initializing Grok model.");
//                 const grok = createOpenAI({
//                     apiKey,
//                     baseURL: endpoint,
//                     fetch: runtime.fetch,
//                 });

//                 const { text } = await aiGenerateText({
//                     model: grok.languageModel(model, { parallelToolCalls: false }),
//                     prompt: context,
//                     system: runtime.character.system ?? settings.SYSTEM_PROMPT ?? undefined,
//                     tools,
//                     onStepFinish,
//                     maxSteps,
//                     temperature,
//                     maxTokens: max_response_length,
//                     frequencyPenalty: frequency_penalty,
//                     presencePenalty: presence_penalty,
//                     stopSequences: effectiveStop,
//                 });

//                 response = text;
//                 break;
//             }
//             case ModelProviderName.LLAMALOCAL: {
//                 elizaLogger.debug("Using local Llama model for text completion.");
//                 const textGenerationService = runtime.getService<ITextGenerationService>(ServiceType.TEXT_GENERATION);

//                 if (!textGenerationService) {
//                     throw new Error("Text generation service not found");
//                 }

//                 response = await textGenerationService.queueTextCompletion(
//                     context,
//                     temperature,
//                     effectiveStop,
//                     frequency_penalty,
//                     presence_penalty,
//                     max_response_length
//                 );
//                 break;
//             }
//             case ModelProviderName.REDPILL:
//             case ModelProviderName.OPENROUTER:
//             case ModelProviderName.VENICE:
//             case ModelProviderName.HEURIST:
//             case ModelProviderName.GALADRIEL:
//             case ModelProviderName.GAIANET: {
//                 elizaLogger.debug(`Initializing ${provider} model.`);
//                 const client = createOpenAI({
//                     apiKey,
//                     baseURL: endpoint,
//                     fetch: runtime.fetch,
//                 });

//                 const { text } = await aiGenerateText({
//                     model: client.languageModel(model),
//                     prompt: context,
//                     system: customSystemPrompt ?? runtime.character.system ?? settings.SYSTEM_PROMPT ?? undefined,
//                     tools,
//                     onStepFinish,
//                     maxSteps,
//                     temperature,
//                     maxTokens: max_response_length,
//                     frequencyPenalty: frequency_penalty,
//                     presencePenalty: presence_penalty,
//                     stopSequences: effectiveStop,
//                 });

//                 response = text;
//                 break;
//             }
//             default: {
//                 throw new Error(`Unsupported provider: ${provider}`);
//             }
//         }

//         return response;
//     } catch (error) {
//         elizaLogger.error("Error in generateText:", error);
//         throw error;
//     }
// }

// // --- generateMessageResponse Function ---
// export async function generateMessageResponse({
//     runtime,
//     context,
//     modelClass,
// }: {
//     runtime: IAgentRuntime;
//     context: string;
//     modelClass: ModelClass;
// }): Promise<Content> {
//     const provider = runtime.modelProvider;
//     const max_context_length = 8192;

//     // Add the chain-of-thought structure to the context
//     const cotPrompt = `
// Step-by-step Reasoning:
// 1. Key Elements:
// 2. Problem Breakdown:
// 3. Analysis:
// 4. Preliminary Conclusion:

// Final Response:`;

//     const enhancedContext = context + "\n" + cotPrompt;
//     const trimmedContext = await trimTokens(enhancedContext, max_context_length, runtime);

//     let retryLength = 1000;
//     while (true) {
//         try {
//             elizaLogger.log("Generating message response...");

//             const response = await generateText({
//                 runtime,
//                 context: trimmedContext,
//                 modelClass,
//                 stop: []
//             });

//             elizaLogger.info("Response:", JSON.stringify(response, null, 2));

//             // Split response into reasoning and content
//             const [reasoning, finalResponse] = response.split("Final Response:");
//             // Parse the final response as JSON
//             const parsedContent = parseJSONObjectFromText(finalResponse?.trim()) as Content;
//             if (!parsedContent) {
//                 elizaLogger.debug("parsedContent is null, retrying");
//                 continue;
//             }

//             // Add reasoning to metadata and return
//             return {
//                 ...parsedContent,
//                 reasoning: reasoning?.trim() || "",
//             };
//         } catch (error: any) {
//             elizaLogger.error("Error generating message response:", error.message);
//             retryLength *= 2;
//             await new Promise((resolve) => setTimeout(resolve, retryLength));
//             elizaLogger.debug("Retrying...");
//         }
//     }
// }

// export class DirectClient {
//     public app: express.Application;
//     private agents: Map<string, AgentRuntime>; // container management
//     private server: any; // Store server instance
//     public startAgent: Function; // Store startAgent functor

//     constructor() {
//         elizaLogger.log("DirectClient constructor");
//         this.app = express();
//         this.app.use(cors());
//         this.agents = new Map();

//         this.app.use(bodyParser.json());
//         this.app.use(bodyParser.urlencoded({ extended: true }));

//         // Serve both uploads and generated images
//         this.app.use(
//             "/media/uploads",
//             express.static(path.join(process.cwd(), "/data/uploads"))
//         );
//         this.app.use(
//             "/media/generated",
//             express.static(path.join(process.cwd(), "/generatedImages"))
//         );

//         const apiRouter = createApiRouter(this.agents, this);
//         this.app.use(apiRouter);

//         // Define an interface that extends the Express Request interface
//         interface CustomRequest extends ExpressRequest {
//             file?: Express.Multer.File;
//         }

//         // Update the route handler to use CustomRequest instead of express.Request
//         this.app.post(
//             "/:agentId/whisper",
//             upload.single("file"),
//             async (req: CustomRequest, res: express.Response) => {
//                 const audioFile = req.file; // Access the uploaded file using req.file
//                 const agentId = req.params.agentId;

//                 if (!audioFile) {
//                     res.status(400).send("No audio file provided");
//                     return;
//                 }

//                 let runtime = this.agents.get(agentId);

//                 // if runtime is null, look for runtime with the same name
//                 if (!runtime) {
//                     runtime = Array.from(this.agents.values()).find(
//                         (a) =>
//                             a.character.name.toLowerCase() ===
//                             agentId.toLowerCase()
//                     );
//                 }

//                 if (!runtime) {
//                     res.status(404).send("Agent not found");
//                     return;
//                 }

//                 const formData = new FormData();
//                 const audioBlob = new Blob([audioFile.buffer], {
//                     type: audioFile.mimetype,
//                 });
//                 formData.append("file", audioBlob, audioFile.originalname);
//                 formData.append("model", "whisper-1");

//                 const response = await fetch(
//                     "https://api.openai.com/v1/audio/transcriptions",
//                     {
//                         method: "POST",
//                         headers: {
//                             Authorization: `Bearer ${runtime.token}`,
//                         },
//                         body: formData,
//                     }
//                 );

//                 const data = await response.json();
//                 res.json(data);
//             }
//         );

//         this.app.post(
//             "/:agentId/message",
//             upload.single("file"),
//             async (req: express.Request, res: express.Response) => {
//                 const agentId = req.params.agentId;
//                 const roomId = stringToUuid(
//                     req.body.roomId ?? "default-room-" + agentId
//                 );
//                 const userId = stringToUuid(req.body.userId ?? "user");

//                 let runtime = this.agents.get(agentId);

//                 // if runtime is null, look for runtime with the same name
//                 if (!runtime) {
//                     runtime = Array.from(this.agents.values()).find(
//                         (a) =>
//                             a.character.name.toLowerCase() ===
//                             agentId.toLowerCase()
//                     );
//                 }

//                 if (!runtime) {
//                     res.status(404).send("Agent not found");
//                     return;
//                 }

//                 await runtime.ensureConnection(
//                     userId,
//                     roomId,
//                     req.body.userName,
//                     req.body.name,
//                     "direct"
//                 );

//                 const text = req.body.text;
//                 const messageId = stringToUuid(Date.now().toString());

//                 const attachments: Media[] = [];
//                 if (req.file) {
//                     const filePath = path.join(
//                         process.cwd(),
//                         "data",
//                         "uploads",
//                         req.file.filename
//                     );
//                     attachments.push({
//                         id: Date.now().toString(),
//                         url: filePath,
//                         title: req.file.originalname,
//                         source: "direct",
//                         description: `Uploaded file: ${req.file.originalname}`,
//                         text: "",
//                         contentType: req.file.mimetype,
//                     });
//                 }

//                 const content: Content = {
//                     text,
//                     attachments,
//                     source: "direct",
//                     inReplyTo: undefined,
//                 };

//                 const userMessage = {
//                     content,
//                     userId,
//                     roomId,
//                     agentId: runtime.agentId,
//                 };

//                 const memory: Memory = {
//                     id: stringToUuid(messageId + "-" + userId),
//                     ...userMessage,
//                     agentId: runtime.agentId,
//                     userId,
//                     roomId,
//                     content,
//                     createdAt: Date.now(),
//                 };

//                 // Extract options (assuming it's coming from some configuration)
//                 const options = {
//                     temperature: 0.7,
//                     max_tokens: 500,
//                     stop: ["Final Response:"],
//                     prompt_addition: "\nThink step-by-step. Provide reasoning before responding"
//                 };

//                 // Modify memory before calling createMemory
//                 const updatedMemory: Memory = {
//                     ...memory,  // Your existing memory object
//                     content: {
//                         ...memory.content,
//                         text: `${options.prompt_addition}\n${memory.content.text}` // Append prompt addition
//                     }
//                 };

//                 await runtime.messageManager.addEmbeddingToMemory(updatedMemory);
//                 await runtime.messageManager.createMemory(updatedMemory);

//                 let state = await runtime.composeState(userMessage, {
//                     agentName: runtime.character.name,
//                 });

//                 const context = composeContext({
//                     state,
//                     template: messageHandlerTemplate,
//                 });

//                 const response = await generateMessageResponse({
//                     runtime: runtime,
//                     context,
//                     modelClass: ModelClass.LARGE,
//                 });

//                 if (!response) {
//                     res.status(500).send(
//                         "No response from generateMessageResponse"
//                     );
//                     return;
//                 }

//                 // save response to memory
//                 const responseMessage: Memory = {
//                     id: stringToUuid(messageId + "-" + runtime.agentId),
//                     ...userMessage,
//                     userId: runtime.agentId,
//                     content: response,
//                     embedding: getEmbeddingZeroVector(),
//                     createdAt: Date.now(),
//                 };

//                 await runtime.messageManager.createMemory(responseMessage);

//                 state = await runtime.updateRecentMessageState(state);

//                 let message = null as Content | null;

//                 await runtime.processActions(
//                     memory,
//                     [responseMessage],
//                     state,
//                     async (newMessages) => {
//                         message = newMessages;
//                         return [memory];
//                     }
//                 );

//                 await runtime.evaluate(memory, state);

//                 // Check if we should suppress the initial message
//                 const action = runtime.actions.find(
//                     (a) => a.name === response.action
//                 );
//                 const shouldSuppressInitialMessage =
//                     action?.suppressInitialMessage;

//                 if (!shouldSuppressInitialMessage) {
//                     if (message) {
//                         res.json([response, message]);
//                     } else {
//                         res.json([response]);
//                     }
//                 } else {
//                     if (message) {
//                         res.json([message]);
//                     } else {
//                         res.json([]);
//                     }
//                 }
//             }
//         );

//         this.app.post(
//             "/:agentId/image",
//             async (req: express.Request, res: express.Response) => {
//                 const agentId = req.params.agentId;
//                 const agent = this.agents.get(agentId);
//                 if (!agent) {
//                     res.status(404).send("Agent not found");
//                     return;
//                 }

//                 const images = await generateImage({ ...req.body }, agent);
//                 const imagesRes: { image: string; caption: string }[] = [];
//                 if (images.data && images.data.length > 0) {
//                     for (let i = 0; i < images.data.length; i++) {
//                         const caption = await generateCaption(
//                             { imageUrl: images.data[i] },
//                             agent
//                         );
//                         imagesRes.push({
//                             image: images.data[i],
//                             caption: caption.title,
//                         });
//                     }
//                 }
//                 res.json({ images: imagesRes });
//             }
//         );

//         this.app.post(
//             "/fine-tune",
//             async (req: express.Request, res: express.Response) => {
//                 try {
//                     const response = await fetch(
//                         "https://api.bageldb.ai/api/v1/asset",
//                         {
//                             method: "POST",
//                             headers: {
//                                 "Content-Type": "application/json",
//                                 "X-API-KEY": `${process.env.BAGEL_API_KEY}`,
//                             },
//                             body: JSON.stringify(req.body),
//                         }
//                     );

//                     const data = await response.json();
//                     res.json(data);
//                 } catch (error) {
//                     res.status(500).json({
//                         error: "Please create an account at bakery.bagel.net and get an API key. Then set the BAGEL_API_KEY environment variable.",
//                         details: error.message,
//                     });
//                 }
//             }
//         );
//         this.app.get(
//             "/fine-tune/:assetId",
//             async (req: express.Request, res: express.Response) => {
//                 const assetId = req.params.assetId;
//                 const downloadDir = path.join(
//                     process.cwd(),
//                     "downloads",
//                     assetId
//                 );

//                 console.log("Download directory:", downloadDir);

//                 try {
//                     console.log("Creating directory...");
//                     await fs.promises.mkdir(downloadDir, { recursive: true });

//                     console.log("Fetching file...");
//                     const fileResponse = await fetch(
//                         `https://api.bageldb.ai/api/v1/asset/${assetId}/download`,
//                         {
//                             headers: {
//                                 "X-API-KEY": `${process.env.BAGEL_API_KEY}`,
//                             },
//                         }
//                     );

//                     if (!fileResponse.ok) {
//                         throw new Error(
//                             `API responded with status ${fileResponse.status}: ${await fileResponse.text()}`
//                         );
//                     }

//                     console.log("Response headers:", fileResponse.headers);

//                     const fileName =
//                         fileResponse.headers
//                             .get("content-disposition")
//                             ?.split("filename=")[1]
//                             ?.replace(/"/g, /* " */ "") || "default_name.txt";

//                     console.log("Saving as:", fileName);

//                     const arrayBuffer = await fileResponse.arrayBuffer();
//                     const buffer = Buffer.from(arrayBuffer);

//                     const filePath = path.join(downloadDir, fileName);
//                     console.log("Full file path:", filePath);

//                     await fs.promises.writeFile(filePath, buffer);

//                     // Verify file was written
//                     const stats = await fs.promises.stat(filePath);
//                     console.log(
//                         "File written successfully. Size:",
//                         stats.size,
//                         "bytes"
//                     );

//                     res.json({
//                         success: true,
//                         message: "Single file downloaded successfully",
//                         downloadPath: downloadDir,
//                         fileCount: 1,
//                         fileName: fileName,
//                         fileSize: stats.size,
//                     });
//                 } catch (error) {
//                     console.error("Detailed error:", error);
//                     res.status(500).json({
//                         error: "Failed to download files from BagelDB",
//                         details: error.message,
//                         stack: error.stack,
//                     });
//                 }
//             }
//         );

//         this.app.post("/:agentId/speak", async (req, res) => {
//             const agentId = req.params.agentId;
//             const roomId = stringToUuid(req.body.roomId ?? "default-room-" + agentId);
//             const userId = stringToUuid(req.body.userId ?? "user");
//             const text = req.body.text;

//             if (!text) {
//                 res.status(400).send("No text provided");
//                 return;
//             }

//             let runtime = this.agents.get(agentId);

//             // if runtime is null, look for runtime with the same name
//             if (!runtime) {
//                 runtime = Array.from(this.agents.values()).find(
//                     (a) => a.character.name.toLowerCase() === agentId.toLowerCase()
//                 );
//             }

//             if (!runtime) {
//                 res.status(404).send("Agent not found");
//                 return;
//             }

//             try {
//                 // Process message through agent (same as /message endpoint)
//                 await runtime.ensureConnection(
//                     userId,
//                     roomId,
//                     req.body.userName,
//                     req.body.name,
//                     "direct"
//                 );

//                 const messageId = stringToUuid(Date.now().toString());

//                 const content: Content = {
//                     text,
//                     attachments: [],
//                     source: "direct",
//                     inReplyTo: undefined,
//                 };

//                 const userMessage = {
//                     content,
//                     userId,
//                     roomId,
//                     agentId: runtime.agentId,
//                 };

//                 const memory: Memory = {
//                     id: messageId,
//                     agentId: runtime.agentId,
//                     userId,
//                     roomId,
//                     content,
//                     createdAt: Date.now(),
//                 };

//                 await runtime.messageManager.createMemory(memory);

//                 const state = await runtime.composeState(userMessage, {
//                     agentName: runtime.character.name,
//                 });

//                 const context = composeContext({
//                     state,
//                     template: messageHandlerTemplate,
//                 });

//                 const response = await generateMessageResponse({
//                     runtime: runtime,
//                     context,
//                     modelClass: ModelClass.LARGE,
//                 });

//                 // save response to memory
//                 const responseMessage = {
//                     ...userMessage,
//                     userId: runtime.agentId,
//                     content: response,
//                 };

//                 await runtime.messageManager.createMemory(responseMessage);

//                 if (!response) {
//                     res.status(500).send("No response from generateMessageResponse");
//                     return;
//                 }

//                 await runtime.evaluate(memory, state);

//                 const _result = await runtime.processActions(
//                     memory,
//                     [responseMessage],
//                     state,
//                     async () => {
//                         return [memory];
//                     }
//                 );

//                 // Get the text to convert to speech
//                 const textToSpeak = response.text;

//                 // Convert to speech using ElevenLabs
//                 const elevenLabsApiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`;
//                 const apiKey = process.env.ELEVENLABS_XI_API_KEY;

//                 if (!apiKey) {
//                     throw new Error("ELEVENLABS_XI_API_KEY not configured");
//                 }

//                 const speechResponse = await fetch(elevenLabsApiUrl, {
//                     method: "POST",
//                     headers: {
//                         "Content-Type": "application/json",
//                         "xi-api-key": apiKey,
//                     },
//                     body: JSON.stringify({
//                         text: textToSpeak,
//                         model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
//                         voice_settings: {
//                             stability: parseFloat(process.env.ELEVENLABS_VOICE_STABILITY || "0.5"),
//                             similarity_boost: parseFloat(process.env.ELEVENLABS_VOICE_SIMILARITY_BOOST || "0.9"),
//                             style: parseFloat(process.env.ELEVENLABS_VOICE_STYLE || "0.66"),
//                             use_speaker_boost: process.env.ELEVENLABS_VOICE_USE_SPEAKER_BOOST === "true",
//                         },
//                     }),
//                 });

//                 if (!speechResponse.ok) {
//                     throw new Error(`ElevenLabs API error: ${speechResponse.statusText}`);
//                 }

//                 const audioBuffer = await speechResponse.arrayBuffer();

//                 // Set appropriate headers for audio streaming
//                 res.set({
//                     'Content-Type': 'audio/mpeg',
//                     'Transfer-Encoding': 'chunked'
//                 });

//                 res.send(Buffer.from(audioBuffer));

//             } catch (error) {
//                 console.error("Error processing message or generating speech:", error);
//                 res.status(500).json({
//                     error: "Error processing message or generating speech",
//                     details: error.message
//                 });
//             }
//         });
//     }

//     // agent/src/index.ts:startAgent calls this
//     public registerAgent(runtime: AgentRuntime) {
//         this.agents.set(runtime.agentId, runtime);
//     }

//     public unregisterAgent(runtime: AgentRuntime) {
//         this.agents.delete(runtime.agentId);
//     }

//     public start(port: number) {
//         this.server = this.app.listen(port, () => {
//             elizaLogger.success(
//                 `REST API bound to 0.0.0.0:${port}. If running locally, access it at http://localhost:${port}.`
//             );
//         });

//         // Handle graceful shutdown
//         const gracefulShutdown = () => {
//             elizaLogger.log("Received shutdown signal, closing server...");
//             this.server.close(() => {
//                 elizaLogger.success("Server closed successfully");
//                 process.exit(0);
//             });

//             // Force close after 5 seconds if server hasn't closed
//             setTimeout(() => {
//                 elizaLogger.error(
//                     "Could not close connections in time, forcefully shutting down"
//                 );
//                 process.exit(1);
//             }, 5000);
//         };

//         // Handle different shutdown signals
//         process.on("SIGTERM", gracefulShutdown);
//         process.on("SIGINT", gracefulShutdown);
//     }

//     public stop() {
//         if (this.server) {
//             this.server.close(() => {
//                 elizaLogger.success("Server stopped");
//             });
//         }
//     }
// }

// export const DirectClientInterface: Client = {
//     start: async (_runtime: IAgentRuntime) => {
//         elizaLogger.log("DirectClientInterface start");
//         const client = new DirectClient();
//         const serverPort = parseInt(settings.SERVER_PORT || "3000");
//         client.start(serverPort);
//         return client;
//     },
//     stop: async (_runtime: IAgentRuntime, client?: Client) => {
//         if (client instanceof DirectClient) {
//             client.stop();
//         }
//     },
// };

// export default DirectClientInterface;


