/**
 * WebView capability guard.
 *
 * Two layers protect an old device:
 *
 *  1. Native: android.minWebViewVersion = 110 makes Capacitor's Bridge refuse
 *     to boot the app and instead load `server.errorPath`
 *     (public/webview-update.html) — a dependency-free page in ar/fr/en that
 *     tells the user to update Android System WebView.
 *
 *  2. Web: this module catches the feature gaps that survive layer 1 (a WebView
 *     between the OS floor and our floor, or a desktop browser with the same
 *     engine). It probes for the APIs the app genuinely needs and, when one is
 *     missing, replaces the root with the same message so nobody gets a silent
 *     blank screen.
 */
type Missing = string[];

export function missingFeatures(): Missing {
  const missing: Missing = [];
  const w = window as unknown as Record<string, unknown>;

  const promiseCtor = w.Promise as PromiseConstructor | undefined;
  if (!promiseCtor || typeof promiseCtor.allSettled !== "function") {
    missing.push("Promise.allSettled");
  }
  if (typeof w.BigInt === "undefined") missing.push("BigInt");
  if (typeof w.globalThis === "undefined") missing.push("globalThis");
  if (!w.CSS || typeof (w.CSS as { supports?: unknown }).supports !== "function") {
    missing.push("CSS.supports");
  }
  if (typeof w.matchMedia !== "function") missing.push("matchMedia");
  if (!navigator.mediaDevices) missing.push("getUserMedia");
  // Optional chaining / nullish coalescing are syntax: an old engine would have
  // failed to parse the bundle at all, so we cannot test them here. The native
  // floor (WebView 110) covers syntax; these runtime probes cover the rest.
  if (typeof w.ResizeObserver === "undefined") missing.push("ResizeObserver");
  if (typeof w.IntersectionObserver === "undefined") missing.push("IntersectionObserver");
  if (!w.customElements) missing.push("customElements");
  return missing;
}

const MESSAGE = {
  ar: "نسخة Android System WebView ديالك قديمة بزاف باش يخدم Maalam. حدّثها من Play Store وعَاوِد جرّب.",
  fr: "Votre version d'Android System WebView est trop ancienne pour Maalam. Mettez-la à jour depuis le Play Store, puis réessayez.",
  en: "Your Android System WebView is too old to run Maalam. Update it from the Play Store, then try again.",
};

export function showWebViewUpdateScreen(lang: "ar" | "fr" | "en" = "ar"): void {
  const root = document.getElementById("root") ?? document.body;
  const text = MESSAGE[lang];
  root.innerHTML = `
    <div style="position:fixed;inset:0;display:grid;place-items:center;background:#0a0d0e;color:#f3f6f4;
                font-family:'IBM Plex Sans Arabic',system-ui,sans-serif;padding:24px;text-align:center;
                line-height:1.8;font-size:15px;z-index:99999">
      <div style="max-width:22rem">
        <div style="font-size:34px;margin-bottom:12px" aria-hidden="true">⚠️</div>
        <p style="margin:0">${text}</p>
        <p style="margin:12px 0 0;color:#93a09b;font-size:12px" dir="ltr">Android System WebView &lt; 110</p>
      </div>
    </div>`;
}
