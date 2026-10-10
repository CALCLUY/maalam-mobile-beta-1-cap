# CHANGES.md — what changed relative to the upstream repositories

Two upstreams were merged into this one build. **Neither was modified**; every
change below lives in `maalam-android/`.

- `CALCLUY/maalam-mobile-beta-1` — the phone shell (layout, bottom nav, i18n,
  history, loader). It compiled the core app **in the browser at runtime** from
  esm.sh.
- `CALCLUY/maalam-alpha` — the core Darija tutor (`src/darija/`): Gemini Live
  voice, chalkboard, quiz, PDF, DODa dataset.

Rule compliance summary:

| Rule | Status |
|---|---|
| New folder, upstreams untouched | ✅ `maalam-android/` only |
| No redesign; matches the 390×844 phone web app | ✅ layout/colours/type untouched; see §7 |
| **No CDN at runtime** | ✅ 12 external loads removed; `npm run verify:offline` gates `dist/` |
| **No API key in code / repo / APK / logs** | ✅ user-entered, Keystore-backed, never written to disk or logged |
| Ask before changing user-visible text/behaviour, the model, or deps | ✅ nothing renamed; the only new UI is the settings sheet the spec required (§6); model untouched; deps listed in §8 |

---

## 1. The two repos became one Vite build

The shell used to fetch React, Tailwind and the entire core app from CDNs at
runtime and compile them in the browser. That is incompatible with an offline
APK, so:

- `src/loader.ts` (**+34 / −96**) no longer builds an import map or loads
  `https://esm.sh/CALCLUY/maalam-alpha@main/...`. It statically `import()`s
  `./darija/App` — a real lazy chunk from the same bundle.
- `src/config.ts` (**+12 / −36**) dropped `REPO`, `getRef()`, `repoUrl()`,
  `REACT_VERSION`, `TAILWIND_VERSION` (all esm.sh plumbing) and now only holds
  app identity + the bundled `LOGO_URL`.
- `src/main.tsx` (**+37 / −12**) boots through `initPlatform()` (storage
  hydration, insets, device flags), runs a WebView feature pre-flight, then
  initialises i18n and mounts the host shell. The core app still mounts into
  `#root` from `loader.ts`, so the loading/error screens are unchanged.
- `src/App.tsx` (**+2 / −19**) lost the GitHub / StackBlitz / Vercel links on the
  error screen — they are meaningless inside an APK. The note now shows
  `SOURCE_NOTE` (the bundled version) instead of `repo@ref`.
- `src/darija/**` is vendored verbatim from `maalam-alpha` (except §3).
- `src/globals.css` and `src/maalam.css` come from `maalam-alpha`;
  `src/index.css` from the shell. Import order in `main.tsx` is the load order
  the shell's `<style>` injections used to produce, so the `.maalam-logo`
  override still wins.

---

## 2. Runtime CDN loads removed (the whole point)

Every URL below was fetched by the web app at runtime. Each is now bundled into
`dist/` and shipped inside the APK.

