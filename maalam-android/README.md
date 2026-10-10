# Maalam — Android (Capacitor 8)

Maalam (معلم) is a Darija / Moroccan-Arabic AI tutor. This folder contains the
**Android app**: the phone-width web app from `maalam-mobile-beta-1` (shell,
bottom nav, i18n, history) and the core tutor from `maalam-alpha`
(`src/darija/`: Gemini Live voice, chalkboard, quiz, PDF, DODa dataset) merged
into **one Vite/React build**, wrapped with **Capacitor 8** into a native-feeling
APK.

Nothing is redesigned: layout, colours, typography and behaviour are the
390×844 phone web app. The upstream repositories are untouched.

| | |
|---|---|
| appId | `com.calcluy.maalam` |
| minSdk / target / compile | 24 / 36 / 36 |
| Java | 21 (Temurin) |
| Capacitor | 8.5.3 (core, CLI, android) |
| AGP / Gradle | 8.13.0 / 8.14.3 (wrapper) |
| Bundled fonts | 67 woff2 files (2.93 MB): 48 app faces + KaTeX, no woff/ttf fallbacks |
| Runtime network | **Gemini API only** — no CDN, no fonts, no maps |
| API key | typed by the user, stored in the Android Keystore, never logged, never in the repo or the APK |

---

## 1. Getting the APK

### 1a. GitHub Actions (works everywhere — recommended)

This project was built in a sandbox with no JDK, no Android SDK and no access to
`dl.google.com` / `services.gradle.org`, so binaries are produced by CI. Push the
branch (or **Actions → build-android → Run workflow**) and the workflow publishes
the APK **three ways** — take whichever is easiest:

**1. GitHub Release (simplest — a permanent one-click download)**

> https://github.com/CALCLUY/maalam-mobile-beta-1-cap/releases

Tag `maalam-android-latest` carries `maalam-debug.apk`, `maalam-release.apk`,
`maalam-release.aab`, `mapping.txt` and `BUILD_INFO.txt`. Every successful run
re-uploads them (`--clobber`), so the release always holds the newest build.
On a phone: open the release page, tap `maalam-debug.apk`, allow "install unknown
apps". On a desktop: download then `adb install -r maalam-debug.apk`.

**2. In the repository itself**

`maalam-android/artifacts/maalam-debug.apk` (+ `BUILD_INFO.txt`) is committed to
the branch by CI, so a plain `git pull` fetches the binary, and it is browsable
on github.com. It is the only binary in git; everything else stays an artifact.

**3. Run artifacts** (Actions → the run → Artifacts, kept 30 days)

| Artifact | Contents |
|---|---|
| `maalam-debug-apk` | `maalam-debug.apk` — installable, chrome://inspect enabled |
| `maalam-release` | `maalam-release.apk`, `maalam-release.aab`, `mapping.txt` |
| `reference-screenshots` | `reference/*.png` — 390×844 @2x of every reachable screen |
| `web-dist` | the exact `dist/` that was packaged |

Gradle output (success or failure) is echoed into the **job summary**, which is
readable without the artifact CDN:

```bash
gh api repos/CALCLUY/maalam-mobile-beta-1-cap/actions/runs/<run-id>/jobs   --jq '.jobs[] | select(.name|test("APK")) | .id'
gh api repos/CALCLUY/maalam-mobile-beta-1-cap/check-runs/<that-id> --jq .output.summary
```

The workflow: `npm ci` → `typecheck` → `build` → **no-CDN gate** →
`cap sync android` → signing → `assembleDebug` → `assembleRelease bundleRelease`.
Any CDN string in `dist/` fails the build before an APK is ever produced.

### 1b. Locally (JDK 21 + Android SDK 36)

```bash
cd maalam-android
npm ci
npm run build
npx cap sync android          # copies dist/ into android/app/src/main/assets/public
npm run apk:debug             # -> android/app/build/outputs/apk/debug/app-debug.apk
npm run apk:release           # -> .../outputs/apk/release/app-release.apk
npm run aab:release           # -> .../outputs/bundle/release/app-release.aab
```

