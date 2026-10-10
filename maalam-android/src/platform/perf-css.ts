/**
 * Native-performance CSS layer (phones only).
 *
 * Four jobs, all pure CSS so nothing changes on the web build:
 *
 *  1. Press feedback — a slight scale on :active for the shell's controls and
 *     the core app's icon buttons. transform+opacity only, 160 ms, one curve.
 *  2. Cheap list virtualisation — content-visibility:auto on chat transcript
 *     rows and history rows makes the browser skip layout/paint for rows off
 *     screen. Unlike JS windowing it never removes nodes from the DOM, so the
 *     phone shell's transcript scraping (history.ts) keeps working.
 *  3. Lite mode (html[data-lite="1"]) — drops the decorative glow/aurora/
 *     particle layers and long shadows on low-end devices.
 *  4. Reduced motion (html[data-reduced-motion="1"]) — collapses every
 *     non-essential animation, honouring the system setting.
 */
export const PERF_CSS = `
/* ---- 1. press feedback ------------------------------------------------- */
@media (pointer: coarse) {
  html.maalam-phone .maalam-rail__item,
  html.maalam-phone .maalam-rail-toggle,
  html.maalam-phone .maalam-opt,
  html.maalam-phone .maalam-sheet__close,
  html.maalam-phone .maalam-sheet__save,
  html.maalam-phone .maalam-chat-drag button,
  html.maalam-phone .maalam-lang-pill button,
  html.maalam-phone .maalam-home-nav__item,
  html.maalam-phone .maalam-hist-row,
  html.maalam-phone .maalam-hist-del,
  html.maalam-phone .maalam-toast button,
  .icon-button,
  .header-icon-button,
  .banner-action,
  .connect-button,
  .composer-send {
    transition:
      transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1),
      opacity 160ms cubic-bezier(0.2, 0.8, 0.2, 1),
      background-color 160ms linear;
    will-change: transform;
  }
  html.maalam-phone .maalam-rail__item:active,
  html.maalam-phone .maalam-rail-toggle:active,
  html.maalam-phone .maalam-opt:active,
  html.maalam-phone .maalam-sheet__close:active,
  html.maalam-phone .maalam-sheet__save:active,
  html.maalam-phone .maalam-chat-drag button:active,
  html.maalam-phone .maalam-lang-pill button:active,
  html.maalam-phone .maalam-home-nav__item:active,
  html.maalam-phone .maalam-hist-row:active,
  .icon-button:active,
  .header-icon-button:active,
  .connect-button:active,
  .composer-send:active {
    transform: scale(0.965);
    opacity: 0.92;
  }
}

/* ---- 2. cheap list virtualisation -------------------------------------- */
article.message-enter,
.maalam-hist-row {
  content-visibility: auto;
  contain-intrinsic-size: auto 7rem;
}

/* ---- 3. lite mode ------------------------------------------------------- */
html[data-lite="1"] .ambient,
html[data-lite="1"] .ambient-one,
html[data-lite="1"] .ambient-two,
html[data-lite="1"] .chat-glow,
html[data-lite="1"] .chalk-particles-field,
html[data-lite="1"] .chalk-dust-particle,
html[data-lite="1"] .host__aurora,
html[data-lite="1"] .host__grid {
  display: none !important;
}
html[data-lite="1"] .maalam-sheet-backdrop {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  background: rgba(4, 7, 8, 0.72) !important;
}
html[data-lite="1"] .host__mascot-frame {
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22) !important;
}

/* ---- 4b. app-settings rows in the settings sheet ------------------------ */
.maalam-sheet__clearwrap {
  margin-top: 1.1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--m-line, rgba(255, 255, 255, 0.08));
}
.maalam-sheet__clear {
  width: 100%;
  min-height: 3rem;
  border: 1px solid rgba(255, 120, 120, 0.35);
  border-radius: 0.9rem;
  background: rgba(255, 90, 90, 0.08);
  color: #ffb4b4;
  font: inherit;
  font-size: 0.92rem;
  font-weight: 600;
}
.maalam-sheet__clear.is-armed {
  background: rgba(255, 90, 90, 0.2);
  color: #ffd7d7;
}
.maalam-sheet__clear:disabled {
  opacity: 0.6;
}

/* ---- 4. reduced motion -------------------------------------------------- */
html[data-reduced-motion="1"] *,
html[data-reduced-motion="1"] *::before,
html[data-reduced-motion="1"] *::after {
  animation-duration: 1ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 1ms !important;
  scroll-behavior: auto !important;
}
`;