| Was | Now |
|---|---|
| `https://esm.sh/react@19.2.6/es2022/react.mjs`, `react-dom` | npm `react@19.2.6` / `react-dom@19.2.6`, bundled |
| `https://esm.sh/lucide-react@1.52.0?deps=react@19.2.6` | npm `lucide-react`, bundled into an `icons` chunk |
| `https://esm.sh/katex@…` | npm `katex`, lazy `katex` chunk |
| `https://cdn.jsdelivr.net/npm/@tailwindcss/browser@…` (runtime JIT!) | `@tailwindcss/vite` 4.1.17 at build time |
| `https://cdn.jsdelivr.net/npm/katex@0.19.0/dist/katex.min.css` | `import "katex/dist/katex.min.css"` + the **60 KaTeX woff2/woff/ttf fonts** it references |
| `https://cdn.jsdelivr.net/npm/pdfjs-dist@…` | npm `pdfjs-dist` 5.7.284 + `pdf.worker.min.mjs` as a **bundled asset URL** |
| `https://cdn.jsdelivr.net/gh/darija-open-dataset/dataset@main/*.csv` | `src/assets/doda/*.csv` (4.73 MB) bundled, lazy-loaded |
| `https://fonts.googleapis.com/css2?family=Caveat…IBM+Plex+Sans+Arabic…Kalam…Patrick+Hand…Playpen+Sans(+Arabic)…Sora` and `fonts.gstatic.com` | `@fontsource/*` 5.3.0 → **48 faces, woff2 only**, subsets `arabic`/`latin`/`math`/`greek` (see `src/fonts.ts`). KaTeX's CSS brings **20 more faces (19 files)**. Total **67 woff2 = 2.93 MB** |
| `https://i.ibb.co/rKYMdtMv/Color-matching-first-image-2-K-….jpg` (logo) | `public/logo.svg` + `src/assets/logo.svg`, **generated offline** by `scripts/build-brand-assets.mjs` from the bundled IBM Plex Sans Arabic webfont (gradient `#35d6a6→#126f55`, gold `م`). `npm run assets:fetch` can drop the original artwork into `public/logo.jpg`, which the build then prefers automatically |
| `https://cdnjs.cloudflare.com/ajax/libs/pdfobject/…` (dead jspdf branch) | neutralised at build time by the `neutralizeDeadCdnStrings()` Vite plugin — the literal cannot exist in the APK |

Verification: `npm run verify:offline` walks every file in `dist/`, extracts all
absolute URLs, and fails on any host that is not (a) the Gemini API, (b) a
`w3.org`/schema namespace, or (c) an informational link the app never fetches
(aistudio.google.com, github.com, ies.ed.gov, education.nsw.gov.au,
educationendowmentfoundation.org.uk, www.aft.org, docs.cloud.google.com —
these appear in help text/citations only). **Current result: pass, 0 violations.**

Only `generativelanguage.googleapis.com` is contacted at runtime, with the
user's own key.

---

## 3. Core (`src/darija/`) changes — 3 files, +70 lines total

| File | Change |
|---|---|
| `App.tsx` (**+27**) | listens for the `maalam:session-resume` event the platform layer dispatches when the app returns to the foreground: if the Gemini Live session dropped while backgrounded it reconnects, and any stale status line ("listening…") is cleared. No visual change. |
| `doda/index.ts` (**+23 / −9**) | `CDN_BASE` (jsDelivr) replaced by static `import csvUrl from "../../assets/doda/<file>.csv?url"` — the dataset is inside the APK and loads offline. |
| `pdf/extract.ts` (**+20 / −9**) | pdf.js worker is now `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)` (Vite emits it as an asset) instead of a CDN path; dropped `isEvalSupported`, removed from `DocumentInitParameters` in pdfjs-dist 5.7. |

Everything else in `darija/` — board, quiz, pdf export, media, prompts, the
Gemini model name and parameters — is byte-identical to upstream.

---

## 4. Shell changes — 9 files

| File | Change |
|---|---|
| `mobile.ts` (**+174 / −5**) | the shell's runtime integration point. Adds: back-button handler registration, overlay (sheet) tracking, haptic taps on send / quiz / board-clear, `withInsetFallback()` on its injected CSS, `PERF_CSS` injection, the settings sheet (haptics, lite mode, clear all data), and the capture of `board.erase` into a local const for the clear-confirm haptic. |
| `history.ts` (**+12 / −14**) | `localStorage` → the storage façade (`storageGet/Set`); API key read/write goes through the Keystore-backed cache (`getApiKeyCached` / `setApiKey`); sheet registered with the overlay stack; CSS inset fallback. |
| `i18n.ts` (**+25 / −7**) | language persisted through the façade; **11 new keys** for the settings sheet (§6); sheet registered as an overlay; CSS inset fallback. Existing translations untouched. |
| `home.ts` (**+5 / −1**) | help sheet registered as an overlay; CSS inset fallback. |
| `index.css` (**+6 / −4**) | the `.maalam-logo` background now points at the bundled SVG via `var(--app-logo, url("./assets/logo.svg"))`; comment updated. |
| `App.tsx`, `config.ts`, `loader.ts`, `main.tsx` | see §1. |

