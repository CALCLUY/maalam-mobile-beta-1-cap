# TEST_REPORT.md — what was run, what passed, what could not be run

Reported honestly, per the ground rules. Split in three parts:

1. **Executed here** — commands actually run in this environment, with real output.
2. **Not executable here** — everything that needs a JDK/Android SDK, a browser or
   a phone. Blocked, with the reason and how to run it.
3. **Device test matrix** — the plan, with a status column. Nothing in it is
   marked "pass" unless it was actually executed.

Environment: Node 22.22.3, npm 10.9.8, 2 vCPU, 3.9 GB RAM, no JDK, no Android
SDK, no Gradle, no browser binary.

---

## 1. Executed and passing

| # | Check | Command | Result |
|---|---|---|---|
| 1 | TypeScript, strict | `npx tsc --noEmit` | **PASS**, 0 errors (5.9 s) |
| 2 | Production web build | `npx vite build` | **PASS** in 9.2–9.7 s, 173 emitted files |
| 3 | Offline gate | `node scripts/verify-no-cdn.mjs` | **PASS** — "✓ dist/ loads nothing from a CDN. Only the Gemini API is reachable at runtime." 0 violations |
| 4 | Capacitor sync | `npx cap sync android` | **PASS** — web assets copied, 7 plugins wired into `app/capacitor.build.gradle` |
| 5 | Brand asset generation | `node scripts/build-brand-assets.mjs` | **PASS** — adaptive icon drawables, 12 legacy mipmaps, `splash_icon.png`, `logo.svg` |
| 6 | Logo swap, artwork present | put a file at `public/logo.jpg`, `npx vite build` | **PASS** — `dist/index.html` references `./logo.jpg` only (0 `logo.svg` refs) and gains `<meta name="maalam-logo">` |
| 7 | Logo swap, artwork absent | `rm public/logo.jpg`, `npx vite build` | **PASS** — back to `./logo.svg`, no meta tag (default path unchanged) |
| 8 | Font stripping | inspect built CSS | **PASS** — 48 app `@font-face` + 20 KaTeX `@font-face` all still have a woff2 `src:`; zero `format("woff")` / `format("truetype")` left; 67 woff2 files, 2.93 MB |
| 9 | Version bumper | `node scripts/bump-version.mjs --patch` on a scratch copy | **PASS** — rewrites `appVersionCode`/`appVersionName` in `android/variables.gradle` |
| 10 | Bundle composition | grep `import"…"` in `dist/assets/*.js` | done — see the table below |

### 1a. Emitted bundle (raw │ gzip)

**First paint** (what loads before the setup screen appears):

| Asset | Raw | gzip |
|---|---|---|
| `index-*.js` | 168.95 kB | 48.83 kB |
| `react-*.js` | 192.58 kB | 60.37 kB |
| `native-*.js` (Capacitor bridge + plugins) | 19.13 kB | 6.50 kB |
| `icons-*.js` (lucide) | 11.26 kB | 4.27 kB |
| `index-*.css` | 87.90 kB | 19.63 kB |
| `fonts-*.css` | 11.17 kB | 1.39 kB |
| **Total** | **490.99 kB** | **≈137 kB** |

**After mount** (the core tutor): `App-*.js` 253.16 │ 95.49, `genai-*.js` 439.70 │
89.60, `katex-*.js` 261.59 │ 77.84, `katex-*.css` 29.90 │ 8.08 → ≈412 kB
cumulative gzip for a running lesson.

**Deferred until the feature is used:** `pdfjs-*.js` 414.89 │ 122.94,
`pdf-export-*.js` 351.87 │ 115.37, `vendor-*.js` 391.06 │ 108.99 (imported *only*
by pdf-export), `exportPdf-*.js` 8.82 │ 3.69. Assets: `pdf.worker.min.mjs`
1.23 MB, `sentences-*.csv` 4.73 MB (DODa), 67 woff2 fonts 2.93 MB.

`dist/` total: **12 MB** (16 MB before the woff2-only pass).

### 1b. Offline gate output (verbatim tail)

