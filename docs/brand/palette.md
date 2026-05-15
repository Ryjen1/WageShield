# WageShield — Brand

> *Editorial cinematic monochrome.* Quiet, confident, slightly classified-document.
> The visual language is restraint — heavy negative space, near-grayscale surfaces,
> a single italic-serif word per heading as the only ornament.

## Mark

A single thin-stroke glyph: circle boundary (the enclosure), inscribed W (the
letterform), solid horizontal bar across the middle (redaction across an
identifier). Reads as **shield** and **redacted text** simultaneously.

Files:

| File | Use |
|---|---|
| `apps/web/public/brand/mark.svg` | currentColor source. Use inline `<Mark />` (React) when possible. |
| `apps/web/public/brand/wordmark.svg` | JetBrains Mono caps, 6px tracking. |
| `apps/web/public/brand/logo.svg` | Mark + wordmark horizontal lockup. |
| `apps/web/src/components/primitives/Mark.tsx` | Inline React component, inherits `currentColor`. |
| `apps/web/src/app/icon.svg` | Favicon (16–32px). Explicit `#F6F7F9` so it survives browser-tab dark themes. |
| `apps/web/src/app/apple-icon.svg` | 180×180 home-screen icon. Dark rounded square + scaled mark. |
| `apps/web/src/app/opengraph-image.svg` | 1200×630 OG / Twitter card. |
| `apps/web/public/brand/banner.svg` | 1500×500 submission banner / README header. |

PNG rasterisations are committed alongside the SVGs. Regenerate any time via:

```bash
node scripts/export-brand.js
```

## Colour tokens

CSS variables live in `apps/web/src/app/globals.css`. Tailwind exposes them as
`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, etc.

### Surfaces

| Token | Dark (default) | Light |
|---|---|---|
| `--background` | `#07080d` | `#f6f7f9` |
| `--foreground` | `#f6f7f9` | `#0f1320` |
| `--muted` | `#1a1d27` | `#e9ebf0` |
| `--muted-foreground` | `#8b91a3` | `#5a6378` |
| `--border` | `rgba(255,255,255,0.08)` | `rgba(15,19,32,0.10)` |
| `--card` | `rgba(255,255,255,0.03)` | `rgba(255,255,255,0.70)` |

### Reserved accents

Used as **signal**, not surface. Don't paint generic UI with them.

| Token | Hex | When to use |
|---|---|---|
| `seal-500` | `#5168e3` | Primary actions ("File a claim", "Encrypt + submit"). |
| `evidence-400` | `#34d399` | Decryption *moments* — the revealed dollar figure, the "tx confirmed" state. Scarce by design. |
| `alarm-500` | `#ef4444` | Errors, wrong-chain warnings, k=1 anonymity-loss warning. |

## Typography

Three families, one job each. All loaded via `next/font/google` (zero install).

| Family | Source | Use |
|---|---|---|
| **Inter** | `next/font/google` | Body, UI, headings. |
| **Instrument Serif** | `next/font/google` | Italic only. One word per heading — the editorial accent. |
| **JetBrains Mono** | `next/font/google` | Eyebrow micro-labels, addresses, hashes, receipt blocks. |

### The eyebrow

The `eyebrow` class:

```
font-mono · text-[10px] sm:text-xs · tracking-[0.3em] · uppercase · text-muted-foreground
```

Appears above every section. Reads as a field-note label / classified-document marker.
Restraint here does enormous heavy lifting.

### The italic-serif emphasis

Exactly one word per heading in italic serif. Examples:

- "Recover stolen wages, without revealing *identity*."
- "When a court asks *who filed claim #4721*, this is what it gets."
- "Bounded disclosure, *on the wire*."
- "Aggregate exposure, *never the individuals*."

Two or more italic-serif words in the same headline → it stops being editorial
and starts feeling theatrical. One word only.

## Component vocabulary

| Class | Look |
|---|---|
| `liquid-glass` | `rgba(255,255,255,0.03)` + `backdrop-blur(20px) saturate(150%)` + `inset 0 1px 1px rgba(255,255,255,0.06)`. The nav pill, the receipt cards, the wallet pill. |
| `eyebrow` | The micro-label. |
| `receipt` | `font-mono`, dark background, `text-evidence-400` for decrypted facts. |
| `pill-btn[-primary | -evidence | -ghost]` | Rounded-full border button. Subdued by default; tinted for action / evidence; borderless for tertiary. |

## Don't

- Don't introduce gradients on the mark — it's a single-stroke glyph by design.
- Don't put `evidence-400` on a generic save / submit button. It belongs to the
  decryption-reveal moment only.
- Don't use two italic-serif words in the same heading.
- Don't put any accent colour (`seal`, `evidence`, `alarm`) on the brand mark.
  The mark is grayscale; the world around it is grayscale; accents earn their
  scarcity that way.
