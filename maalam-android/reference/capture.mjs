#!/usr/bin/env node
/**
 * Visual reference capture — phone-width 390×844 @2x, mobile mode.
 *
 *   npm run build && npm run preview        # terminal 1 (serves dist/ on :4173)
 *   npm run reference                        # terminal 2
 *
 *   # live lesson screens need a key; it is read from the environment only and
 *   # is typed into the app's own field exactly like a user would:
 *   MAALAM_TEST_API_KEY=... npm run reference
 *
 * Everything here runs against the SAME bundle that goes into the APK, so the
 * PNGs in this folder are the acceptance baseline for "looks like the web app".
 *
 * Screens captured:
 *   00-boot-splash        static splash from index.html (first paint)
 *   01-setup-ar/fr/en     home / setup screen in the three UI languages
 *   02-home-features      home tab: features
 *   03-home-help          home tab: help sheet
 *   04-language-sheet     bottom sheet
 *   05-history-sheet      bottom sheet (conversation list)
 *   06-loading            host splash while the app chunk mounts
 *   10-chat               lesson transcript + composer   (needs a key)
 *   11-board              chalkboard                      (needs a key)
 *   12-quiz               quiz panel over the board       (needs a key)
 *   13-attachment-picker  PDF/image picker                (needs a key)
 */
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)));
const BASE = process.env.MAALAM_REF_URL ?? "http://127.0.0.1:4173";
const API_KEY = process.env.MAALAM_TEST_API_KEY ?? "";

mkdirSync(OUT, { recursive: true });

const VIEWPORT = { width: 390, height: 844 };
const shot = async (page, name) => {
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`  captured ${name}.png`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: devices["iPhone 13"].userAgent,
  locale: "ar-MA",
});
const page = await context.newPage();

/* 00 — the static splash baked into index.html (first paint). */
await page.goto(BASE, { waitUntil: "commit" });
await sleep(120);
await shot(page, "00-boot-splash");

/* 06 — host splash while the core chunk mounts. */
await page.waitForSelector("#host .host--splash", { timeout: 20_000 }).catch(() => {});
await shot(page, "06-loading");

/* 01 — setup / home in Arabic (default). */
await page.waitForSelector(".setup-screen", { timeout: 30_000 });
await sleep(600);
await shot(page, "01-setup-ar");

const setLang = async (code) => {
  await page.click(".maalam-lang-pill button[data-lang='" + code + "']").catch(async () => {
    await page.click("[aria-label*='language' i], .maalam-rail__item[data-item='language']").catch(() => {});
    await page.click(".maalam-sheet button[data-lang='" + code + "']").catch(() => {});
  });
  await sleep(500);
};

/* 04 — language sheet. */
await page.click(".maalam-lang-pill").catch(() => {});
await page.waitForSelector(".maalam-sheet", { timeout: 5000 }).catch(() => {});
await sleep(400);
await shot(page, "04-language-sheet");
await page.keyboard.press("Escape");
await sleep(400);

/* 01b/01c — French and English home. */
await setLang("fr");
await shot(page, "01-setup-fr");
await setLang("en");
await shot(page, "01-setup-en");
await setLang("ar");

/* 02/03 — home tabs: features, help. */
await page.click(".maalam-home-nav__item[data-tab='features']").catch(() => {});
await sleep(700);
await shot(page, "02-home-features");
await page.click(".maalam-home-nav__item[data-tab='help']").catch(() => {});
await sleep(700);
await shot(page, "03-home-help");
await page.keyboard.press("Escape");
await sleep(400);

/* 05 — history sheet (opened from the home topbar / rail). */
await page.click("[aria-label*='سجل' i], [aria-label*='history' i]").catch(() => {});
await sleep(600);
await shot(page, "05-history-sheet");
await page.keyboard.press("Escape");
await sleep(400);

/* ---------------- live lesson screens (need a real key) ---------------- */
if (API_KEY) {
  await page.fill(".key-field input", API_KEY);
  await page.click(".connect-button");
  await page.waitForSelector(".chat-shell, .board-wrap", { timeout: 60_000 });
  await sleep(2500);
  await shot(page, "11-board");

  await page.click(".maalam-rail-toggle").catch(() => {});
  await sleep(400);
  await page.click(".maalam-rail__item[data-item='chat']").catch(() => {});
  await sleep(800);
  await shot(page, "10-chat");

  await page.click(".maalam-rail-toggle").catch(() => {});
  await sleep(400);
  await page.click(".maalam-rail__item[data-item='upload']").catch(() => {});
  await sleep(600);
  await shot(page, "13-attachment-picker");
  await page.keyboard.press("Escape");

  console.log("\nQuiz (12-quiz) appears when the tutor posts one; re-run with a");
  console.log("lesson that triggers a QCM to capture it.");
} else {
  console.log("\nSkipping lesson screens (chat/board/quiz/attachment).");
  console.log("Set MAALAM_TEST_API_KEY (env only, never in the repo) to capture them.");
}

await browser.close();
console.log(`\nReference screenshots written to ${OUT}`);
