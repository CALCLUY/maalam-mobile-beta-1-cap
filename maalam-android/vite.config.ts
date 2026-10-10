import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * One Vite project, built at compile time.
 *
 * Differences from the two original repos:
 *  - `vite-plugin-singlefile` is gone. Capacitor serves a real directory from
 *    the APK, so code-splitting is a win (lazy pdf.js / KaTeX / jsPDF chunks)
 *    rather than something to defeat.
 *  - `base: "./"` so every asset URL is relative. The WebView loads the app
 *    from https://localhost/ inside the APK; relative URLs also survive being
 *    served from a sub-path when the web build is deployed for reference
 *    screenshots.
 *  - `build.target: "chrome110"` matches android.minWebViewVersion. Vite will
 *    not down-transpile features WebView 110 already has, and will not let
 *    anything newer through.
 */
/**
 * jspdf ships a dead code path (`output("pdfobjectnewwindow")`) that would load
 * pdfobject from cdnjs.cloudflare.com if it were ever called. Our PDF export
 * never calls it, but rule 3 is absolute: rewrite the literal so the URL cannot
 * exist in the APK at all.
 */
function neutralizeDeadCdnStrings() {
  return {
    name: "maalam-neutralize-dead-cdn-strings",
    transform(code: string, id: string) {
      if (!id.includes("jspdf")) return null;
      const patched = code.replace(
        /https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/pdfobject\/[^"']+/g,
        "about:blank#pdfobject-disabled-bundled-build",
      );
      return patched === code ? null : { code: patched, map: null };
    },
  };
}

/**
 * Optional brand logo. scripts/build-brand-assets.mjs generates public/logo.svg
 * offline, so the app always has a bundled mark. If a maintainer runs
 * `npm run assets:fetch` and the upstream artwork lands in public/logo.jpg, this
 * swaps every reference over at build time — no source edits, still no network:
 *   - index.html  ./logo.svg -> ./logo.jpg (favicon, og:image, splash <img>)
 *   - a <meta name="maalam-logo"> tag, which src/main.tsx turns into the
 *     --app-logo CSS variable that .maalam-logo reads (fallback: bundled SVG).
 */
function brandLogoSwap() {
  const jpeg = path.join(__dirname, "public", "logo.jpg");
  return {
    name: "maalam-brand-logo",
    transformIndexHtml(html: string) {
      // Re-checked per build so `npm run assets:fetch` is picked up by the next
      // `npm run build` without touching this file.
      if (!existsSync(jpeg)) return html;
      return html
        .replaceAll("./logo.svg", "./logo.jpg")
        .replace(
          "</head>",
          '  <meta name="maalam-logo" content="./logo.jpg" />\n  </head>',
        );
    },
  };
}

/**
 * woff2-only fonts.
 *
 * @fontsource and katex both ship `src:` lists with woff2 + woff (+ ttf)
 * fallbacks. Every WebView this app runs on (>= 110, enforced by
 * android.minWebViewVersion) supports woff2, so the fallbacks are 3.9 MB of dead
 * weight inside the APK — more than the woff2 files themselves. Dropping them
 * changes no rendering: same faces, same weights, same unicode-ranges.
 */
function woff2OnlyFonts() {
  const FALLBACK_SRC = /,\s*url\([^)]*\.(?:woff|ttf)\)\s*format\(\s*['"]?(?:woff|truetype)['"]?\s*\)/g;
  return {
    name: "maalam-woff2-only-fonts",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (!id.endsWith(".css")) return null;
      if (!/(@fontsource|katex)/.test(id)) return null;
      const patched = code.replace(FALLBACK_SRC, "");
      return patched === code ? null : { code: patched, map: null };
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [
    neutralizeDeadCdnStrings(),
    woff2OnlyFonts(),
    brandLogoSwap(),
    react(),
    tailwindcss(),
    mode === "report" &&
      visualizer({
        
        gzipSize: true,
        brotliSize: false,
        template: "raw-data",
        filename: "dist/bundle-report.json",
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    target: "chrome110",
    // Report real (compressed) sizes so the first-load budget is honest.
    reportCompressedSize: true,
    chunkSizeWarningLimit: 900,
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        /**
         * Split the heavy third-party libraries into stable, separately-cached
         * chunks. `pdfjs` and `jspdf`/`html-to-image` are only reachable from
         * dynamic imports, so they stay out of the first load entirely.
         */
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("pdfjs-dist")) return "pdfjs";
          if (id.includes("jspdf") || id.includes("html-to-image")) return "pdf-export";
          if (id.includes("katex")) return "katex";
          // @google/genai pulls core-js polyfills + p-retry through CommonJS;
          // keep them in the genai chunk so they never join the first load.
          if (id.includes("@google/genai") || id.includes("core-js") || id.includes("p-retry") || id.includes("/retry/")) {
            return "genai";
          }
          if (id.includes("@fontsource")) return "fonts";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) {
            return "react";
          }
          if (id.includes("@capacitor") || id.includes("@aparajita")) return "native";
          return "vendor";
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
}));
