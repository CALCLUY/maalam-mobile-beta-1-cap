/**
 * Android back routing.
 *
 * The web shell has no router: sheets are plain DOM elements and the three
 * phone views (board / chat / settings) are a local variable inside mobile.ts.
 * So "back" is resolved by a small ordered registry:
 *
 *   1. the top-most open sheet / overlay   (language, history, settings, chat,
 *                                           rotate-landscape, toast-with-action)
 *   2. one step inside the phone UI        (chat|settings -> board)
 *   3. the home screen                     -> exit the app
 *
 * Handlers are tried in registration order; the first that reports `true`
 * (i.e. it consumed the event) wins. On the web (no Capacitor bridge) the
 * registry is unused and the browser keeps its own back behaviour.
 */

export type BackHandler = {
  /** Stable name, useful in logs and tests. */
  name: string;
  /** Return true when this handler consumed the back press. */
  handle: () => boolean;
};

const handlers: BackHandler[] = [];

/** Register in priority order: call this early for higher-priority handlers. */
export function registerBackHandler(handler: BackHandler): () => void {
  handlers.push(handler);
  return () => {
    const index = handlers.indexOf(handler);
    if (index >= 0) handlers.splice(index, 1);
  };
}

/** Runs the first handler that consumes the press. Returns true if handled. */
export function runBackHandlers(): boolean {
  for (const handler of handlers) {
    try {
      if (handler.handle()) return true;
    } catch {
      // A broken handler must never trap the user in the app.
    }
  }
  return false;
}

/** True while any sheet/overlay is open — used by the predictive-back check. */
export function hasConsumingOverlay(): boolean {
  return handlers.length > 0;
}