```
  - ies.ed.gov (dist/assets/App-BrXdae3f.js)
  - www.aft.org (dist/assets/App-BrXdae3f.js)

✓ dist/ loads nothing from a CDN. Only the Gemini API is reachable at runtime.
```

The hosts listed above are **informational**: they appear in help text and
research citations (aistudio.google.com, docs.cloud.google.com, education.nsw.gov.au,
educationendowmentfoundation.org.uk, generativelanguage.googleapis.com, github.com,
ies.ed.gov, www.aft.org) and are never fetched by the app. The gate fails the
build on anything else — including `cdnjs.cloudflare.com`, which is how jspdf's
dead `pdfobject` URL was found and neutralised.

---

## 2. Could NOT be executed here (blocked)

| Check | Why it is blocked | How to run it |
|---|---|---|
| `./gradlew assembleDebug` → **the APK** | no JDK, no Android SDK, no Gradle; `dl.google.com`, `services.gradle.org`, `api.adoptium.net`, `deb.debian.org` unreachable; `apt-get` fails even as root | `.github/workflows/build-android.yml` (push the branch, or Actions → **build-android** → Run workflow) → artifact `maalam-debug-apk` |
| `assembleRelease` / `bundleRelease` (R8) | same | same workflow → artifact `maalam-release` (APK + AAB + `mapping.txt`) |
| Reference screenshots | no Chrome/Chromium/headless_shell binary in the image; `npx playwright install` fails with `ECONNRESET cdn.playwright.dev` | CI job `reference` uploads `reference/*.png`; locally `npx playwright install chromium && npm run build && npm run preview` + `npm run reference` |
| Any runtime smoke test (does the UI actually render?) | no browser at all — the app was never executed | CI `reference` job; or `npm run dev` / `npm run preview` on a networked machine |
| Device/emulator behaviour | no emulator, no device, no `adb` | §3 matrix on a real phone |
| Play Console upload | out of scope | manual |

**Interpretation:** the *web build* is verified statically and completely
(types, build, offline gate, bundle composition). The *Android build* and all
*runtime behaviour* are code-complete and reviewed against the Capacitor 8.5.3
sources in `node_modules`, but **have never been executed**. That is the single
biggest open risk and it is recorded as `OPEN_ISSUES.md` OI-1/OI-2/OI-3.

---

## 3. Device test matrix (to run on hardware)

Devices to cover: **low-end** (2 GB RAM, Android 9–11, WebView ~110–120),
**mid-range** (4 GB, Android 12–13), **recent** (Android 14–15, WebView ≥ 140),
**tablet** (Android 14+, 16:10). Install the debug APK first
(`adb install -r`), then repeat the release-APK column for the last two rows.

Legend: ⬜ not run · ✅ pass · ❌ fail (record the logcat)

### 3.1 Cold start & install

| # | Case | Expected | Status |
|---|---|---|---|
| 1 | Fresh install, **airplane mode**, tap the icon | Installs, launches, reaches the setup screen; no network needed | ⬜ |
| 2 | Cold start, no white flash | `#0a0d0e` from the first frame; native splash → static HTML splash → setup screen are visually continuous | ⬜ |
| 3 | Splash → first screen timing | < 1.5 s on mid-range (`adb shell am start -W -n com.calcluy.maalam/.MainActivity` → `TotalTime`) | ⬜ |
| 4 | Launcher icon | Adaptive icon, correct in a themed-icon launcher (monochrome layer) | ⬜ |
| 5 | WebView < 110 (or force it) | `public/webview-update.html` shows an "update Android System WebView" message, not a blank screen | ⬜ |
| 6 | Release (R8) build installs and boots | No `ClassNotFoundException` / missing-method crash from shrinking; logcat clean | ⬜ |

### 3.2 Insets, keyboard, bars

