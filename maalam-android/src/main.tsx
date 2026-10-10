/**
 * Entry point.
 *
 * CSS order is load order: the host shell styles last, because they override
 * the core app's `.maalam-logo` tile (see the note in src/index.css).
 */
import "./fonts";
import "./globals.css";
import "./maalam.css";
import "./index.css";

import { createRoot } from "react-dom/client";
import App from "./App";
import { initI18n, getLang } from "./i18n";
import { enableNativeTouch } from "./native";
import { initPlatform, missingFeatures, showWebViewUpdateScreen } from "./platform";

async function boot(): Promise<void> {
  // Platform first: storage is hydrated synchronously afterwards, and the
  // lite / reduced-motion / inset flags exist before the first paint.
  await initPlatform();

  const missing = missingFeatures();
  if (missing.length) {
    showWebViewUpdateScreen(getLang());
    return;
  }

  // Language first: sets the page direction/title and starts translating the
  // app's screens as soon as they appear.
  initI18n();

  // Native-feel touch: no rubber-banding, no tap highlight, no long-press menu.
  enableNativeTouch();

  // Optional brand artwork (see brandLogoSwap() in vite.config.ts): when the
  // build shipped public/logo.jpg, point .maalam-logo at it.
  const logoMeta = document.querySelector<HTMLMetaElement>('meta[name="maalam-logo"]');
  const logoHref = logoMeta?.getAttribute("content");
  if (logoHref) {
    document.documentElement.style.setProperty("--app-logo", `url("${logoHref}")`);
  }

  // The host React tree only shows the loader / error screen.
  // The real Maalam app is mounted into #root by src/loader.ts.
  createRoot(document.getElementById("host")!).render(<App />);
}

void boot();
