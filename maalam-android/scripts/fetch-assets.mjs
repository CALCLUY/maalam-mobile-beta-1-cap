#!/usr/bin/env node
/**
 * Optional, on a machine WITH unrestricted internet: fetch the original logo
 * JPEG that the web app used (hosted on i.ibb.co) and drop it next to the
 * generated offline mark.
 *
 * The APK never talks to i.ibb.co: this script is a one-time, human-run step.
 * When public/logo.jpg exists, src/index.css and the splash prefer it over the
 * generated public/logo.svg (both stay inside the APK either way).
 *
 *   npm run assets:fetch
 */
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOGO_URL = "https://i.ibb.co/rKYMdtMv/Color-matching-first-image-2-K-20261006234249.jpg";
const TARGET = join(ROOT, "public", "logo.jpg");

if (existsSync(TARGET)) {
  console.log(`public/logo.jpg already exists — remove it first to re-fetch.`);
  process.exit(0);
}

const response = await fetch(LOGO_URL);
if (!response.ok) {
  console.error(`Failed to fetch ${LOGO_URL}: HTTP ${response.status}`);
  process.exit(1);
}
const buffer = Buffer.from(await response.arrayBuffer());
writeFileSync(TARGET, buffer);
console.log(`Wrote public/logo.jpg (${buffer.length} bytes). Rebuild + cap sync to ship it.`);
