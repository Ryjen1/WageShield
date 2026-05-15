/**
 * Cinematic Privacy typography. Three families, one job each:
 *
 *  - Inter (sans)            — UI, body, headings. Workhorse.
 *  - Instrument Serif (serif) — italic emphasis on a single word per heading.
 *                               Editorial / "New Yorker" feel; high-signal accent.
 *  - Geist Mono (mono)        — eyebrow labels (`10px / 0.3em tracking / upper`),
 *                               on-chain hashes, receipt blocks. Suggests
 *                               classified document.
 *
 * Each font is loaded via next/font/google so the woff2 is bundled and there
 * is no flash of unstyled text.
 */
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";

export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

export const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument-serif",
  weight: ["400"],
  style: ["normal", "italic"],
});

export const geistMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
  weight: ["400", "500"],
});
