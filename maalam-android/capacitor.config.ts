import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize, KeyboardStyle } from "@capacitor/keyboard";

/**
 * Capacitor 8 configuration for the Maalam Android app.
 *
 * Everything the app needs at runtime is inside `dist/` (copied into
 * android/app/src/main/assets/public by `npx cap sync android`). The only
 * network destination left is the Gemini API, which the user's own key talks to.
 */
const config: CapacitorConfig = {
  appId: "com.calcluy.maalam",
  appName: "Maalam",
  webDir: "dist",

  // Painted behind the WebView and behind the Android 12+ splash, so a cold
  // start never shows a white frame.
  backgroundColor: "#0a0d0e",

  // Debug builds get chrome://inspect automatically (Capacitor ties this to
  // BuildConfig.DEBUG); release builds stay closed.
  loggingBehavior: "debug",

  android: {
    // Conservative floor. Capacitor's own default is 60; the app uses modern
    // CSS (nesting-free but dvh, :has-free, optional chaining, ES2022) and a
    // WebView this old would render it badly. Bridge.java refuses to boot below
    // this and shows its native "please update Android System WebView" screen,
    // and src/platform/webview.ts adds our own in-app message for the range
    // between MINIMUM and this value.
    minWebViewVersion: 110,
    allowMixedContent: false,
    // Hardware keyboard events go to the WebView, not to the Activity.
    captureInput: true,
    backgroundColor: "#0a0d0e",
  },

  server: {
    // https://localhost inside the WebView = a secure context, which
    // getUserMedia requires for the microphone.
    androidScheme: "https",
    // android:usesCleartextTraffic=false is also set in AndroidManifest.xml.
    cleartext: false,
    // Shown by Bridge.java instead of a blank screen when the system WebView is
    // older than android.minWebViewVersion. Plain HTML/CSS on purpose: the page
    // has to render on the very engines we refuse to run the app on.
    errorPath: "webview-update.html",
  },

  plugins: {
    /**
     * System Bars ships inside @capacitor/core (no extra dependency) and is the
     * Capacitor 8 replacement for the removed `adjustMarginsForEdgeToEdge`.
     *
     * With insetsHandling:"css" the bridge writes the real insets onto
     * document.documentElement as --safe-area-inset-{top,right,bottom,left} in
     * CSS pixels. That matters because env(safe-area-inset-*) is wrong on
     * WebView < 140 (crbug 40699457), and arrives late on the first frame — so
     * the CSS reads the injected variables first and env() only as a fallback.
     *
     * initialViewportFitValueHint avoids the first-frame layout shift the bridge
     * would otherwise cause while it inspects the viewport meta tag.
     */
    SystemBars: {
      insetsHandling: "css",
      style: "DARK", // light icons on our #0a0d0e background
      hidden: false,
      initialViewportFitValueHint: "cover",
    },

    // Legacy path for Android <= 14: keep the bars transparent so the app's own
    // background shows through instead of a system-coloured band.
    StatusBar: {
      overlaysWebView: true,
      style: "dark",
      backgroundColor: "#00000000",
    },

    /**
     * The native splash is driven by the Android 12+ SplashScreen API
     * (Theme.Maalam.Starting in res/values/styles.xml). We hide it as soon as
     * the WebView paints, and index.html already contains a byte-identical
     * static splash, so the handover is invisible.
     */
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#0a0d0e",
      androidSplashResourceName: "splash_icon",
      androidScaleType: "CENTER_INSIDE",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },

    /**
     * resize:"none" is deliberate. With insetsHandling:"css", SystemBars already
     * pads the decor view by the IME inset (SystemBars.java line ~202), so the
     * WebView shrinks exactly with the keyboard — natively animated, no jump.
     * Adding a second JS-driven resize would double-count and stutter.
     *
     * `resizeOnFullScreen` is intentionally NOT set: SystemBars warns that any
     * value there produces unexpected behaviour together with inset handling.
     *
     * The plugin is still used from JS for keyboardDidShow/DidHide events and to
     * hide the keyboard on the back button.
     */
    Keyboard: {
      resize: KeyboardResize.None,
      style: KeyboardStyle.Dark,
    },
  },
};

export default config;
