/**
 * ElevenLabs Edge Service
 *
 * Lightweight, fetch-based service for ElevenLabs Text-to-Speech.
 * Designed to run in Cloudflare Workers environment.
 */

export interface ElevenLabsConfig {
  apiKey: string;
  voiceId?: string;
  modelId?: string;
}

export class ElevenLabsService {
  private config: ElevenLabsConfig;
  private readonly baseUrl = "https://api.elevenlabs.io/v1";

  constructor(config: ElevenLabsConfig) {
    this.config = {
      voiceId: "cjVigjM95V7v0V7W7xWp", // Default: "Aria" (Professional Female)
      modelId: "eleven_multilingual_v2",
      ...config,
    };
  }

  /**
   * Generate speech from text
   * Returns a Response with audio/mpeg content type
   */
  async generateSpeech(text: string): Promise<Response> {
    if (!this.config.apiKey) {
      throw new Error("ElevenLabs API key not configured");
    }

    const endpoint = `${this.baseUrl}/text-to-speech/${this.config.voiceId}/stream`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "xi-api-key": this.config.apiKey,
        "Content-Type": "application/json",
        "accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: this.config.modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
    }

    return response;
  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/voices`, {
      headers: {
        "xi-api-key": this.config.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    return response.json();
  }
}
