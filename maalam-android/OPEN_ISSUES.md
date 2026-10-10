# OPEN_ISSUES.md — known gaps, risks, and what is *not* verified

Everything here is honest state, not a wish list. Items marked **[BLOCKED]**
cannot be closed inside this sandbox; they need a networked machine / a device /
CI.

---

## A. Blocked in this environment

### OI-1. No APK was compiled here — Gradle is unvalidated **[BLOCKED]**
The sandbox has no JDK, no Android SDK and no Gradle, and `dl.google.com`,
`services.gradle.org`, `api.adoptium.net` and `deb.debian.org` are all
unreachable (`sudo apt-get` fails even as root). So `android/` has **never been
through a real build**. It was written against Capacitor 8.5.3's own generated
template and the Capacitor/AGP sources in `node_modules`, and reviewed line by
line — but a Gradle syntax error or a wrong AGP 8.13 API would only surface at
build time.
→ **Close it by running `.github/workflows/build-android.yml`** (push the branch
or Actions → Run workflow). It builds `assembleDebug`, `assembleRelease` and
`bundleRelease` on `ubuntu-latest` with Temurin 21 + SDK 36 and uploads the APK,
AAB and `mapping.txt`. If Gradle fails, the log tells us exactly what to fix.

### OI-2. No browser in the sandbox → no reference PNGs, no runtime smoke test **[BLOCKED]**
There is no Chrome/Chromium/headless_shell binary anywhere in the image and the
Playwright browser download is blocked (`ECONNRESET cdn.playwright.dev`).
Consequences: (a) `reference/*.png` were not produced here; (b) the app was never
*executed* — verification is static only (typecheck, production build, bundle
inspection, the no-CDN gate).
→ The `reference` CI job installs Chromium and uploads the screenshots. Locally:
`npx playwright install chromium && npm run build && npm run preview` +
`npm run reference`.

### OI-3. Nothing has run on a device or emulator **[BLOCKED]**
The entire device-facing behaviour — insets, keyboard, back/predictive back,
backgrounding, mic permissions, haptics, file picker, splash timing, memory — is
code-complete and reasoned from the Capacitor sources, but **unverified on
hardware**. The full matrix and how to run it is in `TEST_REPORT.md`.

---

## B. Needs a decision or a human action

### OI-4. Settings sheet wording — needs your sign-off
11 new i18n keys were added for the haptics switch, lite mode and "clear all
data" (the spec required all three; there was no settings surface to put them in).
See `CHANGES.md` §6 for the exact ar/fr/en strings. **No existing text was
changed.** If any wording should differ, it is one line in `src/i18n.ts`.

### OI-5. The logo is generated, not the original artwork
`https://i.ibb.co/rKYMdtMv/Color-matching-first-image-2-K-….jpg` is unreachable
from here, and no image tool in the sandbox can rasterise an SVG (`@capacitor/assets`
needs libvips; ImageMagick has no `rsvg-convert`). So `scripts/build-brand-assets.mjs`
draws an equivalent mark from the bundled IBM Plex Sans Arabic webfont (gradient
`#35d6a6→#126f55`, gold `م`, 26% radius) and uses it for the launcher icon, the
splash and the in-app logo tile.
→ If you want the original: on a networked machine run `npm run assets:fetch`
(it writes `public/logo.jpg`), then `npm run build && npx cap sync android` — the
build automatically prefers it everywhere (`brandLogoSwap()`), still with no
runtime network. If the artwork should instead be *replaced* by a new brand mark,
say so and the generator's parameters change in one place.

### OI-6. Release artifacts from CI are signed with an ephemeral key
Until `MAALAM_KEYSTORE_B64` / `_PASSWORD` / `MAALAM_KEY_ALIAS` / `MAALAM_KEY_PASSWORD`
are set as repository secrets, CI generates a throwaway keystore per run. The APK
installs on a test device; the AAB **must not** go to Play, and each run's APK has
a different signature (so installs over an older CI build need `adb install -r`
after uninstalling). `README.md` §2 has the exact commands.

---

## C. Risks to watch when the build/device tests run

### OI-7. APK size
`dist/` is **12 MB** (was 16 MB before the woff2-only font pass), dominated by
`sentences-*.csv` (4.73 MB DODa), the fonts (2.93 MB, woff2 only) and
`pdf.worker.min.mjs` (1.23 MB). Expect a debug APK around 15–20 MB and a smaller
minified release — **measure it once CI produces the artifacts.** If Play size becomes a problem, the next
step is Play Asset Packs or splitting the CSV — **not done now** because both
change the loading path (and thus behaviour) and were out of scope.

### OI-8. Gemini Live reconnect after an interruption
`media-lifecycle.ts` pauses mic + audio on background and dispatches
`maalam:session-resume` (handled by the +27 lines in `darija/App.tsx`) on return.
The interesting cases are a **phone call / alarm during a lesson** and returning
after > 60 s, where the socket is dead rather than merely suspended. This is the
item most likely to need a follow-up fix; it needs a real device and a real key.

### OI-9. SystemBars behaviour differs by WebView version
From `SystemBars.java`: WebView ≥ 140 + `viewport-fit=cover` → true edge-to-edge
with real `env()` values; WebView < 140 → the plugin pads the WebView's *parent
view* and zeroes the CSS variables. Our CSS reads the injected variables first, so
both paths should look identical — but the < 140 case (most current devices) is
the one to inspect first if a bar overlap shows up. Also: `SystemBars` has no
`setOverlaysWebView`/`setBackgroundColor`, hence the legacy Status Bar plugin
(D21), and `WEBVIEW_VERSION_WITH_SAFE_AREA_KEYBOARD_FIX = 144` means keyboard
insets can still be reported oddly below 144.

### OI-10. List virtualisation is CSS-only
No windowing library was added (that would mean new dependencies and a re-render
model change). Long lists use `content-visibility: auto` +
`contain-intrinsic-size`. This is the right trade for a few hundred items; a
history with thousands of messages should be measured on a low-end device before
revisiting.

### OI-11. `android/app/src/main/assets/capacitor.plugins.json` is generated
A fresh clone has no web assets and no plugin manifest (Capacitor's own
`.gitignore` excludes them). Gradle will fail with a confusing error unless
`npm ci && npm run build && npx cap sync android` runs first. The CI workflow and
`README.md` §4 both do this; a `prebuild` npm script could harden it further.

### OI-12. Template test stubs remain
`android/app/src/test/.../ExampleUnitTest.java` and
`android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java`
are Capacitor's own stubs (note the unrelated `com.getcapacitor.myapp` package).
They compile and do nothing. No real unit or instrumented tests were written for
this port — the verification story is the typecheck, the offline gate, the
reference captures and the device matrix.

### OI-13. Bundle composition report is approximate
`npm run build:report` writes `dist/bundle-report.json`, but rollup-plugin-visualizer's
`raw-data` template joined module uids in a way that reported 0 kB per chunk, so
the numbers in `DECISIONS.md` D14 come from Vite's own build output and from
grepping `import"…"` statements in `dist/assets/*.js`. Cosmetic; does not affect
the app.

---

## D. Out of scope (deliberately)

- **iOS.** The spec is Android-only. The web build is portable, but no `ios/`
  project exists.
- **Push notifications, deep links, analytics, crash reporting.** Not requested;
  each would add a dependency and network traffic.
- **Store listing material** (feature graphic, screenshots at store sizes). The
  `reference/` captures are the design baseline, not store assets.
- **Play Console upload.** `bundleRelease` produces the AAB; uploading, internal
  testing tracks and the data-safety form are outside the repo.
