# DECISIONS.md — decisions log

Read this before changing anything structural. Format: **decision → why → what
was rejected**. `OPEN_ISSUES.md` holds everything still unverified.

---

### D1. Merge both repos into one Vite build instead of keeping the runtime loader
The shell compiled `maalam-alpha` in the browser from esm.sh. An APK has no
network budget for that (rule: no CDN), and a runtime compiler is the opposite of
"works on mid-range phones". → One project, static imports, real code splitting.
**Rejected:** shipping esm.sh assets inside the APK (fragile, version-pinned URLs,
still a runtime compiler); a WebView pointed at a hosted build (violates offline).

### D2. Keep `src/darija/` byte-identical except 3 files
The core app is the product. Only `doda/index.ts` (dataset URL), `pdf/extract.ts`
(worker URL) and `App.tsx` (+27 lines for the resume event) needed touching.
Everything native lives in the new `src/platform/` layer or the shell.
**Rejected:** refactoring core state into React context/hooks (redesign risk).

### D3. Board stays DOM/SVG, not a single `<canvas>`
The spec suggested canvas + rAF for the board, but changing the renderer changes
stroke geometry, the eraser and PNG/PDF export fidelity — a redesign, which is
forbidden. rAF batching is already in upstream. → Mitigate instead:
`content-visibility: auto` on off-screen lists, lite mode, releasing board
bitmaps on background, no backdrop-filter/large shadows, transform/opacity-only
animations. **Rejected:** canvas rewrite.

### D4. Storage: sync façade over Preferences + Keystore for the key
The whole shell reads/writes state synchronously (`localStorage`). Rewriting every
call site to async would touch product code for no user benefit. → `storage.ts`
hydrates Preferences into an in-memory map once at boot (`await initPlatform()`
before React mounts) and serves sync reads; writes go through to Preferences
fire-and-forget with an in-flight queue, and the API key additionally to
`@aparajita/capacitor-secure-storage`. On web it falls back to `localStorage`.
**Rejected:** async storage API everywhere; storing the key in Preferences only
(plaintext XML); WebView `localStorage` as the primary store (not inspectable,
wiped on "clear browsing data", and the spec asks for Preferences).

### D5. One-time localStorage migration
People who used the web app on the same WebView profile should not re-enter their
key. → On first native boot, copy `history`/`lang`/key into the new stores, set
`maalam.phone.migratedToNative.v1`, never read localStorage again.

### D6. Insets: trust SystemBars' injected CSS variables, keep `env()` as fallback
Capacitor 8 removed `adjustMarginsForEdgeToEdge`; SystemBars (inside
`@capacitor/core`) writes `--safe-area-inset-{top,right,bottom,left}` on
`document.documentElement`. `env(safe-area-inset-*)` is *wrong* on WebView < 140
(crbug 40699457) and can be 0px on the first frame. → `inset-css.ts` rewrites the
4 hand-injected shell stylesheets to
`var(--safe-area-inset-*, env(safe-area-inset-*, 0px))`, so the plugin's real
values win everywhere and the web build still works.
**Rejected:** `insetsHandling: "disable"` + the community safe-area plugin (extra
dependency, and the plugin pads the WebView's *parent view*, which can stack with
other edge-to-edge margins); reading insets only in JS and setting inline styles
(flicker on first paint).

### D7. Keyboard: native padding only, `Keyboard.resize: none`
With `insetsHandling: "css"` SystemBars already pads the decor view by the IME
inset, animated natively. → No JS resize, and **`--app-kb` is informational**:
adding it to layout padding double-counts the IME inset and pushes the composer
off-screen. `resizeOnFullScreen` is left unset (SystemBars warns it misbehaves
with inset handling). `--app-kb` is still published (keyboard height minus the
gesture-bar inset) for debugging and for JS that needs numbers.

### D8. Back button: one registry, predictive back enabled
`platform/back.ts` holds an ordered stack; `platform/overlays.ts` registers sheets
(language, history, help, settings) as they open. Order: top-most sheet → rail →
core modal (synthetic `Escape`, which the core already handles) → phone view →
lesson→home → `flushNow()` + `App.exitApp()`. Manifest sets
`enableOnBackInvokedCallback="true"`, and `@capacitor/app`'s `backButton` receives
both the legacy and predictive-back paths, so one handler covers Android 14+.
**Rejected:** letting the Activity finish on back (loses the sheet model);
`onBackPressedDispatcher` custom callback in Java (duplicates what the plugin does).

