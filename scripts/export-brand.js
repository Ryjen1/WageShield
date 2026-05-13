#!/usr/bin/env node
/**
 * Export the WageShield brand SVGs into PNGs at the resolutions submission portals
 * (AKINDO, Twitter, GitHub social preview, OG cards) expect.
 *
 * Re-run after editing any of the SVG sources:
 *   node scripts/export-brand.js
 */

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const BRAND = path.join(ROOT, "apps/web/public/brand");
const APP_ROOT = path.join(ROOT, "apps/web/src/app");

/** [source SVG, output PNG, width, height (optional - else match width)] */
const targets = [
  // Square icons — used as project avatar in AKINDO / GitHub / Twitter
  [path.join(BRAND, "mark.svg"), path.join(BRAND, "icon-512.png"), 512, 512],
  [path.join(BRAND, "mark.svg"), path.join(BRAND, "icon-1024.png"), 1024, 1024],
  // Banner — AKINDO submission cover / GitHub social preview / Twitter banner
  [path.join(BRAND, "banner.svg"), path.join(BRAND, "banner-1500x500.png"), 1500, 500],
  [path.join(BRAND, "banner.svg"), path.join(BRAND, "banner-1280x640.png"), 1280, 640],
  // OG / social-card image — used by Twitter cards, Slack unfurls, Discord previews
  [
    path.join(APP_ROOT, "opengraph-image.svg"),
    path.join(APP_ROOT, "opengraph-image.png"),
    1200,
    630,
  ],
  [
    path.join(APP_ROOT, "opengraph-image.svg"),
    path.join(APP_ROOT, "twitter-image.png"),
    1200,
    630,
  ],
];

async function run() {
  for (const [src, dst, w, h] of targets) {
    if (!fs.existsSync(src)) {
      console.error(`✗ missing source: ${path.relative(ROOT, src)}`);
      process.exit(1);
    }
    await sharp(src, { density: 384 })
      .resize(w, h ?? w, { fit: "cover" })
      .png({ compressionLevel: 9 })
      .toFile(dst);
    const size = fs.statSync(dst).size;
    console.log(
      `✓ ${path.relative(ROOT, dst).padEnd(56)} ${w}x${h ?? w}   ${(size / 1024).toFixed(1)} KB`,
    );
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
