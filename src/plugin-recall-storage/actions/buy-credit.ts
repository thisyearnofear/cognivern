import {
    type Action,
    type IAgentRuntime,
    type Memory,
    type State,
    type HandlerCallback,
    type ActionExample,
    elizaLogger,
    ServiceType,
} from "@elizaos/core";
import { RecallService } from "../services/recall.service";
import e from "cors";

const keywords = [
    "buy",
    "credit",
    "credits",
    "purchase",
    "add",
    "add credit",
    "add credits",
]

export const buyCreditAction: Action = {
    name: "BUY_CREDIT",
    similes: ["BUY_CREDIT",
        "buy credit",
        "buy credits",
        "purchase credit",
        "purchase credits",
        "add credit",
        "add credits",
        "ADD_CREDIT",
        "RELOAD_CREDIT",
        "PURCHASE_CREDIT",
        "BUY RECALL CREDITS",
        "GET MORE CREDITS",
        "RECHARGE ACCOUNT"],
    validate: async (_runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text.toLowerCase();
        const amountMatch = text.match(/([\d.]+)/);

        elizaLogger.info(`BUY_CREDIT Validation: Extracted amount: ${amountMatch ? amountMatch[1] : "None"}`);

        if (!amountMatch) {
            return false;
        }

        const amount = parseFloat(amountMatch[1]);
        if (isNaN(amount) || amount <= 0) {
            elizaLogger.error("BUY_CREDIT failed: Invalid amount.");
            return false;
        }

        // Now check for any matching keywords
        if (!keywords.some(keyword => text.includes(keyword))) {
            elizaLogger.error("BUY_CREDIT failed: No valid keyword found in message.");
            return false;
        }

        elizaLogger.info(`BUY_CREDIT Validation Passed! Amount: ${amount}`);
        return true;
    },
    description: "Buys Recall credits for the agent's wallet",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        const recallService = runtime.services.get("recall" as ServiceType) as RecallService;
        elizaLogger.info(`BUY_CREDIT Handler: ${message.content.text}`);
        const text = message.content.text.trim();
        const amountMatch = text.match(/([\d.]+)/);
        if (!amountMatch) {
            callback?.({ text: "Invalid credit request. Please specify an amount." });
            return false;
        }

        const amount = parseFloat(amountMatch[1]);
        if (isNaN(amount) || amount <= 0) {
            callback?.({ text: "Invalid credit amount. Please enter a number greater than 0." });
            return false;
        }

        try {
            elizaLogger.info(`Attempting to purchase ${amount} credits...`);

            // Call RecallService to buy credit
            const result = await recallService.buyCredit(amount.toString());

            if (result) {
                elizaLogger.info(`Successfully purchased ${amount} credits.`);
                callback?.({
                    text: `✅ Successfully purchased ${amount} Recall credits!`,
                    action: "BUY_CREDIT",
                });
            } else {
                elizaLogger.error("BUY_CREDIT failed: No response from RecallService.");
                callback?.({ text: "❌ Credit purchase failed. Please try again later." });
            }
        } catch (error) {
            elizaLogger.error(`BUY_CREDIT error: ${error.message}`);
            callback?.({ text: "⚠️ An error occurred while purchasing credits. Please try again later." });
        }

        return true;
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Please buy 0.1 credits for my account" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Buying 0.1 credits for your account now...",
                    action: "BUY_CREDIT",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Please purchase 1.5 credits for my account" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Purchasing 1.5 credits for your account now...",
                    action: "BUY_CREDIT",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Please add 3 credits to my account" },
            },
            {
                user: "{{agentName}}",
                content: {
                    text: "Adding 3 credits to your account now...",
                    action: "BUY_CREDIT",
                },
            },
        ],
    ] as ActionExample[][],
};
