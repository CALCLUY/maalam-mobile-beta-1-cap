/**
 * Local progress: the API key and the conversation history are kept in
 * localStorage, so leaving and coming back loses nothing.
 *
 *  - The API key is restored into the home screen (and the app auto-starts).
 *  - Chat messages are scraped from the live DOM and saved continuously.
 *  - A history sheet lists past conversations; any of them can be opened and
 *    continued by prefilling the composer with a resume prompt.
 *
 * The remote Maalam app itself is untouched — everything here observes the
 * page and drives the app's own buttons and inputs.
 */

import { dateLocale, t, uiDir } from "./i18n";
import { withInsetFallback } from "./platform/inset-css";
import { trackOverlay, untrackOverlay } from "./platform/overlays";
import { getApiKeyCached, setApiKey as setSecureApiKey, storageGet, storageSet } from "./platform/storage";

export type SavedMessage = { role: "user" | "assistant"; content: string; ts: number };

export type SavedConversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: SavedMessage[];
  /** Text snapshot of the blackboard, captured when the conversation ends. */
  boardText?: string;
  /** DOM messages skipped from the front (cap overflow). */
  dropped?: number;
};

type Store = { conversations: SavedConversation[]; activeId: string | null };

const HISTORY_KEY = "maalam.phone.history.v1";
const API_KEY = "maalam.phone.apiKey.v1";
const MAX_CONVERSATIONS = 40;
const MAX_MESSAGES = 300;
const MAX_MESSAGE_CHARS = 2500;

/* ============================== storage ============================== */

let store: Store | null = null;

function loadStore(): Store {
  if (store) return store;
  try {
    const raw = storageGet(HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Store>;
      if (Array.isArray(parsed.conversations)) {
        store = {
          conversations: parsed.conversations.filter(
            (c): c is SavedConversation =>
              Boolean(c) && typeof c.id === "string" && Array.isArray(c.messages),
          ),
          activeId: typeof parsed.activeId === "string" ? parsed.activeId : null,
        };
        return store;
      }
    }
  } catch {
    /* corrupted or unavailable storage: start fresh */
  }
  store = { conversations: [], activeId: null };
  return store;
}

let saveTimer = 0;

function persistNow(): void {
  const data = loadStore();
  // Newest first, active conversation is never dropped.
  const sorted = [...data.conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  const active = sorted.find((c) => c.id === data.activeId);
  const rest = sorted.filter((c) => c.id !== data.activeId).slice(0, MAX_CONVERSATIONS - 1);
  data.conversations = active ? [active, ...rest] : rest;
  try {
    storageSet(HISTORY_KEY, JSON.stringify(data));
  } catch {
    /* quota exceeded or private mode: keep running without saving */
  }
}

function persistSoon(): void {
  if (saveTimer) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = 0;
    persistNow();
  }, 900);
}

/** Reads the key from the hydrated cache (Android Keystore-backed on device). */
export function getSavedApiKey(): string {
  return getApiKeyCached().trim();
}

/** Writes through to secure storage; the cache stays synchronous. */
export function saveApiKey(key: string): void {
  setSecureApiKey(key);
}

/* ============================== scraping ============================== */

