/**
 * Phone home screen (the API-key / welcome screen shown before the board opens).
 *
 *  - Styles for the home screen itself (hero, feature tiles, key card, button).
 *  - A round, floating bottom navigation with a sliding active indicator and
 *    scroll tracking. It only exists while the home screen exists, so it can
 *    never appear on top of the board.
 *  - A "how to start" help sheet.
 */

import { LOGO_URL } from "./config";
import { withInsetFallback } from "./platform/inset-css";
import { trackOverlay, untrackOverlay } from "./platform/overlays";
import { getSavedApiKey, saveApiKey } from "./history";
import { LANGS, getLang, onLangChange, setLang, t, uiDir, type Lang, type StringKey } from "./i18n";

type Tab = "home" | "features" | "help" | "start";

export type HomeNav = {
  root: HTMLElement;
  setup: HTMLElement;
  destroy: () => void;
};

const ICONS = {
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  features:
    '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9.2a3 3 0 0 1 5.8 1c0 2-2.9 2.4-2.9 4.2"/><path d="M12 17.6h.01"/>',
  start: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
} as const;

function svg(name: keyof typeof ICONS): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

const HOME_CSS = `
html.maalam-phone {
  --hm-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --hm-bg: #07090a;
  --hm-accent: #34d6a4;
  --hm-accent-soft: #7fe3c4;
}

/* ================= Home screen shell ================= */
html.maalam-phone .setup-screen {
  box-sizing: border-box !important;
  position: fixed !important;
  inset: 0 !important;
  width: 100% !important;
  height: var(--maalam-viewport-height, 100dvh) !important;
  min-height: var(--maalam-viewport-height, 100dvh) !important;
  max-height: var(--maalam-viewport-height, 100dvh) !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
  scroll-padding-block: calc(5rem + env(safe-area-inset-top)) calc(7.5rem + env(safe-area-inset-bottom));
  padding: 0 !important;
  background:
    radial-gradient(30rem 22rem at 50% -8%, rgba(52, 214, 164, 0.16), transparent 72%),
    radial-gradient(26rem 20rem at 112% 102%, rgba(255, 224, 102, 0.06), transparent 72%),
    var(--hm-bg) !important;
  -webkit-overflow-scrolling: touch;
}

/* chalkboard grid */
html.maalam-phone .setup-screen::before {
  position: fixed !important;
  inset: 0 !important;
  background-image:
    linear-gradient(rgba(127, 227, 196, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(127, 227, 196, 0.03) 1px, transparent 1px) !important;
  background-size: 56px 56px !important;
  content: "" !important;
  mask-image: linear-gradient(to bottom, black, transparent 70%) !important;
  -webkit-mask-image: linear-gradient(to bottom, black, transparent 70%) !important;
  pointer-events: none !important;
}

/* soft fade behind the floating nav so content never collides with it */
html.maalam-phone .setup-screen::after {
  position: fixed;
  z-index: 2;
  right: 0;
  bottom: 0;
  left: 0;
  height: calc(7.75rem + env(safe-area-inset-bottom));
  background: linear-gradient(to top, var(--hm-bg) 14%, rgba(7, 9, 10, 0.78) 48%, transparent);
  content: "";
  pointer-events: none;
}

html.maalam-phone.maalam-keyboard-open .setup-screen::after {
  display: none;
}

html.maalam-phone .setup-screen .ambient {
  opacity: 0.08 !important;
  filter: blur(100px) !important;
}

html.maalam-phone .setup-grid {
  display: flex !important;
  box-sizing: border-box !important;
  width: 100% !important;
  max-width: 28rem !important;
  min-height: 100% !important;
  flex-direction: column !important;
  justify-content: flex-start !important;
  gap: clamp(0.8rem, 2.4vh, 1.15rem) !important;
  margin-inline: auto !important;
  padding:
    calc(env(safe-area-inset-top) + 4.7rem)
    max(1rem, env(safe-area-inset-right))
    calc(8rem + env(safe-area-inset-bottom))
    max(1rem, env(safe-area-inset-left)) !important;
}

html.maalam-phone .setup-grid > * {
  position: relative;
  z-index: 1;
  min-width: 0 !important;
}

/* ================= Hero (app-style welcome, not a landing page) ================= */
html.maalam-phone .setup-grid > :first-child {
  display: flex !important;
  width: 100% !important;
  flex-direction: column !important;
  align-items: stretch !important;
  text-align: start !important;
}

html.maalam-phone .setup-grid > :first-child > * {
  animation: hm-rise 640ms var(--hm-ease) both;
}
html.maalam-phone .setup-grid > :first-child > :nth-child(2) { animation-delay: 60ms; }
html.maalam-phone .setup-grid > :first-child > :nth-child(3) { animation-delay: 120ms; }
html.maalam-phone .setup-grid > :first-child > :nth-child(4) { animation-delay: 180ms; }
html.maalam-phone .setup-grid > :first-child > :nth-child(5) { animation-delay: 240ms; }
html.maalam-phone .setup-grid > :first-child > :nth-child(6) { animation-delay: 300ms; }
html.maalam-phone .setup-grid > :first-child > :nth-child(n + 7) { animation-delay: 360ms; }

html.maalam-phone .setup-grid > :last-child {
  animation: hm-rise 720ms var(--hm-ease) 260ms both;
}

/* Home logo: the header row keeps only the app logo (no wordmark, no dataset
   badge), centred, with the same bevel/emboss as the splash logo. */
html.maalam-phone .setup-grid > :first-child > :first-child {
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  width: 100% !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  background: none !important;
  box-shadow: none !important;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

html.maalam-phone .setup-grid > :first-child > :first-child .brand-wordmark,
html.maalam-phone .setup-grid > :first-child > :first-child .setup-badge {
  display: none !important;
}

html.maalam-phone .setup-grid > :first-child > :first-child .maalam-logo {
  position: relative !important;
  width: clamp(3.65rem, 15vw, 4.45rem) !important;
  height: clamp(3.65rem, 15vw, 4.45rem) !important;
  margin: 0 !important;
  border: 0 !important;
  border-radius: 26% !important;
  overflow: hidden !important;
  background-color: transparent !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.7),
    inset 0 -4px 7px rgba(2, 14, 11, 0.58),
    inset 2px 0 4px rgba(255, 255, 255, 0.14),
    inset -2px 0 5px rgba(2, 14, 11, 0.4),
    inset 0 0 0 1px rgba(255, 255, 255, 0.22),
    0 2px 0 rgba(255, 255, 255, 0.1),
    0 13px 30px rgba(0, 0, 0, 0.55),
    0 0 38px rgba(52, 214, 164, 0.14) !important;
  filter: none !important;
  animation: hm-float 6s ease-in-out infinite !important;
}

html.maalam-phone .setup-grid > :first-child > :first-child .maalam-logo::before {
  content: "" !important;
  position: absolute !important;
  inset: 0 !important;
  z-index: 2 !important;
  display: block !important;
  border: 1px solid rgba(255, 255, 255, 0.28) !important;
  border-radius: inherit !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    inset 0 -1px 0 rgba(0, 0, 0, 0.55) !important;
  transform: none !important;
  animation: none !important;
  pointer-events: none !important;
}

html.maalam-phone .setup-grid > :first-child > :first-child .maalam-logo::after {
  content: "" !important;
  position: absolute !important;
  inset: 0 !important;
  z-index: 3 !important;
  display: block !important;
  border-radius: inherit !important;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.24) 0%, rgba(255, 255, 255, 0.05) 26%, transparent 48%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.12), transparent 34%) !important;
  box-shadow: none !important;
  mix-blend-mode: screen;
  opacity: 0.75;
  transform: none !important;
  animation: none !important;
  pointer-events: none !important;
}

/* --- App welcome card --- */
html.maalam-phone .setup-eyebrow {
  display: inline-flex !important;
  align-items: center !important;
  align-self: flex-start !important;
  margin: 0 0 0 !important;
  padding: 0.3rem 0.75rem !important;
  border: 1px solid rgba(127, 227, 196, 0.22) !important;
  border-radius: 999px !important;
  background: rgba(52, 214, 164, 0.08) !important;
  font-size: 0.68rem !important;
  font-weight: 700 !important;
  letter-spacing: 0.02em !important;
}

html.maalam-phone .setup-title {
  position: relative;
  isolation: isolate;
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  gap: 0.15rem !important;
  margin: 0.3rem 0 0 !important;
  padding: 1rem 1.1rem 0.95rem !important;
  overflow: hidden;
  border-radius: 1.5rem !important;
  background:
    radial-gradient(14rem 9rem at 100% 0%, rgba(52, 214, 164, 0.22), transparent 70%),
    radial-gradient(10rem 8rem at 0% 100%, rgba(255, 224, 102, 0.08), transparent 70%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)),
    #0f1517 !important;
  font-size: clamp(2rem, 10.5vw, 2.7rem) !important;
  line-height: 1.05 !important;
  text-align: start !important;
  text-shadow: none;
  box-shadow: 0 22px 54px rgba(0, 0, 0, 0.42), inset 0 1px rgba(255, 255, 255, 0.08);
}

/* soft hairline border */
html.maalam-phone .setup-title::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  padding: 1px;
  border-radius: inherit;
  background: linear-gradient(160deg, rgba(127, 227, 196, 0.5), rgba(127, 227, 196, 0.06) 45%, rgba(255, 224, 102, 0.25));
  content: "";
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  pointer-events: none;
}

html.maalam-phone .setup-title small {
  font-size: 0.42em !important;
  line-height: 1.35 !important;
}

html.maalam-phone .setup-lead {
  max-width: none !important;
  margin: 0.55rem 0.15rem 0 !important;
  color: #aebbb7 !important;
  font-size: 0.88rem !important;
  line-height: 1.8 !important;
  text-wrap: pretty;
}

/* ================= Feature cards: swipeable row, like app onboarding ================= */
html.maalam-phone .setup-features {
  display: flex !important;
  flex-wrap: nowrap !important;
  width: calc(100% + 2rem) !important;
  margin: 0.9rem -1rem 0 !important;
  padding: 0.35rem 1rem 0.5rem !important;
  gap: 0.6rem !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  scroll-snap-type: x mandatory;
  scroll-padding-inline: 1rem;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
}

html.maalam-phone .setup-features::-webkit-scrollbar {
  display: none;
}

html.maalam-phone .setup-features li {
  position: relative;
  display: flex !important;
  min-width: 0 !important;
  flex: 0 0 auto !important;
  width: 9.6rem !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  justify-content: flex-start !important;
  gap: 0.75rem !important;
  scroll-snap-align: start;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  border-radius: 1.25rem !important;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.015)),
    #0e1416 !important;
  padding: 0.9rem 0.9rem 0.95rem !important;
  color: #d7e0dc !important;
  font-size: 0.74rem !important;
  font-weight: 600 !important;
  line-height: 1.55 !important;
  text-align: start !important;
  text-wrap: pretty;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
}

/* each card gets its own accent hue so the row doesn't look like a repeated list */
html.maalam-phone .setup-features li:nth-child(1) { --fc: 52, 214, 164; }
html.maalam-phone .setup-features li:nth-child(2) { --fc: 255, 224, 102; }
html.maalam-phone .setup-features li:nth-child(3) { --fc: 126, 200, 255; }
html.maalam-phone .setup-features li:nth-child(4) { --fc: 255, 139, 150; }

html.maalam-phone .setup-features li svg {
  box-sizing: content-box !important;
  width: 1.15rem !important;
  height: 1.15rem !important;
  padding: 0.6rem !important;
  border: 1px solid rgba(var(--fc, 52, 214, 164), 0.35) !important;
  border-radius: 0.95rem !important;
  background: linear-gradient(145deg, rgba(var(--fc, 52, 214, 164), 0.28), rgba(var(--fc, 52, 214, 164), 0.07)) !important;
  color: rgb(var(--fc, 52, 214, 164)) !important;
  box-shadow: 0 8px 18px rgba(var(--fc, 52, 214, 164), 0.16);
}

/* subtle "swipe" hint under the row */
html.maalam-phone .setup-features::after {
  flex: 0 0 0.5rem;
  content: "";
}

/* ================= Key card ================= */
html.maalam-phone .setup-card {
  position: relative;
  isolation: isolate;
  box-sizing: border-box !important;
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  border: 0 !important;
  border-radius: 1.6rem !important;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.015)),
    rgb(14, 20, 22) !important;
  padding: clamp(1.15rem, 5.5vw, 1.5rem) !important;
  box-shadow:
    0 20px 50px rgba(0, 0, 0, 0.5),
    0 0 40px rgba(52, 214, 164, 0.05),
    inset 0 1px rgba(255, 255, 255, 0.07) !important;
}

/* gradient hairline border */
html.maalam-phone .setup-card::after {
  position: absolute;
  z-index: -1;
  inset: 0;
  padding: 1px;
  border-radius: inherit;
  background: linear-gradient(160deg, rgba(127, 227, 196, 0.55), rgba(127, 227, 196, 0.07) 42%, rgba(255, 224, 102, 0.3));
  content: "";
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  pointer-events: none;
}

/* small app-style section label above the title */
html.maalam-phone .setup-card-title::before {
  display: block;
  margin-bottom: 0.35rem;
  color: var(--hm-accent-soft);
  content: var(--maalam-t-laststep, "الخطوة الأخيرة");
  font-family: "IBM Plex Sans Arabic", sans-serif;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

html.maalam-phone .setup-card-title {
  font-size: 1.22rem !important;
  line-height: 1.4 !important;
}

html.maalam-phone .setup-card-sub {
  font-size: 0.8rem !important;
  line-height: 1.75 !important;
}

html.maalam-phone .key-field {
  min-height: 3.55rem !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
  border-radius: 1.1rem !important;
  background: rgba(0, 0, 0, 0.36) !important;
}

html.maalam-phone .key-field:focus-within {
  border-color: rgba(127, 227, 196, 0.7) !important;
  box-shadow: 0 0 0 4px rgba(52, 214, 164, 0.15) !important;
}

html.maalam-phone .key-field input {
  min-width: 0;
  font-size: 16px !important;
}

html.maalam-phone .key-field .icon-button {
  width: 2.7rem;
  height: 2.7rem;
  border-radius: 0.85rem;
}

html.maalam-phone .connect-button {
  position: relative;
  isolation: isolate;
  min-height: 3.65rem !important;
  overflow: hidden;
  border-radius: 1.2rem !important;
  font-size: 1rem !important;
  box-shadow: 0 14px 34px rgba(31, 184, 138, 0.28), inset 0 1px rgba(255, 255, 255, 0.35) !important;
}

html.maalam-phone .connect-button:not(:disabled)::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 30%, rgba(255, 255, 255, 0.4) 50%, transparent 70%);
  content: "";
  transform: translateX(-120%);
  animation: hm-sheen 4.4s ease-in-out 1.4s infinite;
  pointer-events: none;
}

html.maalam-phone .connect-button:active:not(:disabled) {
  transform: scale(0.985) !important;
}

html.maalam-phone .doda-card {
  border-radius: 1.1rem !important;
}

/* ================= Round floating navigation ================= */
.maalam-home-nav {
  position: fixed;
  z-index: 9997;
  right: max(0.8rem, env(safe-area-inset-right));
  bottom: calc(0.8rem + env(safe-area-inset-bottom));
  left: max(0.8rem, env(safe-area-inset-left));
  box-sizing: border-box;
  display: none;
  max-width: 25.5rem;
  height: 4.25rem;
  margin-inline: auto;
  align-items: stretch;
  gap: 0.1rem;
  padding: 0.4rem;
  border: 1px solid rgba(127, 227, 196, 0.22);
  border-radius: 999px;
  background: rgb(13, 19, 21);
  box-shadow:
    0 16px 40px rgba(0, 0, 0, 0.65),
    0 2px 10px rgba(52, 214, 164, 0.08),
    inset 0 1px rgba(255, 255, 255, 0.1);
  direction: rtl;
  font-family: "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif;
  animation: hm-nav-in 560ms var(--hm-ease) 160ms both;
  transform: translateZ(0);
}

html.maalam-phone .maalam-home-nav {
  display: flex;
}

html.maalam-phone.maalam-keyboard-open .maalam-home-nav {
  display: none !important;
}

/* sliding highlight behind the active tab */
.maalam-home-nav__indicator {
  position: absolute;
  z-index: 0;
  top: 0.4rem;
  bottom: 0.4rem;
  left: 0;
  width: 0;
  border: 1px solid rgba(127, 227, 196, 0.3);
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(52, 214, 164, 0.22), rgba(52, 214, 164, 0.1));
  box-shadow: 0 0 22px rgba(52, 214, 164, 0.14);
  opacity: 0;
  pointer-events: none;
}

.maalam-home-nav[data-ready="true"] .maalam-home-nav__indicator {
  opacity: 1;
  transition:
    transform 440ms var(--hm-ease),
    width 440ms var(--hm-ease),
    background 300ms ease,
    border-color 300ms ease,
    box-shadow 300ms ease,
    opacity 200ms ease;
}

.maalam-home-nav__indicator[data-tone="primary"] {
  border-color: rgba(255, 255, 255, 0.3);
  background: linear-gradient(135deg, #4cebb9, #1fb88a);
  box-shadow: 0 10px 26px rgba(31, 184, 138, 0.45), inset 0 1px rgba(255, 255, 255, 0.42);
}

.maalam-home-nav__item {
  position: relative;
  z-index: 1;
  display: flex;
  min-width: 0;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #7f8f89;
  font: inherit;
  font-size: 0.64rem;
  font-weight: 600;
  line-height: 1;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: color 240ms ease, transform 180ms var(--hm-ease);
}

.maalam-home-nav__icon {
  display: grid;
  width: 1.45rem;
  height: 1.45rem;
  place-items: center;
  transition: transform 340ms var(--hm-ease);
}

.maalam-home-nav__icon svg {
  width: 1.3rem;
  height: 1.3rem;
}

.maalam-home-nav__item:active {
  transform: scale(0.91);
}

.maalam-home-nav__item[aria-current="page"] {
  color: #8ff0cf;
}

.maalam-home-nav__item[aria-current="page"] .maalam-home-nav__icon {
  transform: translateY(-1px) scale(1.14);
}

/* the call-to-action tab is always a little greener than the rest */
.maalam-home-nav__item[data-tab="start"] {
  color: #6fe0bb;
}

.maalam-home-nav__item[data-tab="start"][aria-current="page"] {
  color: #06231b;
}

/* ================= Help sheet ================= */
.maalam-help-intro {
  margin: 0;
  color: #aebbb7;
  font-size: 0.86rem;
  line-height: 1.85;
}

.maalam-help-steps {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.maalam-help-step {
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  padding: 0.85rem 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 1.05rem;
  background: rgba(255, 255, 255, 0.03);
}

.maalam-help-step__num {
  display: grid;
  width: 1.95rem;
  height: 1.95rem;
  flex: none;
  place-items: center;
  border-radius: 0.75rem;
  background: linear-gradient(135deg, #43e3b1, #1fb88a);
  color: #06231b;
  font-size: 0.85rem;
  font-weight: 800;
}

.maalam-help-step strong {
  display: block;
  font-size: 0.92rem;
  line-height: 1.55;
}

.maalam-help-step small {
  display: block;
  margin-top: 0.15rem;
  color: #93a09b;
  font-size: 0.78rem;
  line-height: 1.75;
}

.maalam-help-tip {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.85rem 0.9rem;
  border: 1px dashed rgba(255, 224, 102, 0.32);
  border-radius: 1.05rem;
  background: rgba(255, 224, 102, 0.05);
  color: #ebe2b4;
  font-size: 0.8rem;
  line-height: 1.8;
}

.maalam-help-tip svg {
  width: 1.2rem;
  height: 1.2rem;
  flex: none;
  margin-top: 0.15rem;
  color: #ffe066;
}

a.maalam-sheet__save {
  text-decoration: none;
}

/* ================= Short screens (small phones / landscape) ================= */
@media (max-height: 720px) {
  html.maalam-phone .setup-grid {
    gap: 0.75rem !important;
    padding-top: calc(env(safe-area-inset-top) + 4.3rem) !important;
  }

  html.maalam-phone .setup-grid > :first-child > :first-child .maalam-logo {
    width: clamp(3.25rem, 13vw, 3.8rem) !important;
    height: clamp(3.25rem, 13vw, 3.8rem) !important;
  }

  html.maalam-phone .setup-eyebrow {
    margin-top: 0.3rem !important;
  }

  html.maalam-phone .setup-title {
    margin-top: 0.35rem !important;
  }

  html.maalam-phone .setup-features {
    margin-top: 0.75rem !important;
  }
}

@media (max-height: 520px) {
  .maalam-home-nav {
    height: 3.5rem;
    bottom: calc(0.5rem + env(safe-area-inset-bottom));
  }

  .maalam-home-nav__indicator {
    top: 0.4rem;
    bottom: 0.4rem;
  }

  .maalam-home-nav__label {
    display: none;
  }

  html.maalam-phone .setup-screen::after {
    height: calc(5.5rem + env(safe-area-inset-bottom));
  }

  html.maalam-phone .setup-grid {
    padding-bottom: calc(6rem + env(safe-area-inset-bottom)) !important;
  }
}

@media (max-width: 360px) {
  html.maalam-phone .setup-features li {
    width: 8.9rem !important;
    font-size: 0.7rem !important;
  }

  html.maalam-phone .setup-title {
    font-size: clamp(1.8rem, 10vw, 2.3rem) !important;
    padding: 1rem 1rem 0.95rem !important;
  }

  html.maalam-phone .setup-badge {
    display: none !important;
  }

  .maalam-home-nav__item {
    font-size: 0.6rem;
  }
}

/* ================= Beta marks (text comes from CSS variables, so it follows the language) ================= */
html.maalam-phone .setup-eyebrow::after {
  margin-inline-start: 0.55rem;
  padding: 0.08rem 0.45rem;
  border-radius: 999px;
  background: #ffe066;
  color: #2b2300;
  content: var(--maalam-beta-chip, "BETA");
  font-size: 0.56rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  line-height: 1.5;
}

html.maalam-phone .setup-lead::after {
  display: block;
  margin-top: 0.85rem;
  padding: 0.6rem 0.8rem;
  border: 1px dashed rgba(255, 224, 102, 0.38);
  border-radius: 0.9rem;
  background: rgba(255, 224, 102, 0.06);
  color: #e6dcab;
  content: var(--maalam-beta-note, "BETA");
  font-size: 0.74rem;
  line-height: 1.75;
}

.maalam-help-beta {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  padding: 0.75rem 0.9rem;
  border: 1px dashed rgba(255, 224, 102, 0.3);
  border-radius: 1.05rem;
  background: rgba(255, 224, 102, 0.045);
  color: #e0d6a4;
  font-size: 0.78rem;
  line-height: 1.8;
}

.maalam-help-beta b {
  flex: none;
  margin-top: 0.22rem;
  padding: 0.08rem 0.45rem;
  border-radius: 999px;
  background: #ffe066;
  color: #2b2300;
  font-size: 0.56rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  line-height: 1.5;
}

/* ================= Pinned top app bar (home screen) ================= */
.maalam-home-topbar {
  position: fixed;
  z-index: 9995;
  top: 0;
  right: 0;
  left: 0;
  box-sizing: border-box;
  display: none;
  height: calc(4.05rem + env(safe-area-inset-top));
  align-items: center;
  justify-content: flex-start;
  padding: env(safe-area-inset-top) max(1rem, env(safe-area-inset-right)) 0 max(1rem, env(safe-area-inset-left));
  pointer-events: none;
}

html.maalam-phone .maalam-home-topbar {
  display: flex;
}

html.maalam-phone.maalam-keyboard-open .maalam-home-topbar {
  display: none;
}

/* Frosted glass: GPU-promoted (translateZ) with a moderate blur so it stays
   cheap while still looking frosted. A darker scrim below carries most of the
   legibility, which keeps the blur radius low and the jank minimal. */
.maalam-home-topbar::before {
  content: "";
  position: absolute;
  z-index: -2;
  top: 0;
  right: 0;
  left: 0;
  height: calc(100% + 1.8rem);
  -webkit-backdrop-filter: blur(12px) saturate(1.1);
  backdrop-filter: blur(12px) saturate(1.1);
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 45%, rgba(0, 0, 0, 0.6) 70%, transparent 100%);
  mask-image: linear-gradient(to bottom, #000 0%, #000 45%, rgba(0, 0, 0, 0.6) 70%, transparent 100%);
  pointer-events: none;
  will-change: backdrop-filter;
  transform: translateZ(0);
}

/* Dark scrim: strongest at the very top of the screen, fading cleanly. */
.maalam-home-topbar::after {
  content: "";
  position: absolute;
  z-index: -1;
  top: 0;
  right: 0;
  left: 0;
  height: calc(100% + 1.8rem);
  background: linear-gradient(
    to bottom,
    rgba(5, 8, 9, 0.96) 0%,
    rgba(5, 8, 9, 0.82) 45%,
    rgba(5, 8, 9, 0.45) 75%,
    transparent 100%
  );
  pointer-events: none;
  transform: translateZ(0);
}

/* Without backdrop blur (older browsers) the scrim alone keeps text readable. */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .maalam-home-topbar::after {
    background: linear-gradient(
      to bottom,
      rgba(4, 7, 8, 0.97) 0%,
      rgba(4, 7, 8, 0.9) 45%,
      rgba(4, 7, 8, 0.6) 70%,
      rgba(4, 7, 8, 0.22) 86%,
      transparent 100%
    );
  }
}

.maalam-home-topbar__brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.maalam-home-topbar__name {
  color: #f3f6f4;
  font-family: "Sora", "IBM Plex Sans Arabic", sans-serif;
  font-size: 1.08rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  text-transform: lowercase;
}

/* Same modern glass bevel as the splash and home logos. */
/* Modern tactile bevel/emboss on the top-bar logo, matching splash and hero:
   crisp light-catching top edge, deep lower shadow, micro-bevel border, and top-down glass sheen */
.maalam-home-topbar__logo {
  position: relative;
  display: block;
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  overflow: hidden;
  border-radius: 26%;
  box-shadow:
    inset 0 1.5px 0.5px rgba(255, 255, 255, 0.8),
    inset 0 -3.5px 6px rgba(1, 10, 8, 0.65),
    inset 2px 0 3px rgba(255, 255, 255, 0.2),
    inset -2px 0 4px rgba(1, 10, 8, 0.45),
    inset 0 0 0 1px rgba(255, 255, 255, 0.25),
    0 1px 2px rgba(255, 255, 255, 0.15),
    0 8px 20px rgba(0, 0, 0, 0.6),
    0 0 24px rgba(52, 214, 164, 0.18);
  transform: translateZ(0);
}

.maalam-home-topbar__logo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.maalam-home-topbar__logo::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 2;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: inherit;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.6),
    inset 0 -1.5px 1px rgba(0, 0, 0, 0.7);
  pointer-events: none;
}

.maalam-home-topbar__logo::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 3;
  border-radius: inherit;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.08) 28%, transparent 52%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, transparent 36%);
  mix-blend-mode: screen;
  opacity: 0.85;
  pointer-events: none;
}

/* ================= Floating language switcher (home screen) ================= */
.maalam-lang-pill {
  position: fixed;
  z-index: 9996;
  top: calc(0.8rem + env(safe-area-inset-top));
  left: max(0.9rem, env(safe-area-inset-left));
  display: none;
  align-items: center;
  gap: 0.12rem;
  padding: 0.22rem;
  border: 1px solid rgba(127, 227, 196, 0.22);
  border-radius: 999px;
  background: rgb(15, 22, 24);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.45);
  direction: ltr;
  font-family: "IBM Plex Sans Arabic", system-ui, sans-serif;
  transform: translateZ(0);
}

html[data-ui-dir="ltr"] .maalam-lang-pill {
  right: max(0.9rem, env(safe-area-inset-right));
  left: auto;
}

html.maalam-phone .maalam-lang-pill {
  display: flex;
}

html.maalam-phone.maalam-keyboard-open .maalam-lang-pill {
  display: none;
}

.maalam-lang-pill button {
  min-width: 2.4rem;
  height: 2rem;
  padding: 0 0.55rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #8fa39b;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: background 160ms ease, color 160ms ease;
}

.maalam-lang-pill button[aria-pressed="true"] {
  background: linear-gradient(135deg, #4cebb9, #1fb88a);
  color: #06231b;
}

/* ================= Motion ================= */
@keyframes hm-rise {
  from {
    opacity: 0;
    transform: translateY(0.9rem);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes hm-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-0.35rem);
  }
}

@keyframes hm-sheen {
  0%,
  62% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(120%);
  }
}

@keyframes hm-nav-in {
  from {
    opacity: 0;
    transform: translateY(1.3rem) scale(0.96);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  html.maalam-phone .setup-grid > :first-child > *,
  html.maalam-phone .setup-grid > :last-child,
  html.maalam-phone .setup-grid > :first-child .maalam-logo,
  html.maalam-phone .connect-button::after,
  .maalam-home-nav,
  .maalam-home-nav__indicator,
  .maalam-home-nav__item,
  .maalam-home-nav__icon {
    animation: none !important;
    transition: none !important;
  }

  html.maalam-phone .setup-screen {
    scroll-behavior: auto;
  }
}
`;