Install on a device (USB debugging on):

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Requires: Node 22+, JDK 21 (`JAVA_HOME`), Android SDK with `platforms;android-36`
and `build-tools;36.0.0`. Android Studio Otter 2025.2.1+ if you want the IDE
(`npm run cap:open`).

---

## 2. Release signing

**There is no keystore and no key material in this repository.**
`android/keystore/`, `*.keystore`, `*.jks` and `keystore.properties` are git-ignored.

`android/app/build.gradle` reads signing config from environment variables
(preferred) or Gradle project properties — never from a committed file:

```bash
export MAALAM_KEYSTORE_PATH=/secrets/maalam-release.keystore
export MAALAM_KEYSTORE_PASSWORD=...
export MAALAM_KEY_ALIAS=maalam
export MAALAM_KEY_PASSWORD=...
npm run aab:release
```

Or, equivalently, in `~/.gradle/gradle.properties` (outside the repo):

```
maalam.keystorePath=/secrets/maalam-release.keystore
maalam.keystorePassword=...
maalam.keyAlias=maalam
maalam.keyPassword=...
```

Create a keystore once and keep it safe — losing it means losing the ability to
update the app on Play:

```bash
keytool -genkeypair -v -keystore maalam-release.keystore -keyalg RSA -keysize 2048 \
  -validity 10000 -alias maalam
```

**GitHub Actions secrets:** `MAALAM_KEYSTORE_B64` (base64 of the keystore file:
`base64 -w0 maalam-release.keystore`), `MAALAM_KEYSTORE_PASSWORD`,
`MAALAM_KEY_ALIAS`, `MAALAM_KEY_PASSWORD`. If they are missing the CI job
generates an **ephemeral** keystore and emits a warning — the release APK/AAB
still build and install on a test device, but they must not be uploaded to Play.

Release builds run R8 (`minifyEnabled`) + `shrinkResources` with
`android/app/proguard-rules.pro` keeping the Capacitor bridges and the secure
storage plugin. Save `mapping.txt` from each release to deobfuscate crashes.

---

## 3. Versioning

Single source of truth: `android/variables.gradle`

```groovy
ext {
    appVersionCode = 1
    appVersionName = '1.0.0'
}
```

`app/build.gradle` reads both; nothing else needs editing.

```bash
npm run version:bump -- 1.1.0     # exact version
npm run version:bump -- --minor   # 1.0.0 -> 1.1.0
npm run version:bump -- --patch   # 1.0.0 -> 1.0.1
```

`versionCode` always increments by 1 (Play requires monotonic integers);
`versionName` follows semver. Commit the change with the release.

---

## 4. Everyday workflow

```bash
npm run dev              # Vite dev server; the Capacitor plugins no-op on web
npm run build            # production dist/
npm run build:report     # + dist/bundle-report.json (chunk composition)
npm run typecheck        # tsc --noEmit
npm run verify:offline   # fail if dist/ references any CDN host
npm run cap:sync         # build + copy into the Android project
npm run cap:open         # open android/ in Android Studio
```

**After any change under `src/`, `public/`, `index.html`, `capacitor.config.ts`
or a plugin add/remove, run `npx cap sync android` before building the APK** —
Gradle packages `android/app/src/main/assets/public`, which is generated output
and deliberately git-ignored.

