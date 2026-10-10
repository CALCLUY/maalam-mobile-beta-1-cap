/**
 * System-bar insets.
 *
 * Capacitor 8's SystemBars plugin (bundled with @capacitor/core) is the source
 * of truth: with `insetsHandling: "css"` it evaluates the real window insets on
 * the native side and writes
 *     --safe-area-inset-{top,right,bottom,left}
 * onto document.documentElement in CSS pixels (see
 * node_modules/@capacitor/android/.../plugin/SystemBars.java).
 *
 * Why not env(safe-area-inset-*)? On Android WebView < 140 those env() values
 * are wrong/absent (crbug 40699457), and even on newer WebViews the first
 * painted frame can see 0px. The injected variables are set before our first
 * layout settles, so the CSS chain is:
 *     var(--safe-area-inset-*) -> env(*) -> 0px
 *
 * This module only adds what the plugin cannot know:
 *   - html[data-keyboard] for CSS that hides decoration while typing;
 *   - --app-kb          keyboard height in CSS px (0 when hidden). INFORMATIVE
 *                       ONLY: it must never be added to layout padding. The
 *                       native WebView padding (Keyboard.resize: none +
 *                       adjustNothing / IME insets consumed natively) already
 *                       moves the viewport, so using --app-kb as a layout inset
 *                       would double-count and push the composer off-screen.
 *                       It exists for debugging overlays and for code that
 *                       needs to know how much of the view is covered;
 *   - a JS getter for code that needs numbers (board canvas sizing).
 */
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

const root = (): HTMLElement => document.documentElement;

export function insetNumber(name: "top" | "right" | "bottom" | "left"): number {
  const raw = getComputedStyle(root()).getPropertyValue(`--safe-area-inset-${name}`).trim();
  const px = raw.endsWith("px") ? Number.parseFloat(raw.slice(0, -2)) : Number.NaN;
  if (Number.isFinite(px)) return px;
  // Fallback for the web build / browsers where the plugin does not run.
  const envValue = getComputedStyle(root()).getPropertyValue(`--env-${name}`).trim();
  const envPx = envValue.endsWith("px") ? Number.parseFloat(envValue.slice(0, -2)) : 0;
  return Number.isFinite(envPx) ? envPx : 0;
}

let keyboardHeight = 0;

export function currentKeyboardInset(): number {
  return keyboardHeight;
}

export async function initInsets(): Promise<void> {
  const el = root();

  // Publish env() values as custom props so insetNumber() has a web fallback
  // and the CSS chain below stays a single source of truth.
  const syncEnv = () => {
    el.style.setProperty("--env-top", `env(safe-area-inset-top, 0px)`);
    el.style.setProperty("--env-right", `env(safe-area-inset-right, 0px)`);
    el.style.setProperty("--env-bottom", `env(safe-area-inset-bottom, 0px)`);
    el.style.setProperty("--env-left", `env(safe-area-inset-left, 0px)`);
  };
  syncEnv();

  if (!Capacitor.isNativePlatform()) return;

  // The keyboard insets are applied natively by SystemBars (decor-view padding),
  // which means the WebView itself shrinks. We still track the height here for
  // the brief animation window and for components that scroll themselves into
  // view, and we guard against double counting: if the reported keyboard height
  // includes the gesture-bar inset, subtract it so --app-kb is pure keyboard.
  try {
    await Keyboard.addListener("keyboardWillShow", (info) => {
      const nav = insetNumber("bottom");
      const raw = info.keyboardHeight ?? 0;
      // On some OEM WebViews the IME inset is measured from the very bottom of
      // the display and therefore contains the gesture bar. The native padding
      // uses the same number, so mirroring it minus the nav bar keeps our CSS
      // consistent with what the user actually sees.
      keyboardHeight = Math.max(0, raw - (raw > nav && nav > 0 ? nav : 0));
      el.style.setProperty("--app-kb", `${keyboardHeight}px`);
      el.dataset.keyboard = "visible";
    });
    await Keyboard.addListener("keyboardDidShow", (info) => {
      const nav = insetNumber("bottom");
      const raw = info.keyboardHeight ?? 0;
      keyboardHeight = Math.max(0, raw - (raw > nav && nav > 0 ? nav : 0));
      el.style.setProperty("--app-kb", `${keyboardHeight}px`);
    });
    await Keyboard.addListener("keyboardWillHide", () => {
      keyboardHeight = 0;
      el.style.setProperty("--app-kb", "0px");
    });
    await Keyboard.addListener("keyboardDidHide", () => {
      keyboardHeight = 0;
      el.style.setProperty("--app-kb", "0px");
      delete el.dataset.keyboard;
    });
  } catch {
    /* plugin unavailable on web */
  }
}

/** Hide the keyboard (back button, sheet open, etc.). Safe to call always. */
export async function hideKeyboard(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    return;
  }
  try {
    await Keyboard.hide();
  } catch {
    /* ignore */
  }
}
