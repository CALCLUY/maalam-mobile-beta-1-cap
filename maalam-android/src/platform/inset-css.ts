/**
 * Makes the shell's injected CSS inset-aware on Android.
 *
 * The shell CSS (PHONE_CSS, HOME_CSS, HISTORY_CSS, I18N_CSS) was written for the
 * browser and reads `env(safe-area-inset-*)`. On Android that value is unreliable:
 * WebView < 140 reports 0/wrong values (crbug 40699457) and even modern WebViews
 * can paint one frame before the value exists. Capacitor 8's SystemBars plugin
 * fixes this by evaluating the real window insets natively and injecting
 * `--safe-area-inset-*` custom properties on document.documentElement.
 *
 * Instead of editing ~30 call sites, we rewrite the injected stylesheets once:
 *
 *   env(safe-area-inset-bottom)
 *     -> var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))
 *
 * i.e. the native-injected value wins, env() remains the fallback (web build,
 * desktop browsers), and 0px the last resort. Identical rendering everywhere,
 * correct on every WebView generation.
 */
const ENV_INSET = /env\(\s*safe-area-inset-(top|right|bottom|left)\s*(?:,[^)]*)?\)/g;

export function withInsetFallback(css: string): string {
  return css.replace(ENV_INSET, (_match, side: string) => {
    return `var(--safe-area-inset-${side}, env(safe-area-inset-${side}, 0px))`;
  });
}