| # | Case | Expected | Status |
|---|---|---|---|
| 7 | Gesture navigation | Bottom nav + composer sit **above** the gesture bar; nothing overlaps | ⬜ |
| 8 | 3-button navigation | Same, above the button bar | ⬜ |
| 9 | Status bar | Light icons on `#0a0d0e`, no scrim, content never under the clock | ⬜ |
| 10 | Landscape / tablet | Insets recomputed; rail and sheets still usable | ⬜ |
| 11 | Open the keyboard in chat | Composer stays visible, **no jump**, no double padding (check `--app-kb` is not added to layout), history scroll position preserved | ⬜ |
| 12 | Close the keyboard | Layout returns exactly; no leftover gap | ⬜ |
| 13 | WebView < 140 | `env(safe-area-inset-*)` is 0, but `--safe-area-inset-*` (plugin-injected) carries the real value → identical layout to ≥ 140 | ⬜ |

### 3.3 Back navigation

| # | Case | Expected | Status |
|---|---|---|---|
| 14 | Open language sheet → back | Sheet closes, app stays | ⬜ |
| 15 | Open history sheet → back | Same | ⬜ |
| 16 | Open help sheet → back | Same | ⬜ |
| 17 | Open settings sheet → back | Same | ⬜ |
| 18 | Open rail, then back | Rail closes | ⬜ |
| 19 | Core modal (e.g. attachment picker) → back | Modal closes via the synthetic Escape path | ⬜ |
| 20 | In a lesson → back | Returns to home (core header behaviour), **not** exit | ⬜ |
| 21 | On home → back | App exits (state flushed first) | ⬜ |
| 22 | **Predictive back** (Android 14+) | Correct preview animation for each of the above; no double-pop, no exit from a sheet | ⬜ |

### 3.4 Lifecycle & audio

| # | Case | Expected | Status |
|---|---|---|---|
| 23 | Start a voice lesson → home the app 60 s → return | Mic + audio paused while away; Gemini Live reconnects or shows a clean status; **no stale "listening"** | ⬜ |
| 24 | Incoming **phone call** mid-lesson → answer → hang up | Audio focus handled; chalk + voice still work after; no dead mic | ⬜ |
| 25 | Screen off / lock during a lesson → unlock | Same as 23 | ⬜ |
| 26 | Recents → kill → relaunch | Language, history and key restored from Preferences/Keystore; no re-entry of the key | ⬜ |
| 27 | Reboot the device → open the app | Key still present (Keystore), history intact | ⬜ |
| 28 | Settings → clear all data (two taps) | Key, history, language and settings wiped; app returns to setup | ⬜ |
| 29 | First run with an existing web profile | One-time localStorage migration fires exactly once | ⬜ |

### 3.5 Permissions & input

