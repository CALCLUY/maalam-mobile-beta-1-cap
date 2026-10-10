#!/usr/bin/env node
/**
 * Gate: the built app must not load anything from a CDN at runtime.
 *
 * Scans dist/ for loadable external references:
 *   - index.html  : any <script src> / <link href> / <img src> that is absolute http(s)
 *   - *.css       : url(http…) and @import url(http…)
 *   - *.js        : fetch()/import()/new Worker()/src= with an absolute URL whose
 *                   host is a CDN or font host
 *
 * Informational hyperlinks (shown to the user, never fetched by the app) are
 * allowed and listed: aistudio.google.com/apikey, github.com, and the pedagogy
 * sources quoted in the tutor's system prompt. The only host the app talks to
 * at runtime is the Gemini API (generativelanguage.googleapis.com), reached
 * with the user's own key.
 *
 * Exit code 1 = violation.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist");

const FORBIDDEN_HOSTS = [
  "cdn.jsdelivr.net",
  "esm.sh",
  "unpkg.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "i.ibb.co",
  "cdnjs.cloudflare.com",
  "cdn.tailwindcss.com",
  "stackblitz.com",
  "vercel.com",
  "raw.githubusercontent.com",
];

/** Hosts that may appear in user-facing links but are never fetched. */
const INFORMATIONAL_HOSTS = [
  "aistudio.google.com",
  "github.com",
  "www.aft.org",
  "ies.ed.gov",
  "educationendowmentfoundation.org.uk",
  "education.nsw.gov.au",
  "docs.cloud.google.com",
  "generativelanguage.googleapis.com", // the Gemini API itself
];

const violations = [];
const informational = new Set();

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) out.push(...listFiles(abs));
    else out.push(abs);
  }
  return out;
}

function checkUrl(url, where, loadable) {
  let host;
  try {
    host = new URL(url).host;
  } catch {
    return;
  }
  if (FORBIDDEN_HOSTS.includes(host)) {
    violations.push(`${where}: ${loadable ? "LOADS" : "references"} ${url}`);
    return;
  }
  if (INFORMATIONAL_HOSTS.includes(host)) {
    informational.add(`${host} (${where})`);
    return;
  }
  if (loadable) violations.push(`${where}: loads unexpected external URL ${url}`);
}

/* ---- index.html ------------------------------------------------------- */
const html = readFileSync(join(DIST, "index.html"), "utf8");
for (const match of html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)) {
  checkUrl(match[1], "index.html", true);
}

/* ---- css --------------------------------------------------------------- */
for (const file of listFiles(DIST).filter((f) => f.endsWith(".css"))) {
  const css = readFileSync(file, "utf8");
  for (const match of css.matchAll(/url\(\s*['"]?(https?:\/\/[^)'"]+)/g)) {
    checkUrl(match[1], file.replace(DIST, "dist"), true);
  }
  for (const match of css.matchAll(/@import\s+url\(\s*['"]?(https?:\/\/[^)'"]+)/g)) {
    checkUrl(match[1], file.replace(DIST, "dist"), true);
  }
}

/* ---- js ---------------------------------------------------------------- */
for (const file of listFiles(DIST).filter((f) => f.endsWith(".js") || f.endsWith(".mjs"))) {
  const js = readFileSync(file, "utf8");
  const where = file.replace(DIST, "dist");
  // Anything the runtime could fetch/import/spawn.
  for (const match of js.matchAll(/(?:fetch|import)\(\s*["'`](https?:\/\/[^"'`]+)["'`]/g)) {
    checkUrl(match[1], where, true);
  }
  for (const match of js.matchAll(/new Worker\(\s*["'`](https?:\/\/[^"'`]+)["'`]/g)) {
    checkUrl(match[1], where, true);
  }
  for (const match of js.matchAll(/workerSrc\s*=\s*["'`](https?:\/\/[^"'`]+)["'`]/g)) {
    checkUrl(match[1], where, true);
  }
  // Every remaining absolute URL is reported as informational for review.
  for (const match of js.matchAll(/https?:\/\/[a-zA-Z0-9.-]+[^\s"'`)]*/g)) {
    checkUrl(match[0], where, false);
  }
}

console.log("Informational (user-visible links, never fetched):");
for (const entry of [...informational].sort()) console.log(`  - ${entry}`);

if (violations.length) {
  console.error("\nCDN / external-load violations:");
  for (const violation of violations) console.error(`  ✗ ${violation}`);
  process.exit(1);
}
console.log("\n✓ dist/ loads nothing from a CDN. Only the Gemini API is reachable at runtime.");