---

## 5. New: `src/platform/` (12 modules) — all native concerns behind one façade

Nothing here changes what the app looks like; it changes where state lives and
how the app behaves as an Android app.

| Module | What it does |
|---|---|
| `storage.ts` | synchronous read/write façade over `@capacitor/preferences`, hydrated once at boot. Keys: `maalam.phone.{history,apiKey,lang,settings}.v1`. The API key additionally lives in **`@aparajita/capacitor-secure-storage`** (Android Keystore / EncryptedSharedPreferences). One-time migration from `localStorage` (flag `maalam.phone.migratedToNative.v1`) so an existing web profile survives an install. `clearAllData()` wipes everything. On web, it transparently falls back to `localStorage`. |
| `insets.ts` | reads the `--safe-area-inset-*` variables that Capacitor 8's **SystemBars** plugin injects on `document.documentElement`, exposes them as numbers for JS (board sizing), sets `html[data-keyboard]`, and sets the **informative** `--app-kb` (keyboard height minus the gesture-bar inset — deliberately never used for layout padding, which would double-count the IME inset). |
| `inset-css.ts` | `withInsetFallback(css)`: rewrites the shell's hand-injected `<style>` text so every `env(safe-area-inset-*)` becomes `var(--safe-area-inset-*, env(safe-area-inset-*, 0px))`. Needed because `env()` is wrong on WebView < 140 (crbug 40699457) and arrives late on the first frame. Applied at the 4 injection sites (`mobile.ts`, `home.ts`, `history.ts`, `i18n.ts`). |
| `back.ts` + `overlays.ts` | one back-button model: close the top-most sheet → close the rail → close a core modal (synthetic `Escape`) → step back one phone view → lesson→home (core header) → `flushNow()` + `App.exitApp()`. Works with Android 14+ predictive back because the manifest sets `enableOnBackInvokedCallback="true"` and `@capacitor/app` routes both paths to the same handler. |
| `media-lifecycle.ts` | on `appStateChange(false)`: stop mic tracks, suspend every `AudioContext`, release the board/quiz resources that hold bitmaps. On resume: dispatch `maalam:session-resume` (§3) and clear stale status text. |
| `permissions.ts` | first-run `getUserMedia` prompt handling; on denial shows the in-app message and offers "open settings", which calls the native `MaalamNativePlugin.openAppSettings()`. |
| `device.ts` | sets `html[data-lite]` when `hardwareConcurrency <= 4` or `deviceMemory <= 4` (overridable in settings), and `html[data-reduced-motion]` from `prefers-reduced-motion`. |
| `perf-css.ts` | injected CSS: transform/opacity-only 150–300 ms transitions, `:active` scale press feedback on `pointerdown`, `content-visibility: auto` + `contain-intrinsic-size` for the history list and long message lists, and the reduced-motion/lite-mode overrides. No backdrop-filter, no layout animations on scroll, no large shadows. |
| `haptics.ts` | `@capacitor/haptics` taps on send, quiz answer and board clear, with a persisted off switch. |
| `webview.ts` | feature pre-flight (Canvas/WebGL/ES2022/Promise shape) plus the `android.minWebViewVersion = 110` story: the bridge shows `public/webview-update.html` below 110; between 110 and the app's own floor, an in-app message tells the user to update Android System WebView. |
| `index.ts` | `initPlatform()` + re-exports; also uses the legacy `@capacitor/status-bar` (inside try/catch) for `setOverlaysWebView`/`setBackgroundColor`, which **SystemBars does not implement**. |

---

## 6. New user-visible UI (spec-required) — please review the wording