export function addHomeStyles(): void {
  if (document.getElementById("maalam-home-styles")) return;
  const style = document.createElement("style");
  style.id = "maalam-home-styles";
  style.textContent = withInsetFallback(HOME_CSS);
  document.head.appendChild(style);
}

/* ===================================================================== */
/* Help sheet                                                              */
/* ===================================================================== */

function helpSteps(): { title: string; text: string }[] {
  return [
    { title: t("helpStep1Title"), text: t("helpStep1Text") },
    { title: t("helpStep2Title"), text: t("helpStep2Text") },
    { title: t("helpStep3Title"), text: t("helpStep3Text") },
  ];
}

function openHelpSheet(onClosed: () => void): () => void {
  const backdrop = document.createElement("div");
  backdrop.className = "maalam-sheet-backdrop";

  const sheet = document.createElement("section");
  sheet.className = "maalam-sheet";
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-labelledby", "maalam-help-title");
  sheet.dir = uiDir();

  const steps = helpSteps()
    .map(
      (step, index) => `
      <li class="maalam-help-step">
        <span class="maalam-help-step__num" aria-hidden="true">${index + 1}</span>
        <span><strong>${step.title}</strong><small>${step.text}</small></span>
      </li>`,
    )
    .join("");

  sheet.innerHTML = `
    <header class="maalam-sheet__head">
      <h2 class="maalam-sheet__title" id="maalam-help-title">${t("helpTitle")}</h2>
      <button class="maalam-sheet__close" type="button" aria-label="${t("close")}">${svg("close")}</button>
    </header>
    <div class="maalam-sheet__body">
      <p class="maalam-help-intro">${t("helpIntro")}</p>
      <ol class="maalam-help-steps">${steps}</ol>
      <div class="maalam-help-tip">
        ${svg("bulb")}
        <span>${t("helpTipBefore")} <strong>⋮</strong> ${t("helpTipAfter")}</span>
      </div>
      <div class="maalam-help-beta"><b>${t("betaChip")}</b><span>${t("betaNote").replace(/^[A-ZÊ]+\s—\s/, "")}</span></div>
    </div>
    <footer class="maalam-sheet__foot">
      <a class="maalam-sheet__save" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
        ${svg("external")}<span>${t("helpOpenStudio")}</span>
      </a>
    </footer>
  `;

  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);
  window.requestAnimationFrame(() => {
    backdrop.classList.add("is-in");
    sheet.querySelector<HTMLButtonElement>(".maalam-sheet__close")?.focus({ preventScroll: true });
  });

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    untrackOverlay(close);
    document.removeEventListener("keydown", onKey);
    backdrop.classList.remove("is-in");
    window.setTimeout(() => backdrop.remove(), 260);
    onClosed();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };
  trackOverlay("help", close);
  document.addEventListener("keydown", onKey);

  backdrop.addEventListener("pointerdown", (event) => {
    if (event.target === backdrop) close();
  });
  sheet.querySelector<HTMLButtonElement>(".maalam-sheet__close")?.addEventListener("click", close);

  return close;
}

