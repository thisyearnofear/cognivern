import { beforeEach, describe, expect, it, vi } from "vitest";

class FakeAudioContext {
  static instances = 0;
  state = "running";
  sampleRate = 48000;
  destination = {};

  constructor() {
    FakeAudioContext.instances += 1;
  }

  createGain() {
    return {
      gain: { value: 0 },
      connect: vi.fn(),
    };
  }

  resume() {
    return Promise.resolve();
  }
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

function setUserGesture(hasBeenActive: boolean) {
  Object.defineProperty(window.navigator, "userActivation", {
    configurable: true,
    value: { hasBeenActive, isActive: hasBeenActive },
  });
}

async function importSound() {
  return import("@/lib/tactile-sound");
}

describe("tactile sound gate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("localStorage", memoryStorage());
    FakeAudioContext.instances = 0;
    setUserGesture(true);
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      writable: true,
      value: FakeAudioContext,
    });
  });

  it("is muted unless every gate is open", () => {
    return importSound().then(({ tactileSoundAllowed }) => {
      expect(
        tactileSoundAllowed({ enabled: false, hasUserGesture: true, reducedMotion: false }),
      ).toBe(false);
      expect(
        tactileSoundAllowed({ enabled: true, hasUserGesture: false, reducedMotion: false }),
      ).toBe(false);
      expect(
        tactileSoundAllowed({ enabled: true, hasUserGesture: true, reducedMotion: true }),
      ).toBe(false);
      expect(
        tactileSoundAllowed({ enabled: true, hasUserGesture: true, reducedMotion: false }),
      ).toBe(true);
    });
  });

  it("does not create AudioContext while sound is disabled", async () => {
    const { primeTactileSound, playSeal } = await importSound();
    primeTactileSound();
    playSeal();
    expect(FakeAudioContext.instances).toBe(0);
  });

  it("does not create AudioContext before any user gesture", async () => {
    setUserGesture(false);
    const { setSoundEnabled, primeTactileSound } = await importSound();
    setSoundEnabled(true);
    primeTactileSound();
    expect(FakeAudioContext.instances).toBe(0);
  });

  it("creates the lazy context only after opt-in plus a user gesture", async () => {
    const { setSoundEnabled, primeTactileSound, isSoundEnabled } = await importSound();
    setSoundEnabled(true);
    primeTactileSound();
    expect(isSoundEnabled()).toBe(true);
    expect(FakeAudioContext.instances).toBe(1);
  });

  it("follows the persisted preferences store flag", async () => {
    const [{ usePreferencesStore }, { isSoundEnabled }] = await Promise.all([
      import("@/stores/preferences-store"),
      importSound(),
    ]);
    expect(usePreferencesStore.getState().soundEnabled).toBe(false);
    usePreferencesStore.getState().updatePreferences({ soundEnabled: true });
    expect(isSoundEnabled()).toBe(true);
    usePreferencesStore.getState().updatePreferences({ soundEnabled: false });
    expect(isSoundEnabled()).toBe(false);
  });
});