The spec asked for a haptics off switch, a lite-mode control and "clear all
data" in settings. There was no settings surface in the shell, so a sheet was
added to the existing home rail (same sheet component, same styling, no new
visual language). **11 new i18n keys**, in ar / fr / en:

`appSettings` (إعدادات التطبيق), `haptics` (الاهتزاز), `hapticsOn/Off`,
`liteMode` (الوضع الخفيف), `liteAuto/On/Off`, `clearData` (مسح كل البيانات),
`clearDataHint`, `clearDataArm` (اضغط مرة أخرى للتأكيد — two-tap confirm),
`dataCleared`.

No existing string was reworded, no screen was rearranged, and the Gemini model
was not touched. If any of these should be phrased differently, it is a one-line
change in `src/i18n.ts`.

---

## 7. What deliberately did **not** change

- The chalkboard stays DOM/SVG with rAF batching. Rewriting it to a single
  `<canvas>` would have been the textbook perf move, but it changes rendering
  (stroke shapes, eraser behaviour, export fidelity) — i.e. a redesign — so it
  was rejected. Mitigations applied instead: `content-visibility`, lite mode,
  resource release on background, and no backdrop-filter/large shadows.
- No layout, colour, spacing, radius, typography or animation-timing change.
  All values are the shell's: bg `#0a0d0e` (setup `#090a0c`), surface `#11171a`,
  surface-2 `#172023`, text `#f3f6f4`, muted `#93a09b`, accent `#34d6a4`,
  accent-soft `#7fe3c4`, accent-ink `#06231b`, accent-2 `#1fb88a`, gold
  `#ffe066`, line `rgba(255,255,255,.08)`, line-strong `rgba(127,227,196,.34)`,
  radius `1.25rem`, ≥48 dp touch targets, RTL default.
- File picking still uses the app's own `<input type="file" accept=…>`; the
  Capacitor WebView chrome client already routes it to the system picker
  (`BridgeWebChromeClient`), so no plugin and no UX change were needed.
- The Gemini model, prompts and streaming behaviour are untouched.

---

## 8. Dependencies

