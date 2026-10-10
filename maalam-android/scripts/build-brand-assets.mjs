/**
 * Brand asset generator — fully offline, zero native dependencies.
 *
 * Why this exists
 * ---------------
 * The web app loads its logo from https://i.ibb.co (a CDN). Rule 3 of the
 * Android port forbids any CDN at runtime, so the logo, the launcher icons and
 * the splash art have to live inside the APK.
 *
 * This script derives every one of those assets from the *bundled* IBM Plex
 * Sans Arabic webfont that the app already ships, so the mark is the same
 * "م" the web app draws — not a hand-copied bitmap:
 *
 *   1. Parse the WOFF1 container  -> raw sfnt tables (zlib inflate).
 *   2. cmap (format 4 / 12)       -> glyph id for U+0645.
 *   3. loca + glyf                -> contour outlines (quadratic beziers).
 *   4. Emit SVG path data         -> public/logo.svg + Android VectorDrawables.
 *   5. Rasterize with a scanline  -> legacy mipmap PNGs for API 24/25, which
 *      nonzero-winding filler        cannot use adaptive icons.
 *
 * Run: node scripts/build-brand-assets.mjs
 *
 * If you have the original logo JPEG (see scripts/fetch-assets.mjs), that file
 * wins for the in-app logo; these generated assets remain the launcher/splash
 * mark and the offline fallback.
 */