function labelOf(button: HTMLElement): string {
  return (button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}

function plain(value: string): string {
  return value.replace(/[ً-ٰٟـ]/g, "");
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/**
 * Every resumed conversation starts with an automatic message that carries the
 * saved transcript as context. It is bookkeeping, not part of the lesson, so it
 * is never saved back into the history (otherwise it would nest on each resume).
 */
const RESUME_MARKER = "كنكمّلو المحادثة اللي فاتت";

/** Reads the visible chat transcript: user bubbles + assistant answers, in order. */
function scrapeMessages(shell: HTMLElement): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  const articles = shell.querySelectorAll("article.message-enter");
  articles.forEach((article) => {
    const role = article.classList.contains("justify-end") ? "user" : "assistant";
    // The main text of both user and assistant messages.
    const text = article.querySelector("p.whitespace-pre-wrap");
    const content = (text?.textContent ?? "").trim();
    if (!content) return; // still thinking / streaming without text yet
    if (role === "user" && content.startsWith(RESUME_MARKER)) return; // automatic resume context
    out.push({ role, content: truncate(content, MAX_MESSAGE_CHARS) });
  });
  return out;
}

function scrapeBoardText(shell: HTMLElement): string {
  const parts: string[] = [];
  let length = 0;
  const blocks = shell.querySelectorAll(".board-block");
  for (const block of Array.from(blocks)) {
    const text = ((block as HTMLElement).textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    parts.push(text.slice(0, 220));
    length += text.length;
    if (length > 2200 || parts.length >= 30) break;
  }
  return truncate(parts.join("\n• "), MAX_MESSAGE_CHARS);
}

function makeTitle(messages: SavedMessage[]): string {
  const first = messages.find((m) => m.role === "user") ?? messages[0];
  if (!first) return t("histFallback");
  return truncate(first.content, 52);
}

function formatDate(ts: number): string {
  try {
    return new Intl.DateTimeFormat(dateLocale(), {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

/* ============================== tracker ============================== */

type LiveProgress = { baseCount: number; consumed: number };
const liveProgress = new Map<string, LiveProgress>();
let pendingBaseline = 0;
let lastShell: HTMLElement | null = null;
let lastDomCount = 0;
let lastScrapeAt = 0;
let sessionStarted = false;
let flushAttached = false;
let suspendCapture = false;

function activeConversation(): SavedConversation | null {
  const data = loadStore();
  if (!data.activeId) return null;
  return data.conversations.find((c) => c.id === data.activeId) ?? null;
}

function snapshotActiveBoard(shell: HTMLElement | null): void {
  const active = activeConversation();
  if (!active || !shell) return;
  const text = scrapeBoardText(shell);
  if (text) {
    active.boardText = text;
    active.updatedAt = Date.now();
    persistSoon();
  }
}

function currentShell(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".chat-shell");
}

/** Flush unsaved progress when the page is hidden or closed. */
export function flushHistory(): void {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveTimer = 0;
  }
  snapshotActiveBoard(currentShell());
  persistNow();
}

function ensureFlushListeners(): void {
  if (flushAttached) return;
  flushAttached = true;
  window.addEventListener("pagehide", flushHistory);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushHistory();
  });
}

function createConversation(): SavedConversation {
  const now = Date.now();
  const conv: SavedConversation = {
    id: `conv-${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    createdAt: now,
    updatedAt: now,
    messages: [],
    dropped: 0,
  };
  loadStore().conversations.unshift(conv);
  return conv;
}

/**
 * Called on every UI pass. Cheap count check first; a full scrape only when
 * the message count changed or ~1s passed (streaming text updates in place).
 */
export function syncHistoryFromDom(shell: HTMLElement): void {
  ensureFlushListeners();

  // A fresh page load never continues the previous session implicitly:
  // old conversations are resumed explicitly from the history sheet.
  if (!sessionStarted) {
    sessionStarted = true;
    loadStore().activeId = null;
    pendingBaseline = 0;
    liveProgress.clear();
  }
  if (shell !== lastShell) {
    lastShell = shell;
    lastDomCount = 0;
  }

  const now = performance.now();
  const count = shell.getElementsByClassName("message-enter").length;
  if (suspendCapture) {
    lastDomCount = count;
    lastScrapeAt = now;
    return;
  }
  if (count === lastDomCount && now - lastScrapeAt < 900) return;
  lastScrapeAt = now;

  if (count < lastDomCount && lastDomCount > 0) {
    // The transcript was cleared (new chat): seal the previous conversation.
    snapshotActiveBoard(shell);
    loadStore().activeId = null;
    pendingBaseline = 0;
    persistSoon();
  }
  lastDomCount = count;
  if (count === 0) return;

  const found = scrapeMessages(shell);
  if (!found.length) return;

  const data = loadStore();
  let active = activeConversation();
  if (!active) {
    active = createConversation();
    data.activeId = active.id;
    liveProgress.set(active.id, { baseCount: pendingBaseline, consumed: 0 });
    pendingBaseline = 0;
  }
  // Only append messages created since this conversation was opened. An
  // archived conversation's stored history is not present in the fresh DOM.
  const progress = liveProgress.get(active.id) ?? {
    baseCount: Math.max(0, found.length - (active.messages.length + (active.dropped ?? 0))),
    consumed: active.messages.length + (active.dropped ?? 0),
  };
  liveProgress.set(active.id, progress);
  const live = found.slice(Math.min(progress.baseCount, found.length));
  const dropped = active.dropped ?? 0;

  let changed = false;
  while (progress.consumed < live.length) {
    const next = live[progress.consumed];
    if (!next) break;
    active.messages.push({ ...next, ts: Date.now() });
    progress.consumed += 1;
    changed = true;
    if (active.messages.length >= MAX_MESSAGES) {
      active.messages.splice(0, 50);
      active.dropped = dropped + 50;
      break;
    }
  }
  // Streaming: the final live bubble grows in place without duplicating it.
  const lastExpected = live[live.length - 1];
  const lastSaved = active.messages[active.messages.length - 1];
  if (lastExpected && lastSaved && lastExpected.role === lastSaved.role && lastExpected.content !== lastSaved.content) {
    lastSaved.content = lastExpected.content;
    changed = true;
  }
  if (!active.title && active.messages.length) {
    active.title = makeTitle(active.messages);
    changed = true;
  }
  if (changed) {
    active.title = active.title || makeTitle(active.messages);
    active.updatedAt = Date.now();
    persistSoon();
  }
}

export function historyCount(): number {
  return loadStore().conversations.filter((c) => c.messages.length > 0).length;
}

export function getRestorableConversation(): SavedConversation | null {
  const list = loadStore().conversations.filter((c) => c.messages.length > 0);
  if (!list.length) return null;
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

function deleteConversation(id: string): void {
  const data = loadStore();
  data.conversations = data.conversations.filter((c) => c.id !== id);
  if (data.activeId === id) data.activeId = null;
  liveProgress.delete(id);
  persistNow();
}

/* ============================== actions ============================== */

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function buildResumePrompt(conv: SavedConversation): string {
  const tail = conv.messages.slice(-10).map((m) => {
    const who = m.role === "user" ? "أنا" : "الأستاذ";
    return `${who}: ${truncate(m.content, 460)}`;
  });
  const board = conv.boardText ? `\n\nآخر محتوى كان فالسبورة:\n${truncate(conv.boardText, 900)}` : "";
  return `كنكمّلو المحادثة اللي فاتت («${truncate(conv.title || "محادثة", 60)}»). هادشي هو سياق الدرس، استعملو باش تجاوب على طلبي مباشرة بلا ما تعاود تلخّصه:\n\n${tail.join("\n\n")}${board}\n\nكمّل منين وقفنا.`;
}

/**
 * Restarts a clean tutor session, restores the archived transcript as context,
 * and sends it automatically. The user lands in the conversation without a
 * prompt waiting in the composer.
 */
export async function resumeConversation(convId: string): Promise<boolean> {
  const data = loadStore();
  const conv = data.conversations.find((c) => c.id === convId);
  const shell = currentShell();
  if (!conv || !shell) return false;

  snapshotActiveBoard(shell);
  const oldMessageCount = shell.getElementsByClassName("message-enter").length;
  const hasBoardContent = Boolean(shell.querySelector(".board-block"));
  let baseCount = scrapeMessages(shell).length;

  // Continuing a saved lesson should start from a clear live board/session,
  // rather than mixing it into whichever conversation happened to be open.
  if (oldMessageCount > 0 || hasBoardContent) {
    const restarted = triggerNewChat();
    if (restarted) {
      const ready = await waitUntil(() => {
        const liveShell = currentShell();
        const connected = liveShell?.querySelector<HTMLElement>(".status-pill")?.dataset.state === "connected";
        return liveShell === shell && shell.getElementsByClassName("message-enter").length === 0 && connected;
      }, 30000);
      if (!ready) {
        suspendCapture = false;
        return false;
      }
      baseCount = 0;
    }
  }

  const composer = shell.querySelector<HTMLTextAreaElement>(".composer-area textarea");
  const send = shell.querySelector<HTMLButtonElement>(".composer-area .send-button");
  if (!composer || !send) {
    suspendCapture = false;
    return false;
  }

  data.activeId = conv.id;
  liveProgress.set(conv.id, { baseCount, consumed: 0 });
  pendingBaseline = 0;
  lastShell = shell;
  lastDomCount = shell.getElementsByClassName("message-enter").length;
  lastScrapeAt = 0;
  conv.updatedAt = Date.now();
  persistSoon();

  setNativeValue(composer, buildResumePrompt(conv));
  const canSend = await waitUntil(() => !send.disabled, 6000);
  if (!canSend) {
    setNativeValue(composer, "");
    return false;
  }
  suspendCapture = false;
  send.click();
  return true;
}

function waitUntil(check: () => boolean, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const started = performance.now();
    const tick = () => {
      if (check()) {
        resolve(true);
      } else if (performance.now() - started >= timeoutMs) {
        resolve(false);
      } else {
        window.setTimeout(tick, 120);
      }
    };
    tick();
  });
}

/** Starts a brand-new conversation through the app's own button. */
export function triggerNewChat(): boolean {
  const shell = currentShell();
  if (!shell) return false;
  snapshotActiveBoard(shell);
  loadStore().activeId = null;
  pendingBaseline = 0;
  persistSoon();

  const buttons = Array.from(shell.querySelectorAll<HTMLButtonElement>(".chat-header button"));
  const target =
    buttons.find((b) => /جديد|محادثة|new/i.test(plain(labelOf(b)))) ??
    buttons.find((b) => b.querySelector("svg.lucide-plus, svg[class*='plus']"));
  if (target && !target.disabled) {
    suspendCapture = true;
    target.click();
    const started = performance.now();
    const waitForClear = () => {
      const current = currentShell();
      const empty = !current || current.getElementsByClassName("message-enter").length === 0;
      if (empty) {
        lastDomCount = 0;
        lastScrapeAt = 0;
        suspendCapture = false;
      } else if (performance.now() - started > 12000) {
        suspendCapture = false;
      } else {
        window.setTimeout(waitForClear, 100);
      }
    };
    window.setTimeout(waitForClear, 100);
    return true;
  }
  return false;
}

/* ============================== history sheet ============================== */

const HISTORY_CSS = `
.maalam-hist-back {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  place-items: center;
  border: 0;
  border-radius: 0.8rem;
  background: rgba(255, 255, 255, 0.07);
  color: #c9d3cf;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.maalam-hist-back svg {
  width: 1.1rem;
  height: 1.1rem;
  transform: scaleX(-1);
}

.maalam-hist-title {
  min-width: 0;
  flex: 1 1 auto;
  margin: 0;
  overflow: hidden;
  font-size: 1.02rem;
  font-weight: 700;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.maalam-hist-empty {
  margin: 0;
  padding: 2.2rem 1rem;
  color: #7d8c87;
  font-size: 0.86rem;
  line-height: 1.9;
  text-align: center;
}

.maalam-hist-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.6rem;
  padding: 0.8rem 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
  font: inherit;
  text-align: start;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: border-color 140ms ease, background 140ms ease;
}

.maalam-hist-row:active {
  border-color: rgba(127, 227, 196, 0.4);
  background: rgba(52, 214, 164, 0.08);
}

.maalam-hist-row__main {
  min-width: 0;
  flex: 1 1 auto;
}

.maalam-hist-row__title {
  display: block;
  overflow: hidden;
  font-size: 0.88rem;
  font-weight: 650;
  line-height: 1.6;
  text-overflow: ellipsis;
  white-space: nowrap;
  unicode-bidi: plaintext;
}

.maalam-hist-row__meta {
  display: block;
  margin-top: 0.1rem;
  color: #7d8c87;
  font-size: 0.72rem;
}

.maalam-hist-row__del {
  display: grid;
  width: 2.3rem;
  height: 2.3rem;
  flex: none;
  place-items: center;
  border: 0;
  border-radius: 0.7rem;
  background: transparent;
  color: #6b7a75;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.maalam-hist-row__del svg {
  width: 1rem;
  height: 1rem;
}

.maalam-hist-row__del[data-armed="true"] {
  background: rgba(248, 113, 113, 0.14);
  color: #fca5a5;
}

.maalam-hist-viewer {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.maalam-hist-msg {
  max-width: 94%;
  padding: 0.6rem 0.85rem;
  border-radius: 1rem;
  font-size: 0.84rem;
  line-height: 1.85;
  white-space: pre-wrap;
  word-break: break-word;
  unicode-bidi: plaintext;
}

.maalam-hist-msg[data-role="user"] {
  align-self: flex-end;
  border-end-end-radius: 0.3rem;
  background: rgba(52, 214, 164, 0.13);
  color: #d9f7ec;
}

.maalam-hist-msg[data-role="assistant"] {
  align-self: flex-start;
  border-end-start-radius: 0.3rem;
  background: rgba(255, 255, 255, 0.05);
  color: #dfe6e3;
}

.maalam-hist-board {
  margin-top: 0.4rem;
  border: 1px dashed rgba(255, 224, 102, 0.28);
  border-radius: 1rem;
  background: rgba(255, 224, 102, 0.04);
  padding: 0.7rem 0.9rem;
  font-size: 0.78rem;
  line-height: 1.8;
  color: #d8d2b4;
  white-space: pre-wrap;
  word-break: break-word;
}

.maalam-hist-board summary {
  color: #ffe066;
  font-weight: 700;
  cursor: pointer;
  touch-action: manipulation;
}

.maalam-hist-board summary::marker {
  color: rgba(255, 224, 102, 0.6);
}

.maalam-hist-danger {
  display: flex;
  width: 100%;
  min-height: 2.9rem;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(248, 113, 113, 0.25);
  border-radius: 0.95rem;
  background: transparent;
  color: #fca5a5;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 600;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.maalam-hist-danger[data-armed="true"] {
  border-color: rgba(248, 113, 113, 0.6);
  background: rgba(248, 113, 113, 0.12);
}

.maalam-hist-foot {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
`;

export function addHistoryStyles(): void {
  if (document.getElementById("maalam-history-styles")) return;
  const style = document.createElement("style");
  style.id = "maalam-history-styles";
  style.textContent = withInsetFallback(HISTORY_CSS);
  document.head.appendChild(style);
}

function svgIcon(paths: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const ICO_CLOSE = '<path d="M18 6 6 18M6 6l12 12"/>';
const ICO_BACK = '<path d="m15 18-6-6 6-6"/>';
const ICO_TRASH = '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>';
const ICO_PLUS = '<path d="M12 5v14M5 12h14"/>';
const ICO_PLAY = '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>';

export type HistorySheetCallbacks = {
  initialId?: string | null;
  onContinue: (conv: SavedConversation) => void;
  onNewChat: () => void;
  onClose: () => void;
};

export function openHistorySheet(callbacks: HistorySheetCallbacks): () => void {
  const backdrop = document.createElement("div");
  backdrop.className = "maalam-sheet-backdrop";

  const sheet = document.createElement("section");
  sheet.className = "maalam-sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-labelledby", "maalam-history-title");
  sheet.dir = uiDir();
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);

  let viewingId: string | null = callbacks.initialId ?? null;
  if (viewingId && !loadStore().conversations.some((c) => c.id === viewingId)) viewingId = null;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    untrackOverlay(close);
    document.removeEventListener("keydown", onKey);
    backdrop.classList.remove("is-in");
    window.setTimeout(() => backdrop.remove(), 260);
    callbacks.onClose();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };
  trackOverlay("history", close);
  document.addEventListener("keydown", onKey);
  backdrop.addEventListener("pointerdown", (event) => {
    if (event.target === backdrop) close();
  });

  /** Two-tap delete: first tap arms, second tap confirms. */
  const armable = (button: HTMLButtonElement, action: () => void) => {
    let armed = false;
    let timer = 0;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!armed) {
        armed = true;
        button.dataset.armed = "true";
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          armed = false;
          button.dataset.armed = "false";
        }, 2600);
        return;
      }
      window.clearTimeout(timer);
      action();
    });
  };

  const el = <T extends HTMLElement>(html: string): T => {
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    return template.content.firstElementChild as T;
  };

  const renderList = () => {
    viewingId = null;
    const convs = [...loadStore().conversations]
      .filter((c) => c.messages.length > 0)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    sheet.innerHTML = "";
    const head = el<HTMLElement>(`
      <header class="maalam-sheet__head">
        <h2 class="maalam-sheet__title" id="maalam-history-title">${t("history")}</h2>
        <button class="maalam-sheet__close" type="button" aria-label="${t("close")}">${svgIcon(ICO_CLOSE)}</button>
      </header>`);
    const body = el<HTMLElement>(`<div class="maalam-sheet__body"></div>`);
    const foot = el<HTMLElement>(`
      <footer class="maalam-sheet__foot">
        <button class="maalam-sheet__save" type="button">${svgIcon(ICO_PLUS)}<span>${t("histNew")}</span></button>
      </footer>`);
    sheet.append(head, body, foot);

    head.querySelector(".maalam-sheet__close")?.addEventListener("click", close);
    foot.querySelector(".maalam-sheet__save")?.addEventListener("click", () => {
      close();
      callbacks.onNewChat();
    });

    if (!convs.length) {
      body.innerHTML = `<p class="maalam-hist-empty">${t("histEmptyA")}<br>${t("histEmptyB")}</p>`;
      return;
    }

    convs.forEach((conv) => {
      const row = el<HTMLButtonElement>(`
        <button class="maalam-hist-row" type="button">
          <span class="maalam-hist-row__main">
            <span class="maalam-hist-row__title"></span>
            <span class="maalam-hist-row__meta"></span>
          </span>
          <span class="maalam-hist-row__del" role="button" tabindex="0" aria-label="${t("histDelete")}">${svgIcon(ICO_TRASH)}</span>
        </button>`);
      (row.querySelector(".maalam-hist-row__title") as HTMLElement).textContent = conv.title || t("histFallback");
      (row.querySelector(".maalam-hist-row__meta") as HTMLElement).textContent =
        `${formatDate(conv.updatedAt)} · ${t("histMessages", { n: conv.messages.length })}`;
      row.addEventListener("click", () => renderViewer(conv.id));
      const del = row.querySelector(".maalam-hist-row__del") as HTMLElement;
      const stop = (event: Event) => event.stopPropagation();
      del.addEventListener("click", stop);
      del.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          del.click();
        }
      });
      armable(del as unknown as HTMLButtonElement, () => {
        deleteConversation(conv.id);
        renderList();
      });
      body.appendChild(row);
    });
  };

  const renderViewer = (id: string) => {
    const conv = loadStore().conversations.find((c) => c.id === id);
    if (!conv) {
      renderList();
      return;
    }
    viewingId = id;

    sheet.innerHTML = "";
    const head = el<HTMLElement>(`
      <header class="maalam-sheet__head">
        <button class="maalam-hist-back" type="button" aria-label="${t("histBack")}">${svgIcon(ICO_BACK)}</button>
        <h2 class="maalam-hist-title" id="maalam-history-title"></h2>
        <button class="maalam-sheet__close" type="button" aria-label="${t("close")}">${svgIcon(ICO_CLOSE)}</button>
      </header>`);
    (head.querySelector(".maalam-hist-title") as HTMLElement).textContent = conv.title || t("histFallback");
    const body = el<HTMLElement>(`<div class="maalam-sheet__body"><div class="maalam-hist-viewer"></div></div>`);
    const viewer = body.querySelector(".maalam-hist-viewer") as HTMLElement;
    conv.messages.forEach((m) => {
      const bubble = document.createElement("div");
      bubble.className = "maalam-hist-msg";
      bubble.dataset.role = m.role;
      bubble.textContent = m.content;
      viewer.appendChild(bubble);
    });
    if (conv.boardText) {
      const board = document.createElement("details");
      board.className = "maalam-hist-board";
      const summary = document.createElement("summary");
      summary.textContent = t("histBoard");
      board.appendChild(summary);
      board.appendChild(document.createTextNode(conv.boardText));
      viewer.appendChild(board);
    }
    const danger = el<HTMLButtonElement>(
      `<button class="maalam-hist-danger" type="button">${t("histDeleteThis")}</button>`,
    );
    armable(danger, () => {
      deleteConversation(conv.id);
      renderList();
    });
    viewer.appendChild(danger);

    const foot = el<HTMLElement>(`
      <footer class="maalam-sheet__foot">
        <div class="maalam-hist-foot">
          <button class="maalam-sheet__save" type="button">${svgIcon(ICO_PLAY)}<span>${t("histContinue")}</span></button>
        </div>
      </footer>`);
    sheet.append(head, body, foot);

    head.querySelector(".maalam-hist-back")?.addEventListener("click", renderList);
    head.querySelector(".maalam-sheet__close")?.addEventListener("click", close);
    foot.querySelector(".maalam-sheet__save")?.addEventListener("click", () => {
      close();
      callbacks.onContinue(conv);
    });
    body.scrollTop = body.scrollHeight;
  };

  if (viewingId) renderViewer(viewingId);
  else renderList();

  window.requestAnimationFrame(() => {
    backdrop.classList.add("is-in");
    sheet.querySelector<HTMLButtonElement>(".maalam-sheet__close")?.focus({ preventScroll: true });
  });

  return close;
}
