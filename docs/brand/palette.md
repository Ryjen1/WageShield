# WageShield — Brand Palette

> *Cinematic Privacy.* Confident, institutional, slightly cinematic. Reads well on
> both light backgrounds (worker-facing UI) and dark backgrounds (demo video,
> presentation slides).

## Tokens

The web app's source of truth is [`apps/web/tailwind.config.ts`](../../apps/web/tailwind.config.ts).
This doc is the human-readable reference; updates flow **into** the Tailwind config,
not the other way around.

### Ink — base text + surface

Neutral cool grey. Used for primary type, backgrounds, and chrome.

| Token       | Hex      | RGB            | Use                                       |
| ----------- | -------- | -------------- | ----------------------------------------- |
| `ink-50`    | `#f6f7f9` | 246 247 249    | Light-mode background                     |
| `ink-100`   | `#e9ebf0` | 233 235 240    | Subtle surface fill, mono code background |
| `ink-200`   | `#cbd0db` | 203 208 219    | Hairline borders                          |
| `ink-300`   | `#9aa3b6` | 154 163 182    | Disabled state                            |
| `ink-500`   | `#5a6378` | 90 99 120      | Secondary text                            |
| `ink-700`   | `#2c3346` | 44 51 70       | Dark-mode chrome / borders                |
| `ink-900`   | `#0f1320` | 15 19 32       | Dark-mode background, receipt block       |

### Seal — primary action / brand accent

Cool muted indigo. Action buttons, brand wordmark dot, active nav state.

| Token       | Hex      | RGB            | Use                                  |
| ----------- | -------- | -------------- | ------------------------------------ |
| `seal-50`   | `#eef2ff` | 238 242 255    | Light hover fill                     |
| `seal-100`  | `#e0e7ff` | 224 231 255    | Pill background (badges, hints)      |
| `seal-400`  | `#7c8df0` | 124 141 240    | Logo accent, hover border            |
| `seal-500`  | `#5168e3` | 81 104 227     | Brand mark, link colour              |
| `seal-600`  | `#3a4fc9` | 58 79 201      | Primary button (default)             |
| `seal-700`  | `#2c3da3` | 44 61 163      | Primary button (hover/pressed)       |

### Evidence — success / decryption reveal

Mint green. Reserved for **moments of confirmed truth**: decrypted plaintext
revealed via permit, "tx confirmed" state, regulator aggregate exposed. Don't use
for generic success — keep it scarce.

| Token            | Hex      | RGB           | Use                                   |
| ---------------- | -------- | ------------- | ------------------------------------- |
| `evidence-400`   | `#34d399` | 52 211 153   | Receipt-block plaintext (mono code)   |
| `evidence-500`   | `#10b981` | 16 185 129   | Decrypted dollar figures              |
| `evidence-600`   | `#059669` | 5 150 105    | Decryption button (default)           |

### Alarm — danger / risk warning

Used sparingly: wrong-chain warnings, missing-config banners, k=1 anonymity-loss
warning on the regulator page.

| Token        | Hex      | RGB           | Use                                  |
| ------------ | -------- | ------------- | ------------------------------------ |
| `alarm-500`  | `#ef4444` | 239 68 68   | Error text / disconnect link         |
| `alarm-600`  | `#dc2626` | 220 38 38   | Pressed state                        |

## Typography

| Family           | Weights        | Source     | Used for                            |
| ---------------- | -------------- | ---------- | ----------------------------------- |
| **Inter**        | 400, 500, 600  | Google     | Body, UI, headings                  |
| **JetBrains Mono** | 400, 500     | Google     | Addresses, hashes, receipts, code   |

Letter-spacing on display headings: `-0.01em` (Tailwind `tracking-tight`). Body
runs at the default `letter-spacing: 0`.

## Logo usage

- The mark is the **shield + encrypted-handle motif**. The wordmark sits to its
  right at the same x-height.
- Minimum clear space around the lockup = 0.5× the shield's height on all sides.
- The `seal-500` glyph and `ink-900` wordmark is the default lockup. On dark
  backgrounds invert the wordmark to `ink-50` and keep the mark at `seal-400`.
- Don't recolour the shield to any non-palette colour. Don't apply drop shadows.
  Don't skew, stretch, or rotate.

## Don't

- Don't use the warning red for general accents — it loses its signalling power.
- Don't put the `evidence` mint outside of a "decrypted plaintext" context. Mint
  on a generic button reads as "save" — which is exactly the wrong association
  for a tool that's about keeping things encrypted.
- Don't mix `seal` and `evidence` in the same component without an obvious
  semantic reason. Two greens / blues fighting for attention degrades the
  "permit revealed a fact" moment.

## Files

- [`apps/web/public/brand/logo.svg`](../../apps/web/public/brand/logo.svg) — full lockup (mark + wordmark)
- [`apps/web/public/brand/mark.svg`](../../apps/web/public/brand/mark.svg) — just the shield mark
- [`apps/web/public/brand/wordmark.svg`](../../apps/web/public/brand/wordmark.svg) — just the wordmark
- [`apps/web/src/app/icon.svg`](../../apps/web/src/app/icon.svg) — favicon (Next.js convention)
- [`apps/web/src/app/opengraph-image.svg`](../../apps/web/src/app/opengraph-image.svg) — OG / social-card image
