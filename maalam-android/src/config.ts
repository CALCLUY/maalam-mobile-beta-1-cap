/**
 * App identity for the Android build.
 *
 * The web shell pointed LOGO_URL at a CDN-hosted JPEG (i.ibb.co). Rule 3 of the
 * port forbids runtime CDN loads, so the mark now ships inside the APK as
 * public/logo.svg — generated offline from the bundled IBM Plex Sans Arabic
 * webfont by scripts/build-brand-assets.mjs (same gradient tile + gold "م" as
 * the web app's own favicon SVG).
 *
 * If you have the original JPEG, `npm run assets:fetch` places it at
 * public/logo.jpg and src/index.css + the splash prefer it automatically.
 */
import logoUrl from "./assets/logo.svg?url";

export const LOGO_URL = logoUrl;

/** Kept for parity with the web shell's diagnostics; no repo is loaded now. */
export const SOURCE_NOTE = "bundled at build time (maalam-android)";
