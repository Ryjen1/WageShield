#!/usr/bin/env node
/**
 * Export the WageShield brand SVGs into PNGs at submission resolutions.
 * Re-run after editing any SVG source:
 *
 *   node scripts/export-brand.js
 *
 * Source SVGs use `currentColor` for the mark + wordmark, which sharp can't
 * resolve. We pre-render a "themed" SVG copy with currentColor replaced by the
 * appropriate hex (#F6F7F9 for dark contexts, #0F1320 for light) into /tmp,
 * then rasterise that.
 */

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const BRAND = path.join(ROOT, "apps/web/public/brand");
const APP = path.join(ROOT, "apps/web/src/app");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "wageshield-brand-"));

/** Pre-process: replace `currentColor` with an explicit fill so sharp can rasterise. */
function themed(srcPath, color) {
  const raw = fs.readFileSync(srcPath, "utf8");
  const out = raw.replace(/currentColor/g, color);
  const dst = path.join(TMP, path.basename(srcPath));
  fs.writeFileSync(dst, out);
  return dst;
}

/** [source SVG (themed if `color` set), output PNG, width, height, color?] */
const targets = [
  // Square icons — used as project avatar in AKINDO / GitHub / Twitter.
  [path.join(BRAND, "mark.svg"), path.join(BRAND, "icon-512.png"), 512, 512, "#F6F7F9"],
  [path.join(BRAND, "mark.svg"), path.join(BRAND, "icon-1024.png"), 1024, 1024, "#F6F7F9"],
  // Banner — AKINDO cover, GitHub social preview, Twitter banner.
  [path.join(BRAND, "banner.svg"), path.join(BRAND, "banner-1500x500.png"), 1500, 500],
  [path.join(BRAND, "banner.svg"), path.join(BRAND, "banner-1280x640.png"), 1280, 640],
  // OG / social-card. Same image for both Twitter + general OG.
  [path.join(APP, "opengraph-image.svg"), path.join(APP, "opengraph-image.png"), 1200, 630],
  [path.join(APP, "opengraph-image.svg"), path.join(APP, "twitter-image.png"), 1200, 630],
];

async function run() {
  for (const [src, dst, w, h, color] of targets) {
    if (!fs.existsSync(src)) {
      console.error(`✗ missing source: ${path.relative(ROOT, src)}`);
      process.exit(1);
    }
    const input = color ? themed(src, color) : src;
    await sharp(input, { density: 384 })
      .resize(w, h ?? w, { fit: "cover" })
      .png({ compressionLevel: 9 })
      .toFile(dst);
    const size = fs.statSync(dst).size;
    console.log(
      `✓ ${path.relative(ROOT, dst).padEnd(56)} ${w}x${h ?? w}   ${(size / 1024).toFixed(1)} KB`,
    );
  }
  // Cleanup temp dir
  fs.rmSync(TMP, { recursive: true, force: true });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
