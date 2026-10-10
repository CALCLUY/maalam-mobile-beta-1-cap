/**
 * Storage facade with a synchronous read path.
 *
 * The phone shell (history.ts, i18n.ts) reads its state synchronously during
 * module init and while the user types; Capacitor's Preferences and the secure
 * storage plugin are both asynchronous. Rather than rewriting the shell into a
 * promise-driven shape (which would change observable timing), we hydrate a
 * plain in-memory map once — before React mounts — and then:
 *
 *   read  -> synchronous map lookup
 *   write -> synchronous map update + debounced async flush to the native store
 *
 * Backing stores:
 *   - API key    : @aparajita/capacitor-secure-storage (Android Keystore-backed).
 *                  The web build keeps using localStorage exactly like the web
 *                  app, so the reference screenshots behave identically.
 *   - everything : @capacitor/preferences (encrypted SharedPreferences wrapper
 *                  on Android, namespaced per key).
 *
 * A one-time migration copies the web app's localStorage keys into the native
 * stores on first native run, so test data from the browser is not lost.
 */
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";

/** Kept identical to the web app's keys so migration is a plain copy. */
export const STORAGE_KEYS = {
  history: "maalam.phone.history.v1",
  apiKey: "maalam.phone.apiKey.v1",
  lang: "maalam.phone.lang.v1",
  /** Extra phone-only settings (haptics, lite mode override). */
  settings: "maalam.phone.settings.v1",
} as const;

const MIGRATION_FLAG = "maalam.phone.migratedToNative.v1";

export const isNative = (): boolean => Capacitor.isNativePlatform();

const cache = new Map<string, string>();
let hydrated = false;

/* ------------------------------------------------------------------ *
 * Low-level primitives (web fallback included)
 * ------------------------------------------------------------------ */
async function prefGet(key: string): Promise<string | null> {
  if (!isNative()) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  const { value } = await Preferences.get({ key });
  return value;
}

async function prefSet(key: string, value: string): Promise<void> {
  if (!isNative()) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode */
    }
    return;
  }
  await Preferences.set({ key, value });
}

async function prefRemove(key: string): Promise<void> {
  if (!isNative()) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return;
  }
  await Preferences.remove({ key });
}

async function prefKeys(): Promise<string[]> {
  if (!isNative()) {
    try {
      return Object.keys(localStorage);
    } catch {
      return [];
    }
  }
  const { keys } = await Preferences.keys();
  return keys;
}

async function secureGet(): Promise<string | null> {
  if (!isNative()) {
    try {
      return localStorage.getItem(STORAGE_KEYS.apiKey);
    } catch {
      return null;
    }
  }
  try {
    return await SecureStorage.getItem(STORAGE_KEYS.apiKey);
  } catch {
    // Keystore unavailable (roms without it, cleared keystore): fall back to
    // an empty key rather than crashing the app on launch.
    return null;
  }
}

async function secureSet(value: string): Promise<void> {
  if (!isNative()) {
    try {
      if (value) localStorage.setItem(STORAGE_KEYS.apiKey, value);
      else localStorage.removeItem(STORAGE_KEYS.apiKey);
    } catch {
      /* ignore */
    }
    return;
  }
  if (value) await SecureStorage.setItem(STORAGE_KEYS.apiKey, value);
  else await SecureStorage.removeItem(STORAGE_KEYS.apiKey);
}

/* ------------------------------------------------------------------ *
 * Hydration + one-time migration
 * ------------------------------------------------------------------ */
async function migrateFromLocalStorage(): Promise<void> {
  if (!isNative()) return;
  let already = false;
  try {
    already = (await prefGet(MIGRATION_FLAG)) === "1";
  } catch {
    /* ignore */
  }
  if (already) return;

  // localStorage can throw inside a WebView with storage disabled; never let
  // migration break startup.
  const legacy = (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  try {
    const keys = [STORAGE_KEYS.history, STORAGE_KEYS.lang, STORAGE_KEYS.settings];
    for (const key of keys) {
      const existing = await prefGet(key);
      const fromWeb = legacy(key);
      if (existing == null && fromWeb != null) await prefSet(key, fromWeb);
    }
    const existingKey = await secureGet();
    const webKey = legacy(STORAGE_KEYS.apiKey);
    if (!existingKey && webKey) await secureSet(webKey);
  } catch {
    /* best effort */
  }

  try {
    await prefSet(MIGRATION_FLAG, "1");
    // The web copy stays in localStorage: the migration is additive, so going
    // back to the browser still shows the same data.
  } catch {
    /* ignore */
  }
}

export async function hydrateStorage(): Promise<void> {
  if (hydrated) return;
  hydrated = true;

  await migrateFromLocalStorage();

  try {
    const keys = await prefKeys();
    for (const key of keys) {
      if (key === MIGRATION_FLAG) continue;
      if (key === STORAGE_KEYS.apiKey) continue; // never cached from plain prefs
      const value = await prefGet(key);
      if (value != null) cache.set(key, value);
    }
    const apiKey = await secureGet();
    if (apiKey) cache.set(STORAGE_KEYS.apiKey, apiKey);
  } catch {
    /* storage unavailable: run with an empty cache */
  }
}

/* ------------------------------------------------------------------ *
 * Synchronous facade used by the shell
 * ------------------------------------------------------------------ */
export function storageGet(key: string): string | null {
  return cache.get(key) ?? null;
}

let flushTimer = 0;
const dirty = new Set<string>();

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = 0;
    void flushNow();
  }, 600);
}

export async function flushNow(): Promise<void> {
  if (!dirty.size) return;
  const keys = [...dirty];
  dirty.clear();
  await Promise.all(
    keys.map(async (key) => {
      const value = cache.get(key);
      if (value == null) await prefRemove(key);
      else await prefSet(key, value);
    }),
  );
}

export function storageSet(key: string, value: string): void {
  cache.set(key, value);
  dirty.add(key);
  scheduleFlush();
}

export function storageRemove(key: string): void {
  cache.delete(key);
  dirty.add(key);
  scheduleFlush();
}

/* ------------------------------------------------------------------ *
 * API key (secure store). Writes are fire-and-forget but awaited on
 * app-pause so nothing is lost when the process is killed.
 * ------------------------------------------------------------------ */
let keyWrite: Promise<void> = Promise.resolve();

export function getApiKeyCached(): string {
  return cache.get(STORAGE_KEYS.apiKey) ?? "";
}

export function setApiKey(value: string): void {
  const trimmed = value.trim();
  if (trimmed) cache.set(STORAGE_KEYS.apiKey, trimmed);
  else cache.delete(STORAGE_KEYS.apiKey);
  keyWrite = keyWrite.then(() => secureSet(trimmed)).catch(() => undefined);
}

export function awaitApiKeyWrite(): Promise<void> {
  return keyWrite;
}

/* ------------------------------------------------------------------ *
 * Clear all data (settings sheet)
 * ------------------------------------------------------------------ */
export async function clearAllData(): Promise<void> {
  cache.clear();
  dirty.clear();
  if (isNative()) {
    await Promise.allSettled([Preferences.clear(), SecureStorage.clear()]);
  } else {
    try {
      for (const key of [
        STORAGE_KEYS.history,
        STORAGE_KEYS.apiKey,
        STORAGE_KEYS.lang,
        STORAGE_KEYS.settings,
        MIGRATION_FLAG,
      ]) {
        localStorage.removeItem(key);
      }
    } catch {
      /* ignore */
    }
  }
  // Flush any in-flight debounced writes is a no-op now that dirty is empty.
}
