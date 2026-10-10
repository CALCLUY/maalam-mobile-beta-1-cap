#!/usr/bin/env node
/**
 * Bump the app version in the ONE place it lives: android/variables.gradle
 * (appVersionCode / appVersionName). app/build.gradle reads both from there.
 *
 *   node scripts/bump-version.mjs 1.2.0          # set an exact version
 *   node scripts/bump-version.mjs --minor        # 1.0.0 -> 1.1.0
 *   node scripts/bump-version.mjs --patch        # 1.0.0 -> 1.0.1
 *   node scripts/bump-version.mjs --major        # 1.0.0 -> 2.0.0
 *
 * versionCode always increments by 1 (Play requires a monotonically
 * increasing integer); versionName follows semver.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "android", "variables.gradle");

const arg = process.argv[2];
if (!arg) {
  console.error("usage: bump-version.mjs <x.y.z | --major | --minor | --patch>");
  process.exit(1);
}

let text = readFileSync(FILE, "utf8");
const codeMatch = text.match(/appVersionCode\s*=\s*(\d+)/);
const nameMatch = text.match(/appVersionName\s*=\s*'([^']+)'/);
if (!codeMatch || !nameMatch) {
  console.error(`Could not find appVersionCode/appVersionName in ${FILE}`);
  process.exit(1);
}

let code = Number(codeMatch[1]);
let [major, minor, patch] = nameMatch[1].split(".").map(Number);

if (arg.startsWith("--")) {
  if (arg === "--major") { major += 1; minor = 0; patch = 0; }
  else if (arg === "--minor") { minor += 1; patch = 0; }
  else if (arg === "--patch") { patch += 1; }
  else { console.error(`unknown flag ${arg}`); process.exit(1); }
} else {
  const parts = arg.split(".").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0)) {
    console.error("version must look like 1.2.3");
    process.exit(1);
  }
  [major, minor, patch] = parts;
}
code += 1;
const name = `${major}.${minor}.${patch}`;

text = text
  .replace(/appVersionCode\s*=\s*\d+/, `appVersionCode = ${code}`)
  .replace(/appVersionName\s*=\s*'[^']+'/, `appVersionName = '${name}'`);
writeFileSync(FILE, text);
console.log(`versionName -> ${name}   versionCode -> ${code}   (${FILE})`);
