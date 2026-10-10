/**
 * Overlay (sheet / modal) registry.
 *
 * Every sheet the phone shell opens calls trackOverlay(id, close) and
 * untrackOverlay(close) from inside its own close(), so the Android back button
 * can dismiss the top-most layer first, exactly like a native app. On the web
 * the registry is inert: sheets still close on Escape and backdrop taps.
 */

type Entry = { id: string; close: () => void };

const stack: Entry[] = [];

export function trackOverlay(id: string, close: () => void): void {
  stack.push({ id, close });
}

export function untrackOverlay(close: () => void): void {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    if (stack[i].close === close) {
      stack.splice(i, 1);
      return;
    }
  }
}

export function overlayCount(): number {
  return stack.length;
}

export function topOverlayId(): string | null {
  return stack.length ? stack[stack.length - 1].id : null;
}

/** Close the newest open sheet. Returns true if one was closed. */
export function closeTopOverlay(): boolean {
  const entry = stack.pop();
  if (!entry) return false;
  entry.close();
  return true;
}
