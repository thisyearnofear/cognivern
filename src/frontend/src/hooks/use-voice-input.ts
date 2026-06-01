import { useState, useRef, useCallback } from "react";
import { apiClient } from "@/lib/api-client";

interface UseVoiceInputOptions {
  /** Called with the transcribed text when transcription succeeds */
  onResult?: (text: string) => void;
  /** Called with an error message when transcription fails */
  onError?: (error: string) => void;
}

interface UseVoiceInputReturn {
  recording: boolean;
  transcribing: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

/**
 * Shared hook for voice-to-text input via MediaRecorder + speech transcription API.
 * Duplicates the logic that was in both OsShell and GovernanceCheck components.
 */
export function useVoiceInput({
  onResult,
  onError,
}: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
    }
  }, [recording]);

  const startRecording = useCallback(async () => {
    if (recording) {
      stopRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : undefined;

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const blob = new Blob(recordedChunksRef.current, {
          type: mimeType || "audio/webm",
        });
        if (blob.size === 0) return;

        setTranscribing(true);
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);

          const res = await apiClient.transcribeSpeech({
            audio: base64,
            mimeType: mimeType || "audio/webm",
          });

          if (res.success && res.data?.text) {
            onResult?.(res.data.text);
          } else {
            onError?.(res.error || "Transcription failed");
          }
        } catch (err) {
          onError?.(
            err instanceof Error ? err.message : "Transcription failed",
          );
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      setRecording(true);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Microphone access denied");
    }
  }, [recording, stopRecording, onResult, onError]);

  return { recording, transcribing, startRecording, stopRecording };
}