### D9. Splash: Android 12+ SplashScreen API, no Capacitor splash duration
`launchShowDuration: 0` + `launchAutoHide: true`; the theme
(`AppTheme.NoActionBarLaunch`, parent `Theme.SplashScreen`) paints `#0a0d0e` with
`splash_icon`, then hands over to `AppTheme.NoActionBar`. `index.html` contains a
static splash in the same colour with the same centred mark, so
native → WebView is invisible. On API 24–30 the theme degrades to
`windowBackground` + the same drawable — still no white frame.
**Rejected:** a long `launchShowDuration` (hides real work behind a fixed delay);
a white `windowBackground` with a dark splash image (the classic white flash).

### D10. Fix the Capacitor 8 template's broken `styles.xml`
The generated theme references `@color/colorPrimary`, `colorPrimaryDark` and
`colorAccent`, but no `colors.xml` is generated → a stock template build fails.
Also `tools:targetApi` breaks without the `tools:` namespace. → Inline hex values,
no `colors.xml`, no `tools:` attributes.

### D11. Icons and splash generated offline from the bundled webfont
`@capacitor/assets` needs `sharp`/libvips binaries that cannot be downloaded here,
and ImageMagick has no SVG rasteriser in this environment. → `scripts/build-brand-assets.mjs`
draws the brand mark (glyph `م` from IBM Plex Sans Arabic 700, gradient
`#35d6a6→#126f55`, 26% corner radius) and emits adaptive drawables
(108 dp / 66 dp safe zone), legacy mipmaps 48–192 px, `splash_icon.png` (288 px)
and `logo.svg`. A `monochrome` layer is included so Android 13+ themed icons work.

### D12. Fonts: `@fontsource` subsets, woff2 only
Google Fonts CSS + gstatic at runtime is a CDN load. → npm packages, imported from
`src/fonts.ts`: **48 faces** (body IBM Plex Sans Arabic 400/500/600/700, headings
Sora 500/600/700, chalk Playpen Sans Arabic + Playpen Sans + Caveat + Kalam +
Patrick Hand) restricted to the subsets the app can actually render
(`arabic`, `latin`, `math`, `greek`). KaTeX's CSS adds **20 faces (19 files)**.
A build plugin (`woff2OnlyFonts()`) drops the `woff`/`ttf` entries those packages
put in every `src:` list: `minWebViewVersion = 110` already guarantees woff2, so
they were unreachable. Result **67 woff2 files, 2.93 MB, −3.97 MB of `dist/`**
(16 MB → 12 MB) with identical rendering.
**Rejected:** shipping the full Google-Fonts CSS payload (~200 files, all
subsets, all formats).

### D13. The DODa dataset is bundled, not fetched
4.73 MB of CSV. It is imported with `?url` so Vite emits it as a lazy asset —
parsed on first use, never on cold start. **Rejected:** keeping jsDelivr (CDN);
converting to JSON/SQLite (changes the dataset pipeline = redesign).

### D14. Lazy-load everything heavy; measure first paint
`manualChunks` split: first paint = `index` 168.81 kB (48.77 gzip), `react`
192.58 (60.37), `native` 19.13 (6.50), `icons` 11.26 (4.27), CSS 89.42 (19.87) +
fonts CSS 11.17 (1.39) → **≈137 kB gzip to first paint**. After mount: `App`
253.18 (95.50), `genai` 439.70 (89.60), `katex` 261.59 (77.84) → ≈412 kB
cumulative. Deferred until used: `pdfjs` 414.89 (122.94), `pdf-export` 351.89
(115.39), `vendor` 391.06 (108.99, imported only by pdf-export), `exportPdf`
8.82 (3.69); assets `pdf.worker.min.mjs` 1.23 MB, `sentences-*.csv` 4.73 MB.
`loader.ts` dynamically imports `./darija/App` so the shell paints first.

### D15. jspdf's dead CDN string is neutralised, not allowlisted
`jspdf.es.min.js` contains `https://cdnjs.cloudflare.com/ajax/libs/pdfobject/...`
inside the `output("pdfobjectnewwindow")` branch, which this app never calls.
Rule 3 is absolute, so a Vite transform rewrites the literal to
`about:blank#pdfobject-disabled-bundled-build`. The offline gate then passes with
zero allowlist entries for it. **Rejected:** patching `node_modules`, forking
jspdf, or allowlisting cdnjs in the gate (an allowlist entry is exactly how a real
CDN load sneaks back in).

