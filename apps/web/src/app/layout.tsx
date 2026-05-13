import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: {
    default: "WageShield — Confidential Wage-Theft Claims",
    template: "%s · WageShield",
  },
  description:
    "Recover stolen wages without revealing who you are. Privacy-first claims layer on Fhenix CoFHE + Privara.",
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
    title: "WageShield — Confidential Wage-Theft Claims",
    description:
      "Recover stolen wages without revealing who you are. Privacy-first claims layer on Fhenix CoFHE + Privara.",
    siteName: "WageShield",
  },
  twitter: {
    card: "summary_large_image",
    title: "WageShield — Confidential Wage-Theft Claims",
    description:
      "Recover stolen wages without revealing who you are. Privacy-first claims layer on Fhenix CoFHE + Privara.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Nav />
          <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