Generated by `cap sync` and also git-ignored (Capacitor's own convention):
`android/app/src/main/assets/capacitor.config.json` and `capacitor.plugins.json`.
Committed, but still generated — never hand-edit:
`android/app/capacitor.build.gradle`, `android/capacitor.settings.gradle`.
So a fresh clone needs `npm ci && npm run build && npx cap sync android` before
Gradle will build.

---

## 5. Visual reference

```bash
npm ci && npx playwright install chromium   # once
npm run build && npm run preview            # terminal 1 (serves dist/ on :4173)
npm run reference                           # terminal 2
# lesson screens need a key; it is read from the environment only and typed
# into the app's own field exactly like a user would:
MAALAM_TEST_API_KEY=... npm run reference
```

`reference/capture.mjs` drives a real Chromium at **390×844, deviceScaleFactor 2,
isMobile, hasTouch**, locale `ar-MA`, against the **same bundle that ships in the
APK** — so `reference/*.png` is the acceptance baseline for "looks like the web
app": boot splash, host splash, setup in ar/fr/en, home (features, help),
language sheet, history sheet, chat + lesson, chalkboard, quiz, attachment
picker, loading states. The `apk`-adjacent CI job produces them on every run.

The PNGs are **not committed** (they need a browser and, for lesson screens, a
key); the script and the CI job are the deliverable. `MAALAM_TEST_API_KEY` is
never written to disk or logged.

---

## 6. Project layout

```
maalam-android/
├── capacitor.config.ts        appId, background colour, insets, keyboard, splash,
│                              minWebViewVersion 110 + errorPath
├── vite.config.ts             base "./", target chrome110, manualChunks, the
│                              dead-CDN-string neutraliser, bundle report
├── index.html                 static splash identical to the native one, RTL,
│                              dark theme, no external requests
├── src/
│   ├── main.tsx               entry: storage migration -> shell -> lazy core
│   ├── loader.ts              replaces the runtime esm.sh loader with a static
│   │                          dynamic import of ./darija/App
│   ├── config.ts              Gemini model + endpoint config (single place)
│   ├── fonts.ts               @fontsource imports (48 faces, woff2 only)
│   ├── App.tsx mobile.ts home.ts history.ts i18n.ts native.ts   phone shell
│   ├── darija/                core tutor (App.tsx, board/, quiz/, pdf/, doda/,
│   │                          media/) — bundled, not fetched
│   ├── assets/doda/*.csv      4.7 MB dataset, lazy-loaded from assets
│   ├── assets/logo.svg        generated offline from the bundled webfont
│   ├── platform/              the native bridge (see below)
│   ├── globals.css maalam.css index.css
│   └── utils/cn.ts
├── public/                    logo.svg, webview-update.html, manifest
├── scripts/
│   ├── build-brand-assets.mjs icons/splash from the brand glyph (offline)
│   ├── bump-version.mjs       versionCode/versionName
│   ├── verify-no-cdn.mjs      the offline gate
│   └── fetch-assets.mjs       optional one-time fetch of the upstream logo art
├── reference/capture.mjs      Playwright 390×844 reference capture
└── android/                   the Capacitor project (see below)
```

### `src/platform/` — everything native, behind one façade

| Module | Role |
|---|---|
| `storage.ts` | sync façade over `@capacitor/preferences` + Keystore-backed `@aparajita/capacitor-secure-storage` for the API key; one-time `localStorage` migration; `clearAllData()` |
| `insets.ts` | reads the SystemBars-injected `--safe-area-inset-*` vars, exposes numbers, sets `html[data-keyboard]` and the informative `--app-kb` |
| `inset-css.ts` | `withInsetFallback()` — rewrites the shell's injected CSS so every inset reads `var(--safe-area-inset-*, env(..., 0px))` |
| `back.ts` / `overlays.ts` | back-button routing: sheet → rail → core modal (synthetic Escape) → phone view → lesson-to-home → exit |
| `media-lifecycle.ts` | pauses mic + audio on background, reconnects Gemini Live on resume, clears the stale status message |
| `permissions.ts` | `getUserMedia` first-run prompt, denial → message + "open settings" via the native plugin |
| `device.ts` | `data-lite` (hardwareConcurrency/deviceMemory), `data-reduced-motion` |
| `perf-css.ts` | transform/opacity-only press feedback, `content-visibility` list virtualisation |
| `haptics.ts` | send / quiz answer / board clear, with an off switch in settings |
| `webview.ts` | `minWebViewVersion` pre-flight and the in-app "update WebView" message |

### `android/`

| File | Notes |
|---|---|
| `variables.gradle` | SDK levels, AndroidX versions, **appVersionCode/Name** |
| `app/build.gradle` | env/prop signing, R8 + resource shrinking, packaging excludes, lint non-fatal |
| `app/proguard-rules.pro` | keeps `com.getcapacitor.**`, plugin packages, `MaalamNativePlugin` |
| `app/src/main/AndroidManifest.xml` | `usesCleartextTraffic=false`, `enableOnBackInvokedCallback=true` (predictive back), `allowBackup=false` + `dataExtractionRules` (protects the key), INTERNET / RECORD_AUDIO / MODIFY_AUDIO_SETTINGS / VIBRATE / CAMERA |
| `res/values/styles.xml` | `windowBackground #0a0d0e`, transparent bars, light icons, no contrast scrim; `Theme.SplashScreen` launch theme |
| `res/mipmap-anydpi-v26/ic_launcher*.xml` | adaptive icon: background + foreground + **monochrome** (themed icons) |
| `res/drawable/ic_launcher_*.xml`, `splash_icon.png` | generated by `scripts/build-brand-assets.mjs` |
| `java/com/calcluy/maalam/MainActivity.java` | registers the plugin before `super.onCreate` |
| `java/com/calcluy/maalam/MaalamNativePlugin.java` | `openAppSettings()`, `requestMicrophone()` |
| `res/xml/data_extraction_rules.xml` | no cloud backup / no device-to-device transfer |

---

## 7. Device testing

Debug builds allow remote inspection: open `chrome://inspect` on a desktop
Chrome with the phone attached over USB, then inspect the WebView like a page.
Release builds refuse (`loggingBehavior` is debug-only and the WebView is not
debuggable).

Checklist that matters most on real hardware (full matrix in `TEST_REPORT.md`):

1. **Cold start**: no white frame; splash → first screen < 1.5 s on a mid-range
   device. Airplane mode: the app must still install, launch and reach setup.
2. **Insets**: status bar area is never overlapped; bottom nav and composer sit
   above the gesture bar on 3-button *and* gesture navigation.
3. **Keyboard**: open it in chat — the composer stays visible, the page does not
   jump, and the keyboard inset is not added on top of the gesture-bar inset.
4. **Back**: closes the top-most sheet → one step back → exits only from home;
   predictive back (Android 14+) shows the correct preview.
5. **Backgrounding**: start a voice lesson, home the app for 60 s, return — mic
   and audio must be paused while away and Gemini Live must reconnect (or show a
   clean status), never a stale "listening" state.
6. **Permissions**: first mic use prompts once; deny → in-app message with a
   working "open settings".
7. **Attachments**: `<input type=file>` opens the system picker for PDFs and
   images on Android 10 and Android 14.
8. **Fonts**: set the system font to the largest size, ar + en + fr; nothing
   clips, RTL line-height stays readable.
9. **Board / quiz**: draw, erase, take a quiz, export a PDF; then check memory
   (`adb shell dumpsys meminfo com.calcluy.maalam`) after closing them.
10. **Low-end**: on a 2 GB device confirm `html[data-lite]` is set and that
    scroll stays smooth.

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Blank white screen on an old phone | WebView < 110. The bridge shows `public/webview-update.html`. Update "Android System WebView" from Play. |
| `env(safe-area-inset-bottom)` is 0 on Android 14 | Expected on WebView < 140 (crbug 40699457). SystemBars injects `--safe-area-inset-*`; the shell CSS reads those first via `withInsetFallback()`. |
| Composer jumps when the keyboard opens | Don't add `--app-kb` to layout padding — it double-counts the IME inset that the native side already applied. `Keyboard.resize` must stay `none`. |
| Release build unsigned / signed with the debug key | Signing env vars or Gradle properties missing; Gradle prints a loud warning. See §2. |
| `cap sync` says the plugin list changed | Regenerated `capacitor.build.gradle` / `capacitor.plugins.json`; commit them. |
| Build fails on `@color/colorPrimary` | The Capacitor 8 template references colours it does not generate; this project's `styles.xml` uses inline hex values instead. |
| Gradle OOM on a 4 GB machine | `android/gradle.properties` already sets 2 GB heap, parallel and build caching. |

---

## 9. Documents

- `CHANGES.md` — every change relative to the two upstream repositories
- `DECISIONS.md` — decisions log with rationale
- `OPEN_ISSUES.md` — known gaps, what is verified and what is not
- `TEST_REPORT.md` — test matrix, results, and how to reproduce