### D16. Release signing from env vars only, ephemeral fallback in CI
No keystore or password in the repo, ever (`android/keystore/`, `*.keystore`,
`*.jks`, `keystore.properties` are git-ignored). `app/build.gradle` reads
`MAALAM_KEYSTORE_PATH|KEYSTORE_PASSWORD|KEY_ALIAS|KEY_PASSWORD` (or `maalam.*`
Gradle properties). If absent it falls back to the debug key **with a loud
`logger.warn`**; CI generates an ephemeral keystore and emits a workflow warning,
so a release build still verifies without shipping a usable Play key.

### D17. R8 + resource shrinking, with plugin keep rules
Release: `minifyEnabled true`, `shrinkResources true`, `proguard-android-optimize.txt`
plus `app/proguard-rules.pro` keeping `com.getcapacitor.**`,
`com.capacitorjs.plugins.**`, the secure-storage package, `MaalamNativePlugin` and
`@PluginMethod` members (they are invoked reflectively from JS — shrinking them
would break the bridge at runtime). `mapping.txt` is uploaded by CI.

### D18. `allowBackup="false"` + explicit data-extraction rules
The API key must not leave the device in a cloud backup or a device-to-device
transfer. `dataExtractionRules` denies both. Cost: no auto-restore — acceptable,
the user re-enters a key.

### D19. `usesCleartextTraffic=false`, `androidScheme: https`, `captureInput: true`
HTTPS scheme inside the WebView = secure context, which `getUserMedia` requires
(otherwise the mic is silently unavailable). Cleartext off in both the manifest
and `server.cleartext`. `captureInput` sends hardware-key events to the WebView.

### D20. `minWebViewVersion: 110` **plus** `server.errorPath`
Bridge.java only loads the error page when `errorPath` is set (`CapConfig.java:251`)
— the version floor alone leaves a blank screen. `public/webview-update.html` is
hand-written HTML/CSS with no dependencies, because it must render on the very
engines we refuse to run on. `src/platform/webview.ts` adds an in-app message for
the range between Capacitor's own floor (60) and 110.

### D21. Legacy Status Bar plugin kept for two calls SystemBars lacks
SystemBars does not implement `setOverlaysWebView` / `setBackgroundColor`, and both
are needed for edge-to-edge on Android ≤ 14. → `@capacitor/status-bar` stays, used
inside try/catch from `platform/index.ts`. Both plugins agree on style
(`DARK` = light icons in Capacitor's naming).

### D22. Haptics via the official plugin, with a persisted off switch
Send, quiz answer, board clear. `@capacitor/haptics` (VIBRATE permission). The
setting lives in the new settings sheet and defaults to on.

### D23. Lite mode detected, not assumed
`hardwareConcurrency <= 4 || deviceMemory <= 4` → `html[data-lite]`
(plus `prefers-reduced-motion` → `html[data-reduced-motion]`). Lite mode disables
decorative transitions and reduces retained bitmaps; the user can force it on/off
in settings. **Rejected:** a separate "lite build" (two APKs to maintain).

### D24. `AudioContext` only after a tap
Browsers/WebViews refuse to start audio without a user gesture; the voice lesson
already begins on a tap, so contexts are created lazily there and suspended on
background (`media-lifecycle.ts`), resumed on return. Chalk/voice after a call
interruption is on the device test list.

### D25. Reference screenshots come from the shipped bundle, not from the design
`reference/capture.mjs` runs Playwright (390×844, DSF 2, isMobile, hasTouch,
`ar-MA`) against `vite preview` of the same `dist/` that goes into the APK, so the
PNGs are a real acceptance baseline. Lesson screens need a key, read from
`MAALAM_TEST_API_KEY` and typed into the app's own field; it is never written to
disk or logged. PNGs are git-ignored and produced by CI (and locally) on demand.

### D26. Generated Capacitor output is not committed
`android/app/src/main/assets/public` (16 MB), `capacitor.config.json`,
`capacitor.plugins.json`, `dist/`, `.gradle/`, build outputs and `reference/*.png`
are all ignored (the first three by Capacitor's own `android/.gitignore`), and
`npx cap sync android` recreates them. `app/capacitor.build.gradle` and
`capacitor.settings.gradle` *are* committed because Gradle reads them and they
change only when the plugin set changes. Consequence: a fresh clone **must** run
`npm ci && npm run build && npx cap sync android` before Gradle can build.
