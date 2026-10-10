/**
 * Backgrounding contract: silence everything, then help the lesson reconnect.
 *
 * The core app owns its Gemini Live session, its AudioContext and its
 * MediaStream. Rather than threading refs through 3000 lines of App.tsx, this
 * module observes the *platform* events and reaches the two browser-level
 * resources directly, by registering them at creation time:
 *
 *   - `AudioContext` is wrapped once, at startup, so every context the app
 *     creates (chalk sounds, TTS playback) is known and can be suspended.
 *   - `navigator.mediaDevices.getUserMedia` is wrapped so live microphone
 *     tracks are known and can be muted (track.enabled = false keeps the
 *     peer connection alive but stops sending audio).
 *
 * On pause  : suspend contexts, mute mic tracks.
 * On resume : resume what we suspended, unmute, and dispatch
 *             `maalam:session-resume` so the core app reconnects a dropped
 *             Gemini Live session and shows its status banner/toast.
 *
 * No audio can keep playing in the background because every context is
 * suspended synchronously in the pause handler.
 */
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

const contexts = new Set<AudioContext>();
const micTracks = new Set<MediaStreamTrack>();

let suspendedByUs = new Set<AudioContext>();
let mutedByUs = new Set<MediaStreamTrack>();
let visible = true;

/** Must run before the core app creates any audio. Called from main.tsx. */
export function installMediaTracking(): void {
  if (typeof window === "undefined") return;

  const OriginalAudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (OriginalAudioContext) {
    const Wrapped = class extends OriginalAudioContext {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args);
        contexts.add(this);
        this.addEventListener("close", () => contexts.delete(this));
      }
    } as typeof AudioContext;
    window.AudioContext = Wrapped;
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext = Wrapped;
  }

  if (navigator.mediaDevices?.getUserMedia) {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
      const stream = await original(constraints);
      for (const track of stream.getAudioTracks()) {
        micTracks.add(track);
        track.addEventListener("ended", () => micTracks.delete(track));
      }
      return stream;
    };
  }
}

function suspendAll(): void {
  suspendedByUs = new Set();
  for (const ctx of contexts) {
    if (ctx.state === "running") {
      suspendedByUs.add(ctx);
      void ctx.suspend().catch(() => undefined);
    }
  }
  mutedByUs = new Set();
  for (const track of micTracks) {
    if (track.readyState === "live" && track.enabled) {
      mutedByUs.add(track);
      track.enabled = false;
    }
  }
}

function resumeAll(): void {
  for (const ctx of suspendedByUs) {
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  }
  suspendedByUs = new Set();
  for (const track of mutedByUs) {
    if (track.readyState === "live") track.enabled = true;
  }
  mutedByUs = new Set();
}

export function isAppVisible(): boolean {
  return visible;
}

export async function initLifecycle(): Promise<void> {
  const pause = () => {
    visible = false;
    suspendAll();
  };
  const resume = () => {
    visible = true;
    resumeAll();
    // Ask the core app to bring its Gemini Live session back if it dropped.
    window.dispatchEvent(new CustomEvent("maalam:session-resume"));
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") pause();
    else resume();
  });

  if (Capacitor.isNativePlatform()) {
    try {
      await App.addListener("appStateChange", (state) => {
        if (!state.isActive) pause();
        else resume();
      });
    } catch {
      /* visibilitychange remains as the fallback */
    }
  }
}
