import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVoiceInput } from "@/hooks/use-voice-input";

vi.mock("@/lib/api-client", () => ({
  apiClient: { transcribeSpeech: vi.fn() },
}));

describe("useVoiceInput", () => {
  let mockGetUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();

    // Build a MediaRecorder class that uses a shared onstop handler
    // so test code can fire the callback to simulate the recorder finishing.
    const SharedOnstopHandler = { current: null as (() => void) | null };

    class MockMediaRecorder {
      static isTypeSupported = vi.fn().mockReturnValue(true);
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      state = "recording";
      ondataavailable: ((e: { data: Blob }) => void) | null = null;

      get onstop() { return SharedOnstopHandler.current; }
      set onstop(fn: (() => void) | null) { SharedOnstopHandler.current = fn; }

      constructor() {
        this.start = vi.fn();
        this.stop = vi.fn().mockImplementation(() => {
          if (SharedOnstopHandler.current) SharedOnstopHandler.current();
        });
      }
    }

    vi.stubGlobal("MediaRecorder", MockMediaRecorder);

    mockGetUserMedia = vi.fn().mockResolvedValue({
      getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }]),
    });

    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: mockGetUserMedia },
    });
  });

  it("returns initial idle state", () => {
    const { result } = renderHook(() => useVoiceInput());
    expect(result.current.recording).toBe(false);
    expect(result.current.transcribing).toBe(false);
  });

  it("starts recording and sets recording state", async () => {
    const { result } = renderHook(() => useVoiceInput());
    await act(async () => { await result.current.startRecording(); });
    expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(result.current.recording).toBe(true);
  });

  it("calls onError when microphone access is denied", async () => {
    const onError = vi.fn();
    mockGetUserMedia.mockRejectedValue(new Error("Permission denied"));
    const { result } = renderHook(() => useVoiceInput({ onError }));
    await act(async () => { await result.current.startRecording(); });
    expect(onError).toHaveBeenCalledWith("Permission denied");
    expect(result.current.recording).toBe(false);
  });

  it("toggles recording off when stopRecording is called", async () => {
    const { result } = renderHook(() => useVoiceInput());
    await act(async () => { await result.current.startRecording(); });
    expect(result.current.recording).toBe(true);

    // stopRecording should trigger onstop which sets recording to false
    await act(async () => { result.current.stopRecording(); });
    // The mock stop() fires onstop synchronously, which now calls setRecording(false)
    expect(result.current.recording).toBe(false);
  });
});