import { deflateSync, inflateSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* ------------------------------------------------------------------ *
 * Palette — taken verbatim from src/maalam.css and the web favicon.
 * ------------------------------------------------------------------ */
const BRAND = {
  accentFrom: "#35d6a6",
  accentTo: "#126f55",
  glyph: "#fff8dc",
  appBg: "#0a0d0e",
};

const FONT_REL =
  "node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff";

/* ------------------------------------------------------------------ *
 * WOFF1 -> sfnt tables
 * ------------------------------------------------------------------ */
function readSfntTables(file) {
  const buf = readFileSync(file);
  const sig = buf.readUInt32BE(0);

  // Plain sfnt (TTF/OTF): 0x00010000 or 'true' or 'OTTO'
  if (sig === 0x00010000 || sig === 0x4f54544f || sig === 0x74727565) {
    return parseSfntDirectory(buf);
  }
  if (buf.toString("latin1", 0, 4) !== "wOFF") {
    throw new Error(`${file}: not a WOFF or sfnt font (sig 0x${sig.toString(16)})`);
  }

  const numTables = buf.readUInt16BE(12);
  const tables = new Map();
  for (let i = 0; i < numTables; i += 1) {
    const off = 44 + i * 20;
    const tag = buf.toString("latin1", off, off + 4);
    const tableOffset = buf.readUInt32BE(off + 4);
    const compLength = buf.readUInt32BE(off + 8);
    const origLength = buf.readUInt32BE(off + 12);
    const raw = buf.subarray(tableOffset, tableOffset + compLength);
    tables.set(tag, compLength < origLength ? inflateSync(raw) : Buffer.from(raw));
  }
  return tables;
}

function parseSfntDirectory(buf) {
  const numTables = buf.readUInt16BE(4);
  const tables = new Map();
  for (let i = 0; i < numTables; i += 1) {
    const off = 12 + i * 16;
    const tag = buf.toString("latin1", off, off + 4);
    const tableOffset = buf.readUInt32BE(off + 8);
    const length = buf.readUInt32BE(off + 12);
    tables.set(tag, buf.subarray(tableOffset, tableOffset + length));
  }
  return tables;
}

/* ------------------------------------------------------------------ *
 * cmap -> glyph id
 * ------------------------------------------------------------------ */
function glyphIdFor(tables, codePoint) {
  const cmap = tables.get("cmap");
  if (!cmap) throw new Error("font has no cmap table");
  const numSub = cmap.readUInt16BE(2);

  let chosen = -1;
  let chosenScore = -1;
  for (let i = 0; i < numSub; i += 1) {
    const platformId = cmap.readUInt16BE(4 + i * 8);
    const encodingId = cmap.readUInt16BE(6 + i * 8);
    const offset = cmap.readUInt32BE(8 + i * 8);
    const format = cmap.readUInt16BE(offset);
    if (format !== 4 && format !== 12) continue;

    // Prefer a Unicode BMP/full-repertoire subtable.
    let score = 0;
    if (platformId === 3 && (encodingId === 1 || encodingId === 10)) score = format === 12 ? 5 : 4;
    else if (platformId === 0) score = format === 12 ? 5 : 3;
    if (score > chosenScore) {
      chosenScore = score;
      chosen = offset;
    }
  }
  if (chosen < 0) throw new Error("no usable cmap subtable");

  const format = cmap.readUInt16BE(chosen);
  if (format === 12) {
    const nGroups = cmap.readUInt32BE(chosen + 12);
    for (let g = 0; g < nGroups; g += 1) {
      const o = chosen + 16 + g * 12;
      const start = cmap.readUInt32BE(o);
      const end = cmap.readUInt32BE(o + 4);
      if (codePoint >= start && codePoint <= end) {
        return cmap.readUInt32BE(o + 8) + (codePoint - start);
      }
    }
    return 0;
  }

  // format 4 (BMP only)
  if (codePoint > 0xffff) return 0;
  const segCountX2 = cmap.readUInt16BE(chosen + 6);
  const segCount = segCountX2 / 2;
  const endBase = chosen + 14;
  const startBase = endBase + segCountX2 + 2;
  const deltaBase = startBase + segCountX2;
  const rangeBase = deltaBase + segCountX2;

  for (let s = 0; s < segCount; s += 1) {
    const end = cmap.readUInt16BE(endBase + s * 2);
    if (codePoint > end) continue;
    const start = cmap.readUInt16BE(startBase + s * 2);
    if (codePoint < start) return 0;
    const delta = cmap.readInt16BE(deltaBase + s * 2);
    const rangeOffset = cmap.readUInt16BE(rangeBase + s * 2);
    if (rangeOffset === 0) return (codePoint + delta) & 0xffff;
    const glyphIndexAddress = rangeBase + s * 2 + rangeOffset + (codePoint - start) * 2;
    if (glyphIndexAddress + 1 >= cmap.length) return 0;
    const gid = cmap.readUInt16BE(glyphIndexAddress);
    return gid === 0 ? 0 : (gid + delta) & 0xffff;
  }
  return 0;
}

/* ------------------------------------------------------------------ *
 * glyf + loca -> outline contours
 * ------------------------------------------------------------------ *
 * Each contour is a list of points {x, y, on}. Off-curve points are the
 * control points of quadratic beziers, exactly as in the TrueType spec.
 */
function readOutline(tables, glyphId) {
  const head = tables.get("head");
  const maxp = tables.get("maxp");
  const loca = tables.get("loca");
  const glyf = tables.get("glyf");
  if (!head || !maxp || !loca || !glyf) throw new Error("font is missing head/maxp/loca/glyf");

  const indexToLocFormat = head.readInt16BE(50);
  const numGlyphs = maxp.readUInt16BE(4);
  if (glyphId >= numGlyphs) return { contours: [], unitsPerEm: head.readUInt16BE(18) };

  const at = (i) =>
    indexToLocFormat === 0 ? loca.readUInt16BE(i * 2) * 2 : loca.readUInt32BE(i * 4);

  const start = at(glyphId);
  const end = at(glyphId + 1);
  const unitsPerEm = head.readUInt16BE(18) || 1000;
  if (end <= start) return { contours: [], unitsPerEm };

  const g = glyf.subarray(start, end);
  const numberOfContours = g.readInt16BE(0);
  if (numberOfContours <= 0) {
    // Composite glyphs are not expected for a single letter; bail out loudly.
    if (numberOfContours < 0) throw new Error("composite glyph not supported by this script");
    return { contours: [], unitsPerEm };
  }

  const endPts = [];
  for (let i = 0; i < numberOfContours; i += 1) endPts.push(g.readUInt16BE(10 + i * 2));

  let p = 10 + numberOfContours * 2;
  const instructionLength = g.readUInt16BE(p);
  p += 2 + instructionLength;

  const totalPoints = endPts[endPts.length - 1] + 1;
  const flags = [];
  for (let i = 0; i < totalPoints; i += 1) {
    const flag = g[p++];
    flags.push(flag);
    if (flag & 0x08) {
      // Repeat
      const repeats = g[p++];
      for (let r = 0; r < repeats; r += 1) flags.push(flag);
      i += repeats;
    }
  }

  const readCoords = (isX) => {
    const shortBit = isX ? 0x02 : 0x04;
    const sameBit = isX ? 0x10 : 0x20;
    const out = [];
    let value = 0;
    for (let i = 0; i < totalPoints; i += 1) {
      const flag = flags[i];
      if (flag & shortBit) {
        const delta = g[p++];
        value += flag & sameBit ? delta : -delta;
      } else if (!(flag & sameBit)) {
        value += g.readInt16BE(p);
        p += 2;
      }
      out.push(value);
    }
    return out;
  };

  const xs = readCoords(true);
  const ys = readCoords(false);

  const contours = [];
  let from = 0;
  for (const endPt of endPts) {
    const pts = [];
    for (let i = from; i <= endPt; i += 1) {
      pts.push({ x: xs[i], y: ys[i], on: (flags[i] & 0x01) !== 0 });
    }
    contours.push(pts);
    from = endPt + 1;
  }
  return { contours, unitsPerEm };
}

/** Flattens TrueType contours into absolute, y-down SVG path data. */
function contoursToPathData(contours, scale, tx, ty) {
  const map = (pt) => [round(pt.x * scale + tx), round(-pt.y * scale + ty)];
  const parts = [];
  for (const contour of contours) {
    if (!contour.length) continue;

    // Normalise: start on an on-curve point, inserting implied midpoints.
    const pts = [...contour];
    let startIdx = pts.findIndex((pt) => pt.on);
    if (startIdx < 0) {
      // All off-curve: synthesise a start point between the first two.
      const a = pts[0];
      const b = pts[1 % pts.length];
      pts.unshift({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: true });
      startIdx = 0;
    }
    const ordered = [...pts.slice(startIdx), ...pts.slice(0, startIdx)];

    const [sx, sy] = map(ordered[0]);
    let d = `M${sx},${sy}`;
    let i = 1;
    while (i < ordered.length) {
      const cur = ordered[i];
      if (cur.on) {
        const [x, y] = map(cur);
        d += `L${x},${y}`;
        i += 1;
        continue;
      }
      // Off-curve: quadratic. The next point may be off-curve too, in which
      // case an on-curve point is implied at the midpoint.
      const next = ordered[i + 1] ?? ordered[0];
      const [cx, cy] = map(cur);
      if (next.on) {
        const [x, y] = map(next);
        d += `Q${cx},${cy} ${x},${y}`;
        i += 2;
      } else {
        const implied = { x: (cur.x + next.x) / 2, y: (cur.y + next.y) / 2, on: true };
        const [x, y] = map(implied);
        d += `Q${cx},${cy} ${x},${y}`;
        i += 1;
      }
    }
    parts.push(`${d}Z`);
  }
  return parts.join("");
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

/* ------------------------------------------------------------------ *
 * Flattened polygon model — shared by the SVG output and the rasterizer
 * ------------------------------------------------------------------ */
function flattenPathDataToPolygons(d) {
  const polygons = [];
  let current = [];
  let cur = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  const pushSeg = (steps, fn) => {
    const from = { ...cur };
    for (let i = 1; i <= steps; i += 1) {
      const pt = fn(from, i / steps);
      current.push(pt);
      cur = pt;
    }
  };

  const tokens = d.match(/[MLQAZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  let i = 0;
  let cmd = "";
  const num = () => Number(tokens[i++]);

  while (i < tokens.length) {
    if (/[MLQAZ]/i.test(tokens[i])) cmd = tokens[i++];
    switch (cmd.toUpperCase()) {
      case "M": {
        if (current.length > 2) polygons.push(current);
        current = [];
        cur = { x: num(), y: num() };
        start = { ...cur };
        current.push({ ...cur });
        cmd = "L";
        break;
      }
      case "L": {
        const to = { x: num(), y: num() };
        current.push(to);
        cur = to;
        break;
      }
      case "Q": {
        const c1 = { x: num(), y: num() };
        const to = { x: num(), y: num() };
        pushSeg(24, (from, t) => {
          const mt = 1 - t;
          return {
            x: mt * mt * from.x + 2 * mt * t * c1.x + t * t * to.x,
            y: mt * mt * from.y + 2 * mt * t * c1.y + t * t * to.y,
          };
        });
        cur = to;
        break;
      }
      case "Z": {
        if (current.length > 2) polygons.push(current);
        current = [];
        cur = { ...start };
        break;
      }
      default:
        i += 1;
    }
  }
  if (current.length > 2) polygons.push(current);
  return polygons;
}

function roundedRectPolygon(w, h, r, inset = 0) {
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;
  const rr = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
  const pts = [];
  // Quarter circles approximated with 12 segments each — plenty for a 192px icon.
  const corner = (cx, cy, s0, s1) => {
    for (let i = 0; i <= 12; i += 1) {
      const a = s0 + ((s1 - s0) * i) / 12;
      pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
    }
  };
  corner(x1 - rr, y0 + rr, -Math.PI / 2, 0);
  corner(x1 - rr, y1 - rr, 0, Math.PI / 2);
  corner(x0 + rr, y1 - rr, Math.PI / 2, Math.PI);
  corner(x0 + rr, y0 + rr, Math.PI, Math.PI * 1.5);
  return pts;
}

/* ------------------------------------------------------------------ *
 * Tiny PNG writer + nonzero-winding scanline rasterizer
 * ------------------------------------------------------------------ */
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Renders layers into an RGBA buffer.
 * layer = { polygons, fill: hex | ((x,y,w,h)=>[r,g,b]) }
 * Coverage is computed with an N x N supersample grid per pixel.
 */
function rasterize(width, height, layers, supersample = 4) {
  const rgba = Buffer.alloc(width * height * 4);
  const n = supersample;
  const sub = (n * n);

  // Precompute per-layer scanline edge tables once per sample row.
  for (let y = 0; y < height; y += 1) {
    const samplesY = [];
    for (let sy = 0; sy < n; sy += 1) samplesY.push(y + (sy + 0.5) / n);

    for (const layer of layers) {
      // Build x-intersections for each sample row.
      const rows = samplesY.map((yy) => {
        const xs = [];
        for (const poly of layer.polygons) {
          for (let i = 0, len = poly.length; i < len; i += 1) {
            const a = poly[i];
            const b = poly[(i + 1) % len];
            if (a.y === b.y) continue;
            if (yy < Math.min(a.y, b.y) || yy >= Math.max(a.y, b.y)) continue;
            const t = (yy - a.y) / (b.y - a.y);
            xs.push({ x: a.x + t * (b.x - a.x), dir: b.y > a.y ? 1 : -1 });
          }
        }
        xs.sort((p, q) => p.x - q.x);
        return xs;
      });

      for (let x = 0; x < width; x += 1) {
        let covered = 0;
        for (let sy = 0; sy < n; sy += 1) {
          const xs = rows[sy];
          if (!xs.length) continue;
          const samplesX = [];
          for (let sx = 0; sx < n; sx += 1) samplesX.push(x + (sx + 0.5) / n);
          for (const xx of samplesX) {
            // nonzero winding
            let winding = 0;
            for (const e of xs) {
              if (e.x > xx) break;
              winding += e.dir;
            }
            if (winding !== 0) covered += 1;
          }
        }
        if (!covered) continue;
        const alpha = covered / sub;
        const off = (y * width + x) * 4;
        const [r, g, b] =
          typeof layer.fill === "function" ? layer.fill(x + 0.5, y + 0.5, width, height) : hexToRgb(layer.fill);
        // source-over compositing
        const dstA = rgba[off + 3] / 255;
        const srcA = alpha;
        const outA = srcA + dstA * (1 - srcA);
        if (outA <= 0) continue;
        rgba[off + 0] = Math.round((r * srcA + rgba[off + 0] * dstA * (1 - srcA)) / outA);
        rgba[off + 1] = Math.round((g * srcA + rgba[off + 1] * dstA * (1 - srcA)) / outA);
        rgba[off + 2] = Math.round((b * srcA + rgba[off + 2] * dstA * (1 - srcA)) / outA);
        rgba[off + 3] = Math.round(outA * 255);
      }
    }
  }
  return rgba;
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Raw scanlines with a filter byte (0 = None)
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const idat = deflateZlib(raw);

  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "latin1");
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  };

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** zlib-wrapped deflate (PNG requires the zlib header, not raw deflate). */
function deflateZlib(data) {
  // node:zlib deflateSync already produces a zlib stream.
  return deflateSync(data, { level: 9 });
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ------------------------------------------------------------------ *
 * Asset emission
 * ------------------------------------------------------------------ */
function write(rel, contents) {
  const abs = join(ROOT, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, typeof contents === "string" ? contents : contents);
  const bytes = Buffer.isBuffer(contents) ? contents.length : Buffer.byteLength(contents);
  console.log(`  wrote ${rel} (${bytes.toLocaleString("en-US")} bytes)`);
}

/** Adaptive-icon VectorDrawable: 108x108dp viewport, 72dp safe zone. */
function vectorDrawable({ pathData, fillColor, size = 108, scale = 1, opacity = 1 }) {
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by scripts/build-brand-assets.mjs — do not edit by hand. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="${size}dp"
    android:height="${size}dp"
    android:viewportWidth="${size}"
    android:viewportHeight="${size}"
    android:alpha="${opacity}">
    <group
        android:scaleX="${scale}"
        android:scaleY="${scale}"
        android:pivotX="${size / 2}"
        android:pivotY="${size / 2}">
        <path
            android:fillColor="${fillColor}"
            android:pathData="${pathData}" />
    </group>
</vector>
`;
}

function main() {
  const fontPath = join(ROOT, FONT_REL);
  if (!existsSync(fontPath)) {
    console.error(`Missing font: ${FONT_REL}\nRun "npm install" first.`);
    process.exit(1);
  }

  console.log("Building brand assets from the bundled IBM Plex Sans Arabic webfont…");
  const tables = readSfntTables(fontPath);
  const gid = glyphIdFor(tables, 0x0645); // م ARABIC LETTER MEEM
  if (!gid) throw new Error("U+0645 not found in the font — cannot build the mark");
  const { contours, unitsPerEm } = readOutline(tables, gid);
  if (!contours.length) throw new Error("glyph outline is empty");

  // Bounding box in font units (y is up in font space).
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of contours) {
    for (const p of c) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  }
  console.log(
    `  glyph id ${gid}, ${contours.length} contours, unitsPerEm ${unitsPerEm}, bbox ${minX},${minY} → ${maxX},${maxY}`,
  );

  /* ---------- 1. public/logo.svg (used by the app + boot splash) ---------- */
  const LOGO = 512;
  const RADIUS = Math.round(LOGO * 0.26); // matches .host__mascot-frame border-radius
  const GLYPH_BOX = 300; // target height for the mark inside the tile
  const gScale = GLYPH_BOX / (maxY - minY);
  const gW = (maxX - minX) * gScale;
  const gTx = (LOGO - gW) / 2 - minX * gScale;
  // Font space is y-up; SVG is y-down, so contoursToPathData negates y and this
  // offset re-centres the mark on the glyph's own vertical middle.
  const ty = LOGO / 2 + ((maxY + minY) / 2) * gScale;

  const glyphPath = contoursToPathData(contours, gScale, gTx, ty);
  const rectPath = roundedRectPathData(LOGO, LOGO, RADIUS);

  write(
    "public/logo.svg",
    `<svg xmlns="http://www.w3.org/2000/svg" width="${LOGO}" height="${LOGO}" viewBox="0 0 ${LOGO} ${LOGO}">
  <!-- Generated offline by scripts/build-brand-assets.mjs. Same mark the web
       app draws: emerald gradient tile + gold "م" (IBM Plex Sans Arabic 700). -->
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BRAND.accentFrom}"/>
      <stop offset="1" stop-color="${BRAND.accentTo}"/>
    </linearGradient>
  </defs>
  <path d="${rectPath}" fill="url(#g)"/>
  <path d="${glyphPath}" fill="${BRAND.glyph}"/>
</svg>
`,
  );

  /* ---------- 2. Android adaptive icon layers (API 26+) ---------- */
  const AD = 108; // adaptive icon viewport (dp)
  const SAFE = 66; // inner safe zone diameter
  const adScale = SAFE / (maxY - minY);
  const adW = (maxX - minX) * adScale;
  const adTx = (AD - adW) / 2 - minX * adScale;
  const adTy = AD / 2 + ((maxY + minY) / 2) * adScale;
  const adGlyph = contoursToPathData(contours, adScale, adTx, adTy);

  const resBase = "android/app/src/main/res";
  write(
    `${resBase}/drawable/ic_launcher_foreground.xml`,
    vectorDrawable({ pathData: adGlyph, fillColor: BRAND.glyph, size: AD }),
  );
  write(
    `${resBase}/drawable/ic_launcher_monochrome.xml`,
    // Monochrome layer must be a single-colour silhouette on transparency.
    vectorDrawable({ pathData: adGlyph, fillColor: "#FFFFFFFF", size: AD }),
  );
  write(
    `${resBase}/drawable/ic_launcher_background.xml`,
    `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by scripts/build-brand-assets.mjs — do not edit by hand. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path android:pathData="M0,0h108v108h-108z">
        <aapt:attr xmlns:aapt="http://schemas.android.com/aapt" name="android:fillColor">
            <gradient
                android:startX="0" android:startY="0"
                android:endX="108" android:endY="108"
                android:type="linear">
                <item android:offset="0" android:color="${BRAND.accentFrom}"/>
                <item android:offset="1" android:color="${BRAND.accentTo}"/>
            </gradient>
        </aapt:attr>
    </path>
</vector>
`,
  );

  /* ---------- 3. Legacy launcher PNGs (API 24 / 25) ---------- */
  const DENSITIES = [
    { name: "mdpi", size: 48 },
    { name: "hdpi", size: 72 },
    { name: "xhdpi", size: 96 },
    { name: "xxhdpi", size: 144 },
    { name: "xxxhdpi", size: 192 },
  ];

  const from = hexToRgb(BRAND.accentFrom);
  const to = hexToRgb(BRAND.accentTo);
  const gradientFill = (x, y, w, h) => {
    const t = (x / w + y / h) / 2;
    return [
      Math.round(from[0] + (to[0] - from[0]) * t),
      Math.round(from[1] + (to[1] - from[1]) * t),
      Math.round(from[2] + (to[2] - from[2]) * t),
    ];
  };

  for (const { name, size } of DENSITIES) {
    const S = size;
    const radius = S * 0.22;
    const bg = { polygons: [roundedRectPolygon(S, S, radius)], fill: gradientFill };

    const glyphScale = (S * 0.6) / (maxY - minY);
    const gw = (maxX - minX) * glyphScale;
    const gtx = (S - gw) / 2 - minX * glyphScale;
    const gty = S / 2 + ((maxY + minY) / 2) * glyphScale;
    const glyphPolygons = flattenPathDataToPolygons(
      contoursToPathData(contours, glyphScale, gtx, gty),
    );
    const glyph = { polygons: glyphPolygons, fill: BRAND.glyph };

    const png = encodePng(S, S, rasterize(S, S, [bg, glyph], 4));
    write(`${resBase}/mipmap-${name}/ic_launcher.png`, png);
    write(`${resBase}/mipmap-${name}/ic_launcher_round.png`, png);

    // Foreground layer for the pre-26 path is unused, but the template ships
    // one; regenerate it at the adaptive size so nothing stale is left behind.
    const FG = Math.round(S * 1.5);
    const fgScale = (FG * 0.4) / (maxY - minY);
    const fgw = (maxX - minX) * fgScale;
    const fgtkx = (FG - fgw) / 2 - minX * fgScale;
    const fgtky = FG / 2 + ((maxY + minY) / 2) * fgScale;
    const fgPng = encodePng(
      FG,
      FG,
      rasterize(
        FG,
        FG,
        [
          {
            polygons: flattenPathDataToPolygons(
              contoursToPathData(contours, fgScale, fgtkx, fgtky),
            ),
            fill: BRAND.glyph,
          },
        ],
        4,
      ),
    );
    write(`${resBase}/mipmap-${name}/ic_launcher_foreground.png`, fgPng);
  }

  /* ---------- 4. Splash screen art (Android 12+ SplashScreen API) ---------- */
  // A centred icon on a transparent canvas; windowSplashScreenBackground paints
  // the #0a0d0e field, so there is never a white frame.
  const SPLASH = 288; // windowSplashScreenAnimatedImage is inset by the system
  const sScale = (SPLASH * 0.72) / (maxY - minY);
  const sW = (maxX - minX) * sScale;
  const sTx = (SPLASH - sW) / 2 - minX * sScale;
  const sTy = SPLASH / 2 + ((maxY + minY) / 2) * sScale;
  const splashPng = encodePng(
    SPLASH,
    SPLASH,
    rasterize(
      SPLASH,
      SPLASH,
      [
        {
          polygons: [roundedRectPolygon(SPLASH, SPLASH, SPLASH * 0.22, SPLASH * 0.02)],
          fill: gradientFill,
        },
        {
          polygons: flattenPathDataToPolygons(contoursToPathData(contours, sScale, sTx, sTy)),
          fill: BRAND.glyph,
        },
      ],
      4,
    ),
  );
  write(`${resBase}/drawable/splash_icon.png`, splashPng);

  console.log("Done.");
}

function roundedRectPathData(w, h, r) {
  const pts = roundedRectPolygon(w, h, r);
  return `M${pts.map((p) => `${round(p.x)},${round(p.y)}`).join("L")}Z`;
}

main();
