import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { NavPill } from "@/components/NavPill";
import { CursorSpotlight } from "@/components/primitives/CursorSpotlight";
import { inter, instrumentSerif, geistMono } from "@/lib/fonts";

export const metadata: Metadata = {
  title: {
    default: "WageShield — Recover stolen wages",
    template: "%s · WageShield",
  },
  description:
    "Recover stolen wages without revealing who you are. A confidential wage-theft claims layer on Fhenix CoFHE.",
  applicationName: "WageShield",
  authors: [{ name: "WageShield" }],
  keywords: [
    "WageShield",
    "Fhenix",
    "CoFHE",
    "Privara",
    "wage theft",
    "FHE",
    "fully homomorphic encryption",
    "confidential compute",
    "encrypted EVM",
    "privacy",
  ],
  openGraph: {
    type: "website",
    title: "WageShield — Recover stolen wages",
    description:
      "Recover stolen wages without revealing who you are. A confidential wage-theft claims layer on Fhenix CoFHE.",
    siteName: "WageShield",
  },
  twitter: {
    card: "summary_large_image",
    title: "WageShield — Recover stolen wages",
    description:
      "Recover stolen wages without revealing who you are. A confidential wage-theft claims layer on Fhenix CoFHE.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSerif.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Providers>
          <CursorSpotlight />
          <NavPill />
          <main className="relative flex flex-1 flex-col overflow-x-hidden">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
