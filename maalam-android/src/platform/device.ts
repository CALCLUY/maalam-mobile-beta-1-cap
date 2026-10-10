/**
 * Device capability detection: reduce-motion + a "lite" tier for low-end phones.
 *
 *  - prefers-reduced-motion is a user setting; it must disable non-essential
 *    animation everywhere (see the [data-reduced-motion] rules in the CSS).
 *  - Lite mode is a best-effort hardware check: <= 4 logical cores or
 *    <= 3 GB of device memory. On those phones we drop decorative glow/particle
 *    layers and shorten transitions, so scrolling and board drawing stay fluid.
 *
 * The user can force lite mode off/on from the settings sheet; that override is
 * persisted with Capacitor Preferences.
 */
import { STORAGE_KEYS, storageGet, storageSet } from "./storage";

export type LitePreference = "auto" | "on" | "off";

type NavMemory = Navigator & { deviceMemory?: number };

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function systemPrefersReducedMotion(): boolean {
  try {
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  } catch {
    return false;
  }
}

export function hardwareLooksLowEnd(): boolean {
  const cores = navigator.hardwareConcurrency ?? 8;
  const memoryGb = (navigator as NavMemory).deviceMemory ?? 8; // undefined on iOS/older
  return cores <= 4 || memoryGb <= 3;
}

export function getLitePreference(): LitePreference {
  const raw = readSettings().lite;
  return raw === "on" || raw === "off" ? raw : "auto";
}

export function isLiteMode(): boolean {
  const pref = getLitePreference();
  if (pref === "on") return true;
  if (pref === "off") return false;
  return hardwareLooksLowEnd();
}

export function setLitePreference(next: LitePreference): void {
  const settings = readSettings();
  settings.lite = next;
  storageSet(STORAGE_KEYS.settings, JSON.stringify(settings));
  applyDeviceFlags();
}

/* ------------------------------------------------------------------ */

export type DeviceSettings = {
  lite?: LitePreference;
  haptics?: "on" | "off";
};

export function readSettings(): DeviceSettings {
  const raw = storageGet(STORAGE_KEYS.settings);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as DeviceSettings;
  } catch {
    return {};
  }
}

/** Pushes the two flags the CSS reads. Idempotent. */
export function applyDeviceFlags(): void {
  const el = document.documentElement;
  el.dataset.lite = isLiteMode() ? "1" : "0";
  el.dataset.reducedMotion = systemPrefersReducedMotion() ? "1" : "0";
}

export function initDevice(): void {
  applyDeviceFlags();
  try {
    const mq = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = () => applyDeviceFlags();
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
  } catch {
    /* ancient WebView */
  }
}
