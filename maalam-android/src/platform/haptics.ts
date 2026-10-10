/**
 * Haptic feedback (light, native-feeling) with a user-visible off switch.
 *
 * Used on: send, quiz answer, board clear. Nothing else vibrates, so the
 * feedback stays meaningful. The toggle lives in the phone settings sheet and
 * is persisted with Capacitor Preferences.
 */
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { readSettings } from "./device";
import { STORAGE_KEYS, storageSet } from "./storage";

export function hapticsEnabled(): boolean {
  return readSettings().haptics !== "off";
}

export function setHapticsEnabled(next: boolean): void {
  const settings = readSettings();
  settings.haptics = next ? "on" : "off";
  storageSet(STORAGE_KEYS.settings, JSON.stringify(settings));
}

async function run(fn: () => Promise<void>): Promise<void> {
  if (!hapticsEnabled()) return;
  if (!Capacitor.isNativePlatform()) return;
  try {
    await fn();
  } catch {
    // No vibrator / no permission — haptics must never break a flow.
  }
}

/** Light tick: send, quiz answer. */
export function tap(): Promise<void> {
  return run(() => Haptics.impact({ style: ImpactStyle.Light }));
}

/** Confirmation: correct quiz answer. */
export function success(): Promise<void> {
  return run(() => Haptics.notification({ type: NotificationType.Success }));
}

/** Destructive-but-intended: board clear. */
export function warn(): Promise<void> {
  return run(() => Haptics.notification({ type: NotificationType.Warning }));
}