| # | Case | Expected | Status |
|---|---|---|---|
| 30 | First mic use | One system prompt; grant → lesson works | ⬜ |
| 31 | Deny the mic | In-app message + working "open settings" (lands on Maalam's app-info page) | ⬜ |
| 32 | Deny "don't ask again" | Same message; no crash, no silent failure | ⬜ |
| 33 | Attach a PDF (`<input type=file>`) on Android 10 and 14 | System picker opens; extraction works offline (pdf.js from the bundle) | ⬜ |
| 34 | Attach an image | Picker + preview; **image not retained in memory after send** (check `dumpsys meminfo`) | ⬜ |
| 35 | Camera feature optional | App installs and runs on a device without a camera | ⬜ |

### 3.6 Frame drops (the spec's four scenarios)

Measure with `adb shell dumpsys gfxinfo com.calcluy.maalam framestats` (or
Perfetto) before/after each; target: no sustained frame > 32 ms, jank < 5 %.

| # | Scenario | Device class | Status |
|---|---|---|---|
| 36 | Chalkboard open, drawing continuously | low-end / mid / recent | ⬜ |
| 37 | History list scroll (long history) | low-end / mid / recent | ⬜ |
| 38 | Voice streaming (transcript growing) | low-end / mid / recent | ⬜ |
| 39 | Quiz open, answering | low-end / mid / recent | ⬜ |
| 40 | Memory after board + quiz + PDF export, then closing them | low-end | ⬜ |

### 3.7 Full functional flow (each device class)

| # | Step | Status |
|---|---|---|
| 41 | Setup → enter API key → save (goes to Keystore) | ⬜ |
| 42 | Start a lesson; voice in/out works | ⬜ |
| 43 | Chat text + streaming transcript render (RTL Arabic) | ⬜ |
| 44 | KaTeX maths renders in a lesson | ⬜ |
| 45 | Open the chalkboard, draw, erase, clear (haptic on clear) | ⬜ |
| 46 | Open the quiz, answer (haptic on answer), see the result | ⬜ |
| 47 | Export a PDF (jsPDF + html-to-image) | ⬜ |
| 48 | Switch language ar → fr → en → ar (relaunch keeps it) | ⬜ |
| 49 | History: open, resume a conversation, delete one | ⬜ |
| 50 | Settings: haptics off (no vibration), lite mode on/off | ⬜ |
| 51 | Send a message (haptic on send) | ⬜ |

### 3.8 Accessibility & fonts

| # | Case | Expected | Status |
|---|---|---|---|
| 52 | System font scale = **largest**, Arabic UI | Nothing clipped; RTL line-height stays readable; buttons ≥ 48 dp still tappable | ⬜ |
| 53 | Same, French + English UI | No clipping, no overlap | ⬜ |
| 54 | TalkBack on | Icon-only buttons announce their `aria-label`; sheets announce as dialogs | ⬜ |
| 55 | System "remove animations" | `html[data-reduced-motion]` set; transitions collapse | ⬜ |
| 56 | Low-end detection | `html[data-lite]` present on a 2 GB / ≤4-core device | ⬜ |

### 3.9 Visual parity vs the web app

| # | Case | Expected | Status |
|---|---|---|---|
| 57 | Screenshot each screen on-device and diff against `reference/*.png` (390×844 @2x) | No layout, colour, spacing or typography difference | ⬜ |
| 58 | Zero blocked/CDN requests | In chrome://inspect → Network, the only external host is `generativelanguage.googleapis.com` | ⬜ |
| 59 | Offline lesson start | Setup + board + quiz + PDF all reachable with no network (only Gemini calls fail, with the app's own error text) | ⬜ |

---

## 4. Acceptance criteria status

| Criterion | Status |
|---|---|
| Offline install + launch to setup | ⬜ device (§3.1 #1) — code-complete |
| No white flash | ⬜ device (#2) — themes + static splash in place |
| Splash → first screen < 1.5 s mid-range | ⬜ device (#3) — first paint is ≈137 kB gzip |
| Full device flow | ⬜ device (§3.7) |
| Back + predictive back per spec | ⬜ device (§3.3) |
| Backgrounding safe | ⬜ device (§3.4) |
| Keyboard never covers the composer | ⬜ device (§3.2 #11) |
| Zero blocked/CDN requests except Gemini | ✅ **verified statically** (`verify-no-cdn.mjs`); ⬜ on-device Network tab confirmation |
| Screenshots match reference | ⬜ blocked (OI-2) — capture script + CI job ready |
| No overlap at max font, RTL + LTR | ⬜ device (§3.8) |
| Minified release installs clean | ⬜ CI + device (#6) |
| Debug APK path / release AAB / signed APK / release instructions | ⬜ CI produces the binaries; ✅ instructions written (`README.md` §1–§3) |
| `CHANGES.md` | ✅ written |
| `README.md` | ✅ written |
| Test report | ✅ this file |
| `reference/` | ⚠️ `capture.mjs` + CI job delivered; PNGs not generated here (OI-2) |

---

## 5. Reproducing part 1

```bash
cd maalam-android
npm ci
npm run typecheck        # 0 errors
npm run build            # ~9 s, dist/ = 12 MB
npm run verify:offline   # must print the ✓ line
npx cap sync android     # copies dist/ into the Android project
```

And the binaries + screenshots:

```bash
git push origin arena/fd15dd7b-maalam-mobile-beta-1-cap   # or Actions → Run workflow
# then download maalam-debug-apk, maalam-release, reference-screenshots
```
