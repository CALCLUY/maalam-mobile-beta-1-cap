/**
 * Native bootstrap. One entry point, called by main.tsx before anything paints.
 *
 * Order matters:
 *   1. hydrateStorage()      - the shell reads lang/apiKey/history synchronously.
 *   2. installMediaTracking()- wraps AudioContext/getUserMedia before the core
 *                              app creates its first context.
 *   3. initDevice()          - lite / reduced-motion flags for the first paint.
 *   4. initInsets()          - keyboard tracking + env() fallback props.
 *   5. initLifecycle()       - pause/resume contract.
 *   6. back button           - routes through the shell's overlay/view registry.
 *
 * On the web every native call is a no-op, so the same bundle powers the
 * reference screenshots.
 */
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { runBackHandlers } from "./back";
import { initDevice } from "./device";
import { hideKeyboard, initInsets } from "./insets";
import { initLifecycle, installMediaTracking } from "./media-lifecycle";
import { hydrateStorage, flushNow } from "./storage";
import { applyDeviceFlags } from "./device";

export { runBackHandlers, hasConsumingOverlay } from "./back";
export { overlayCount, topOverlayId } from "./overlays";
export { isLiteMode, setLitePreference, getLitePreference, readSettings } from "./device";
export { hapticsEnabled, setHapticsEnabled, tap as hapticTap, success as hapticSuccess, warn as hapticWarn } from "./haptics";
export { clearAllData, flushNow } from "./storage";
export { openAppSettings, installMicDenialGuard } from "./permissions";
export { hideKeyboard } from "./insets";
export { missingFeatures, showWebViewUpdateScreen } from "./webview";

let initialised = false;

export async function initPlatform(): Promise<void> {
  if (initialised) return;
  initialised = true;

  await hydrateStorage();
  installMediaTracking();
  initDevice();
  await initInsets();

  if (Capacitor.isNativePlatform()) {
    // Bars: light icons over the ink background, transparent so our own
    // background shows through on every Android version.
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: "#00000000" });
      await StatusBar.setOverlaysWebView({ overlay: true });
    } catch {
      /* non-fatal */
    }

    // Back button: overlays -> one UI step -> home -> exit. The registry owns
    // the priority; anything unhandled here means we are on the home screen.
    await App.addListener("backButton", () => {
      void hideKeyboard();
      if (runBackHandlers()) return;
      void flushNow().finally(() => void App.exitApp());
    });

    // Never leave half-written state behind when the OS kills us.
    document.addEventListener("pause", () => void flushNow());

    await initLifecycle();
  } else {
    // Web: visibilitychange path only.
    await initLifecycle();
  }

  applyDeviceFlags();
}

/** Hide the native splash once the first web frame is on screen. */
export async function hideNativeSplash(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SplashScreen.hide({ fadeOutDuration: 120 });
  } catch {
    /* already hidden */
  }
}
