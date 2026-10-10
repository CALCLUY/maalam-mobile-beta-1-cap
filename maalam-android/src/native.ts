/**
 * Native-feel touch behaviour for coarse pointers (phones / tablets).
 *
 * - No rubber-banding / pull-to-refresh: iOS Safari on older versions still
 *   rubber-bands even with `overscroll-behavior: none`, so a touchmove guard
 *   clamps gestures at the scroll boundaries. The handler only does a style
 *   read when it is actually at a boundary, so normal scrolling stays cheap.
 * - No long-press context menu on buttons and other controls.
 */
export function enableNativeTouch(): void {
  if (typeof window === "undefined" || !window.matchMedia("(pointer: coarse)").matches) return;

  let lastY = 0;
  document.addEventListener(
    "touchstart",
    (e) => {
      lastY = e.touches[0]?.clientY ?? lastY;
    },
    { passive: true },
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      const y = e.touches[0]?.clientY;
      if (y === undefined) return;
      const dy = y - lastY;
      lastY = y;
      if (dy === 0) return;

      // Find the scrollable element under the finger (if any).
      let el: HTMLElement | null = e.target instanceof HTMLElement ? e.target : null;
      while (el && el !== document.body && el !== document.documentElement) {
        const s = window.getComputedStyle(el);
        if ((s.overflowY === "auto" || s.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 1) {
          const atTop = el.scrollTop <= 0;
          const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
          if ((atTop && dy < 0) || (atBottom && dy > 0)) e.preventDefault();
          return;
        }
        el = el.parentElement;
      }

      const root = document.scrollingElement;
      if (root && root.scrollHeight > root.clientHeight + 1) {
        const atTop = root.scrollTop <= 0;
        const atBottom = root.scrollTop + root.clientHeight >= root.scrollHeight - 1;
        if ((atTop && dy < 0) || (atBottom && dy > 0)) e.preventDefault();
      }
    },
    { passive: false },
  );

  // Native apps don't show the browser's long-press menu on controls.
  document.addEventListener(
    "contextmenu",
    (e) => {
      const t = e.target;
      if (t instanceof HTMLElement && t.closest("button, [role='button'], [role='tab'], a, [tabindex]")) {
        e.preventDefault();
      }
    },
    { passive: false },
  );
}