/* ===================================================================== */
/* Round floating navigation                                               */
/* ===================================================================== */

function tap(): void {
  try {
    navigator.vibrate?.(8);
  } catch {
    /* haptics are optional */
  }
}

export function createHomeNavigation(setup: HTMLElement): HomeNav {
  const nav = document.createElement("nav");
  nav.className = "maalam-home-nav";
  nav.setAttribute("aria-label", t("navAria"));

  const tabs: { id: Tab; key: StringKey; icon: keyof typeof ICONS }[] = [
    { id: "home", key: "navHome", icon: "home" },
    { id: "features", key: "navFeatures", icon: "features" },
    { id: "help", key: "navHelp", icon: "help" },
    { id: "start", key: "navStart", icon: "start" },
  ];

  nav.innerHTML =
    `<span class="maalam-home-nav__indicator" aria-hidden="true"></span>` +
    tabs
      .map(
        (tab) => `
      <button class="maalam-home-nav__item" type="button" data-tab="${tab.id}" aria-label="${t(tab.key)}"${tab.id === "home" ? ' aria-current="page"' : ""}>
        <span class="maalam-home-nav__icon">${svg(tab.icon)}</span>
        <span class="maalam-home-nav__label">${t(tab.key)}</span>
      </button>`,
      )
      .join("");

  const indicator = nav.querySelector<HTMLElement>(".maalam-home-nav__indicator")!;
  const buttons = Array.from(nav.querySelectorAll<HTMLButtonElement>(".maalam-home-nav__item"));
  const button = (tab: Tab) => buttons.find((item) => item.dataset.tab === tab)!;

  let current: Tab = "home";
  let beforeHelp: Tab = "home";
  let lockUntil = 0;
  let closeHelp: (() => void) | null = null;

  const moveIndicator = () => {
    const active = button(current);
    if (!active.offsetWidth) return;
    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.transform = `translateX(${active.offsetLeft}px)`;
    indicator.dataset.tone = current === "start" ? "primary" : "soft";
  };

  const setCurrent = (tab: Tab, lock = false) => {
    current = tab;
    buttons.forEach((item) => {
      if (item.dataset.tab === tab) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    moveIndicator();
    if (lock) lockUntil = performance.now() + 800;
  };

  /** Which section is on screen right now (drives the highlighted tab while scrolling). */
  const detect = (): Tab => {
    const max = setup.scrollHeight - setup.clientHeight;
    if (max < 12) return current;
    const top = setup.scrollTop;
    if (top < 24) return "home";
    if (top > max - 24) return "start";
    const mid = setup.clientHeight * 0.5;
    const card = setup.querySelector<HTMLElement>(".setup-card");
    const features = setup.querySelector<HTMLElement>(".setup-features");
    if (card && card.getBoundingClientRect().top < mid) return "start";
    if (features && features.getBoundingClientRect().top < mid) return "features";
    return "home";
  };

  let scrollTicking = false;
  const onScroll = () => {
    if (closeHelp || performance.now() < lockUntil || scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(() => {
      scrollTicking = false;
      const next = detect();
      if (next !== current) setCurrent(next);
    });
  };
  setup.addEventListener("scroll", onScroll, { passive: true });

  const openHelp = () => {
    if (closeHelp) return;
    beforeHelp = current;
    setCurrent("help");
    closeHelp = openHelpSheet(() => {
      closeHelp = null;
      setCurrent(beforeHelp);
      button("help").focus({ preventScroll: true });
    });
  };

  button("home").addEventListener("click", () => {
    tap();
    setup.scrollTo({ top: 0, behavior: "smooth" });
    setCurrent("home", true);
  });

  button("features").addEventListener("click", () => {
    tap();
    setup.querySelector<HTMLElement>(".setup-features")?.scrollIntoView({ behavior: "smooth", block: "center" });
    setCurrent("features", true);
  });

  button("help").addEventListener("click", () => {
    tap();
    openHelp();
  });

  button("start").addEventListener("click", () => {
    tap();
    const field = setup.querySelector<HTMLInputElement>(".key-field input");
    const connect = setup.querySelector<HTMLButtonElement>(".connect-button");
    setCurrent("start", true);
    // Key already typed: Start really starts. Otherwise guide the user to the key field.
    if (field?.value.trim() && connect && !connect.disabled) {
      connect.click();
      return;
    }
    setup.querySelector<HTMLElement>(".setup-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => field?.focus({ preventScroll: true }), 320);
  });

  /* Floating language switcher (home screen only, removed together with the nav). */
  const pill = document.createElement("div");
  pill.className = "maalam-lang-pill";
  pill.setAttribute("role", "group");
  pill.setAttribute("aria-label", t("uiLanguage"));
  pill.innerHTML = LANGS.map(
    (lang) =>
      `<button type="button" data-lang="${lang.id}" aria-label="${lang.name}" aria-pressed="${lang.id === getLang()}">${lang.short}</button>`,
  ).join("");
  pill.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-lang]");
    if (!target) return;
    tap();
    setLang(target.dataset.lang as Lang);
  });
  document.body.appendChild(pill);

  /* Pinned top app bar: "maalam" + beveled logo, always above the scrolling
     content, with a fade so content slides softly underneath it. It replaces
     the app's own header row, which is hidden while the home screen is shown. */
  const topbar = document.createElement("div");
  topbar.className = "maalam-home-topbar";
  topbar.dir = uiDir();
  topbar.innerHTML = `
    <div class="maalam-home-topbar__brand" dir="ltr">
      <span class="maalam-home-topbar__name">maalam</span>
      <span class="maalam-home-topbar__logo"><img src="${LOGO_URL}" alt="" /></span>
    </div>`;
  document.body.appendChild(topbar);

  const hiddenHeaders = new Set<HTMLElement>();
  const HERO_CONTENT = ".setup-title, .setup-lead, .setup-features, .setup-card, .setup-eyebrow";
  /** Hides every original logo row that sits above the hero title. */
  const hideOriginalHeaders = (): boolean => {
    const title = setup.querySelector(".setup-title");
    let found = false;
    setup.querySelectorAll<HTMLElement>(".maalam-logo").forEach((logo) => {
      let candidate: HTMLElement | null = null;
      let node: HTMLElement | null = logo.parentElement;
      while (node && node !== setup) {
        if (node.matches(HERO_CONTENT) || node.querySelector(HERO_CONTENT)) break;
        candidate = node;
        node = node.parentElement;
      }
      if (!candidate) return;
      if (title && !(candidate.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING)) return;
      found = true;
      if (hiddenHeaders.has(candidate)) return;
      hiddenHeaders.add(candidate);
      candidate.style.setProperty("display", "none", "important");
    });
    return found;
  };
  let headerTries = 0;
  const headerTimer = window.setInterval(() => {
    headerTries += 1;
    if (hideOriginalHeaders() || headerTries > 30) window.clearInterval(headerTimer);
  }, 100);
  hideOriginalHeaders();

  /** Re-labels the whole bar in place when the interface language changes. */
  const relabel = () => {
    topbar.dir = uiDir();
    nav.setAttribute("aria-label", t("navAria"));
    tabs.forEach((tab) => {
      const item = button(tab.id);
      item.setAttribute("aria-label", t(tab.key));
      const label = item.querySelector(".maalam-home-nav__label");
      if (label) label.textContent = t(tab.key);
    });
    pill.setAttribute("aria-label", t("uiLanguage"));
    pill.querySelectorAll<HTMLButtonElement>("button[data-lang]").forEach((item) => {
      item.setAttribute("aria-pressed", String(item.dataset.lang === getLang()));
    });
    window.requestAnimationFrame(moveIndicator);
  };
  const offLang = onLangChange(relabel);

  // Keep the indicator aligned when the layout changes (rotation, font load, resize).
  const resizeObserver = new ResizeObserver(moveIndicator);
  resizeObserver.observe(nav);
  window.addEventListener("resize", moveIndicator, { passive: true });
  void document.fonts?.ready.then(moveIndicator);
  window.requestAnimationFrame(() => {
    moveIndicator();
    window.requestAnimationFrame(() => {
      nav.dataset.ready = "true";
    });
  });

  return {
    root: nav,
    setup,
    destroy: () => {
      closeHelp?.();
      closeHelp = null;
      offLang();
      setup.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", moveIndicator);
      resizeObserver.disconnect();
      pill.remove();
      window.clearInterval(headerTimer);
      topbar.remove();
      hiddenHeaders.forEach((header) => header.style.removeProperty("display"));
      hiddenHeaders.clear();
      nav.remove();
    },
  };
}
/* ---------------------------------------------------------------------
   Setup persistence: saved key, no autofocus jump, auto-start           */
/* ===================================================================== */

const setupSeen = new WeakSet<HTMLElement>();
let autoStartClicked = false;
let formTouched = false;

/** True once the returning user was auto-signed-in (used to restore history). */
export function didAutoStart(): boolean {
  return autoStartClicked;
}

function setFieldValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  // React listens to these: the app's own state updates as if the user typed.
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Runs once per home screen: kills the autofocus jump, restores the saved API
 * key silently, keeps it saved while typing, and auto-starts returning users.
 */
export function syncSetupScreen(setup: HTMLElement): void {
  if (setupSeen.has(setup)) return;
  const input = setup.querySelector<HTMLInputElement>(".key-field input");
  const start = setup.querySelector<HTMLButtonElement>(".connect-button");
  if (!input || !start) return;
  setupSeen.add(setup);

  // The app autofocuses the key field on mount, which yanks the page down to
  // the API box and pops the keyboard. Home must open regularly, at the top.
  try {
    (input as HTMLInputElement & { autofocus?: boolean }).autofocus = false;
  } catch {
    /* ignore */
  }
  input.removeAttribute("autofocus");

  const saved = getSavedApiKey();
  const hadValue = input.value.trim().length > 0;
  if (saved && !hadValue) setFieldValue(input, saved);

  input.addEventListener("input", () => {
    formTouched = true;
    const value = input.value.trim();
    if (value) saveApiKey(value);
  });
  input.addEventListener("pointerdown", () => {
    formTouched = true;
  }, { passive: true });
  input.addEventListener("focus", () => {
    formTouched = true;
  });
  start.addEventListener("click", () => {
    const value = input.value.trim();
    if (value) saveApiKey(value);
  });

  // Undo the autofocus jump if it already happened before we got here.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (formTouched) return;
      if (document.activeElement === input) input.blur();
      if (setup.scrollTop > 0) setup.scrollTo({ top: 0 });
    });
  });

  // Returning user with a saved key: start automatically, once per page load.
  if (!saved || hadValue || autoStartClicked) return;
  let tries = 0;
  const timer = window.setInterval(() => {
    tries += 1;
    const field = setup.querySelector<HTMLInputElement>(".key-field input");
    const button = setup.querySelector<HTMLButtonElement>(".connect-button");
    if (!setup.isConnected || !field || !button || formTouched || tries > 40) {
      window.clearInterval(timer);
      return;
    }
    // The user took over the form: never steal the tap.
    if (field.value.trim() !== saved) {
      window.clearInterval(timer);
      return;
    }
    if (button.disabled) return;
    window.clearInterval(timer);
    autoStartClicked = true;
    button.click();
  }, 250);
}
