/**
 * SpeechController
 *
 * Proxies audio transcription to ElevenLabs Speech-to-Text API.
 * Accepts base64-encoded audio from the frontend, decodes, and
 * forwards to ElevenLabs Scribe v2 for high-accuracy transcription.
 */

import { Request, Response } from "express";
import { Logger } from "@backend/shared/logging/Logger.js";

const logger = new Logger("SpeechController");

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";

export class SpeechController {
  /**
   * POST /api/speech/transcribe
   *
   * Body: { audio: string (base64), mimeType?: string }
   * Returns: { success: true, data: { text: string } }
   */
  async transcribe(req: Request, res: Response) {
    try {
      const { audio, mimeType } = req.body;

      if (!audio || typeof audio !== "string") {
        res.status(400).json({
          success: false,
          error: "Missing or invalid audio field (expected base64 string)",
        });
        return;
      }

      if (!ELEVENLABS_API_KEY) {
        logger.warn(
          "ELEVENLABS_API_KEY not set; falling back to browser STT message",
        );
        res.status(503).json({
          success: false,
          error:
            "Speech-to-text is not configured on this instance. Set ELEVENLABS_API_KEY.",
        });
        return;
      }

      // Decode base64 to buffer
      const audioBuffer = Buffer.from(audio, "base64");
      if (audioBuffer.length === 0) {
        res.status(400).json({
          success: false,
          error: "Empty audio buffer",
        });
        return;
      }

      // Build multipart form data manually so we don't need multer/busboy
      const boundary = `----formdata-${Date.now()}`;
      const bodyParts: Buffer[] = [];

      // model_id field
      bodyParts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="model_id"\r\n\r\nscribe_v2\r\n`,
          "utf-8",
        ),
      );

      // tag_audio_events field (include non-speech sounds in transcript)
      bodyParts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="tag_audio_events"\r\n\r\ntrue\r\n`,
          "utf-8",
        ),
      );

      // audio file field
      const ext =
        mimeType === "audio/webm"
          ? "webm"
          : mimeType === "audio/mp4"
            ? "mp4"
            : "webm";
      bodyParts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="recording.${ext}"\r\nContent-Type: ${mimeType || "audio/webm"}\r\n\r\n`,
          "utf-8",
        ),
      );
      bodyParts.push(audioBuffer);
      bodyParts.push(Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8"));

      const body = Buffer.concat(bodyParts);

      logger.info(`Forwarding ${audioBuffer.length} bytes to ElevenLabs STT`);

      const response = await fetch(ELEVENLABS_STT_URL, {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.error(`ElevenLabs STT error ${response.status}: ${errText}`);
        res.status(502).json({
          success: false,
          error: `Transcription service error: ${response.status}`,
        });
        return;
      }

      const data = await response.json();
      const text = typeof data.text === "string" ? data.text : "";

      res.json({
        success: true,
        data: { text, language: data.language_code || "en" },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Speech transcription failed", error);
      res.status(500).json({
        success: false,
        error: error.message || "Transcription failed",
        timestamp: new Date().toISOString(),
      });
    }
  }
}
