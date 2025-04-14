declare module 'openai' {
  export default class OpenAI {
    constructor(options: { apiKey: string });
    chat: {
      completions: {
        create(params: {
          model: string;
          messages: Array<{
            role: 'system' | 'user' | 'assistant';
            content: string;
          }>;
          max_tokens?: number;
          temperature?: number;
        }): Promise<{
          choices: Array<{
            message?: {
              content?: string;
            };
          }>;
        }>;
      };
    };
  }
}
