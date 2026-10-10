/**
 * Microphone permission UX.
 *
 * Capacitor's BridgeWebChromeClient already turns a WebView `getUserMedia`
 * request into a native RECORD_AUDIO prompt (BridgeWebChromeClient.java
 * onPermissionRequest), so the first-run dialog appears from the right place.
 * What it does not do is tell the user what happened when they say no.
 *
 * So we wrap getUserMedia once (see media-lifecycle.ts for the tracking part):
 * on a NotAllowedError we surface the phone shell's toast with an action that
 * opens this app's system settings screen, where the permission can be granted.
 *
 * Opening settings goes through a 40-line native plugin we own
 * (android/app/.../MaalamNativePlugin.java) instead of an npm dependency.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";

type MaalamNativePlugin = {
  openAppSettings(): Promise<void>;
  requestMicrophone(): Promise<{ granted: boolean }>;
};

/** Native-only plugin; resolves to a web stub everywhere else. */
export const MaalamNative = registerPlugin<MaalamNativePlugin>("MaalamNative");

export function canOpenAppSettings(): boolean {
  return Capacitor.isNativePlatform();
}

export async function openAppSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await MaalamNative.openAppSettings();
  } catch {
    /* ignore */
  }
}

/**
 * Pre-flight check used when the user taps the lesson button: if the OS will
 * show a prompt anyway we let the app's own getUserMedia call trigger it; if
 * the permission was permanently denied we go straight to the settings hint.
 */
export async function microphoneLikelyDenied(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { granted } = await MaalamNative.requestMicrophone();
    return !granted;
  } catch {
    return false;
  }
}

export function installMicDenialGuard(onDenied: (withSettingsAction: boolean) => void): void {
  const md = navigator.mediaDevices;
  if (!md?.getUserMedia) return;
  const original = md.getUserMedia.bind(md);
  md.getUserMedia = async (constraints?: MediaStreamConstraints) => {
    try {
      return await original(constraints);
    } catch (error) {
      const name = (error as { name?: string })?.name ?? "";
      if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
        onDenied(canOpenAppSettings());
      }
      throw error;
    }
  };
}