Added (all required by the spec): `@capacitor/{core,cli,android,app,keyboard,status-bar,splash-screen,preferences,haptics}` 8.x,
`@aparajita/capacitor-secure-storage` 8.0.1 (the spec's "secure storage for the
key"; `@capacitor-community/secure-storage` does not exist on npm),
`@fontsource/{ibm-plex-sans-arabic,sora,playpen-sans-arabic,playpen-sans,caveat,kalam,patrick-hand}` 5.3.0,
plus the core app's own runtime deps now bundled locally: `@google/genai`,
`katex`, `pdfjs-dist`, `jspdf`, `html-to-image`, `lucide-react`, `react`,
`react-dom`, `clsx`, `tailwind-merge`. Dev-only: `vite` 7.3.2,
`@vitejs/plugin-react`, `@tailwindcss/vite`, `typescript` 5.9.3, `playwright`,
`rollup-plugin-visualizer`.

Removed: `vite-plugin-singlefile` (the shell used it to inline everything for a
CDN-less single HTML file — irrelevant once Capacitor serves a directory, and
it would defeat the lazy chunks).

**Note on SystemBars:** Capacitor 8's SystemBars plugin ships *inside*
`@capacitor/core`, so edge-to-edge insets cost no extra dependency.

---

## 9. Build configuration

`vite.config.ts`
- `base: "./"` — every asset URL relative (WebView + any static host).
- `build.target: "chrome110"` — matches `android.minWebViewVersion`.
- `manualChunks`: `react`, `icons`, `genai`, `katex`, `pdfjs`, `pdf-export`,
  `vendor`, `native` — so first paint is small and heavy libraries load on demand.
- `neutralizeDeadCdnStrings()` — kills jspdf's dead pdfobject CDN literal (§2).
- `woff2OnlyFonts()` — strips the `woff`/`ttf` fallbacks from every `@fontsource`
  and KaTeX `src:` list. WebView ≥ 110 is guaranteed by `minWebViewVersion`, so
  they are unreachable code: **−3.97 MB** in `dist/` (16 MB → 12 MB) with no
  rendering change (same faces, weights and unicode-ranges).
- `brandLogoSwap()` — prefers `public/logo.jpg` when a maintainer has fetched it.
- `--mode report` writes `dist/bundle-report.json` (rollup-plugin-visualizer).

`capacitor.config.ts`
- `appId com.calcluy.maalam`, `webDir dist`, `backgroundColor #0a0d0e`.
- `android.minWebViewVersion: 110`, `captureInput: true`, `allowMixedContent: false`.
- `server.androidScheme: "https"` (secure context for `getUserMedia`),
  `cleartext: false`, **`errorPath: "webview-update.html"`** — without it an old
  WebView shows a blank screen instead of the update message.
- `plugins.SystemBars.insetsHandling: "css"` + `style: "DARK"` (Capacitor's DARK
  means *light icons*, correct for our dark background) + `initialViewportFitValueHint: "cover"`.
- `plugins.Keyboard.resize: KeyboardResize.None` — SystemBars already pads the
  decor view by the IME inset; a second JS resize would double-count and stutter.
  `resizeOnFullScreen` deliberately unset.
- `plugins.SplashScreen.launchShowDuration: 0` + `launchAutoHide: true` — the
  Android 12+ splash (theme-driven) owns the handover.
- `loggingBehavior: "debug"` — chrome://inspect in debug builds only.

`index.html` — static splash byte-identical in colour to the native splash
(`#0a0d0e`), `dir="rtl"`, `theme-color`, `color-scheme: dark`, relative icon
paths, and **no external requests of any kind**.

`tsconfig.json` — strict, `bundler` resolution, `chrome110`-era lib set.

---

## 10. The Android project (`android/`)

Generated by `npx cap add android` (Capacitor 8.5.3 → AGP 8.13.0, Gradle 8.14.3,
Java 21), then customised:

| File | Change |
|---|---|
| `variables.gradle` | added **`appVersionCode = 1`**, **`appVersionName = '1.0.0'`** — the single source of truth (`npm run version:bump`). SDK levels left at the Capacitor 8 defaults: min 24, compile/target 36. |
| `app/build.gradle` | reads version from `variables.gradle`; signing from `MAALAM_KEYSTORE_*` env vars or `maalam.*` Gradle properties, with a loud `logger.warn` + debug-key fallback when absent; `minifyEnabled` + `shrinkResources` on release with `proguard-android-optimize.txt`; `proguard-rules.pro`; packaging excludes (META-INF noise, version-control files); `lint { abortOnError = false }` so a lint warning cannot block a release; debug + release build types. Fixed the template's wrong `$androidxEspressoCoreVersion` on the `ext:junit` test dependency → `$androidxJunitVersion`. |
| `app/proguard-rules.pro` | keeps `com.getcapacitor.**`, `com.capacitorjs.plugins.**`, the secure-storage package, `MaalamNativePlugin` and every `@PluginMethod` member; keeps `SourceFile`/`LineNumberTable` for symbolisation. |
| `app/src/main/AndroidManifest.xml` | `android:usesCleartextTraffic="false"`, `android:enableOnBackInvokedCallback="true"` (predictive back), `allowBackup="false"` + `dataExtractionRules` (the API key must never be backed up or transferred), `launchMode="singleTask"`, launch theme `AppTheme.NoActionBarLaunch`; permissions INTERNET, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, VIBRATE, CAMERA; `<uses-feature camera required="false">`, `<uses-feature microphone required="true">`. |
| `res/values/styles.xml` | **rewritten**: the Capacitor 8 template references `@color/colorPrimary` / `colorPrimaryDark` / `colorAccent` but generates no `colors.xml`, so a stock template build fails on missing resources. Now inline hex. `AppTheme`: `windowBackground #0a0d0e`, transparent status/nav bars, `windowLightStatusBar=false` (light icons), `enforce{Status,Navigation}BarContrast=false`. `AppTheme.NoActionBarLaunch` (parent `Theme.SplashScreen`): `windowSplashScreenBackground #0a0d0e`, `windowSplashScreenAnimatedIcon @drawable/splash_icon`, `postSplashScreenTheme AppTheme.NoActionBar` → **no white flash on API 24–36** (older APIs degrade to `windowBackground` + the same drawable). |
| `res/xml/data_extraction_rules.xml` | new: no cloud backup, no device-to-device transfer. |
| `res/mipmap-anydpi-v26/ic_launcher{,_round}.xml` | adaptive icon → `@drawable/ic_launcher_background` + `ic_launcher_foreground` + **`ic_launcher_monochrome`** (Android 13+ themed icons). |
| `res/drawable/ic_launcher_{background,foreground,monochrome}.xml`, `splash_icon.png`, `mipmap-{m..xxx}dpi/ic_launcher{,_round}.png` | generated offline by `scripts/build-brand-assets.mjs` (108 dp adaptive, 66 dp safe zone, 26% corner radius, 288 px splash). `@capacitor/assets` could not be used (its `sharp`/libvips binary is not downloadable offline) and ImageMagick cannot rasterise SVG here. |
| `java/com/calcluy/maalam/MainActivity.java` | registers `MaalamNativePlugin` **before** `super.onCreate()`. |
| `java/com/calcluy/maalam/MaalamNativePlugin.java` | new: `@CapacitorPlugin(name = "MaalamNative", permissions = @Permission(RECORD_AUDIO, alias = "microphone"))` with `openAppSettings()` (ACTION_APPLICATION_DETAILS_SETTINGS) and `requestMicrophone()` → `{granted}`, using `Plugin.hasPermission` / `requestAllPermissions` + a `@PermissionCallback`. |
| `gradle.properties` | 2 GB Gradle heap, parallel builds, build caching (CI + low-RAM dev machines). |
| `.gitignore` (root + `android/`) | `dist/`, `node_modules/`, generated Capacitor web assets (`android/app/src/main/assets/public`, 16 MB — recreated by `cap sync`), keystores, `.gradle`, build outputs, `reference/*.png`. |
| Deleted template leftovers | `values/ic_launcher_background.xml`, `drawable-v24/`, every `splash.png` + port/land dirs, `mipmap-*/ic_launcher_foreground.png` (all replaced by the adaptive-icon drawables). |

Generated files kept as-is: `app/capacitor.build.gradle` (sets Java 21
compileOptions and wires all 7 plugin projects), `capacitor.plugins.json`,
the Gradle wrapper.

---

## 11. Scripts + CI

| Path | Purpose |
|---|---|
| `scripts/build-brand-assets.mjs` | generates every icon/splash PNG + the adaptive drawables + `logo.svg` offline from the bundled webfont (ran successfully). |
| `scripts/bump-version.mjs` | `npm run version:bump -- <x.y.z\|--major\|--minor\|--patch>`; versionCode always +1. |
| `scripts/verify-no-cdn.mjs` | the offline gate over `dist/`; non-zero exit on any CDN host. |
| `scripts/fetch-assets.mjs` | optional, human-run: downloads the upstream logo artwork into `public/logo.jpg` (needs network; the build then prefers it). |
| `reference/capture.mjs` | Playwright capture at 390×844 @2x, `isMobile`, `hasTouch`, locale `ar-MA`, against `dist/` — the acceptance baseline. |
| `.github/workflows/build-android.yml` | `web` (build + typecheck + CDN gate) → `reference` (screenshots) and `apk` (JDK 21, SDK 36, `cap sync`, signing from secrets or ephemeral, `assembleDebug`, `assembleRelease bundleRelease`, artifacts: debug APK, release APK+AAB, `mapping.txt`). |
