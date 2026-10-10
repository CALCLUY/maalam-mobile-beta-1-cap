/**
 * Mount step — the runtime loader is gone.
 *
 * The web shell fetched the core app from GitHub and compiled it through
 * esm.sh, then loaded Tailwind's browser JIT. All of that is now ordinary
 * static imports, compiled by Vite into the APK:
 *
 *   react / react-dom        -> npm, one instance shared with the host tree
 *   src/darija/App.tsx       -> the core Maalam app, imported here
 *   tailwindcss              -> compiled at build time by @tailwindcss/vite
 *   katex.min.css            -> imported by src/darija/board/Board.tsx
 *
 * The function keeps its old shape (loadMaalam(onStep)) so the host splash /
 * error screen in App.tsx is untouched.
 */
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { installPhoneExperience } from "./mobile";
import { hideNativeSplash } from "./platform";

export type Step = "styles" | "tailwind" | "modules" | "render";

export async function loadMaalam(onStep: (step: Step) => void): Promise<void> {
  // 1) Styles are already in the bundle (main.tsx imports them), nothing to do.
  onStep("styles");
  // 2) Tailwind was compiled at build time.
  onStep("tailwind");
  // 3) The core app is its own chunk: the splash paints first (it is static
  //    HTML), then the app module is pulled in — same perceived behaviour as
  //    the web shell's React.lazy boundary, minus the network.
  onStep("modules");
  installPhoneExperience();
  const { default: MaalamApp } = await import("./darija/App");

  // 4) Mount, exactly like the web shell did.
  onStep("render");
  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("#root element missing");
  createRoot(rootEl).render(createElement(MaalamApp));

  // Hand over from the native splash once two frames have painted, so the
  // user never sees the splash and the app at the same time.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      void hideNativeSplash();
    });
  });
}
