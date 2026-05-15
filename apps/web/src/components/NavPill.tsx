"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletPill } from "./WalletPill";

const TABS = [
  { href: "/worker", label: "Worker" },
  { href: "/attorney", label: "Attorney" },
  { href: "/regulator", label: "Regulator" },
  { href: "/about", label: "About" },
] as const;

/**
 * Floating liquid-glass nav pill, centered at the top of the viewport. Brand
 * lockup on the left, tab links inline, wallet connector on the right.
 * Hides the route labels under sm; only the brand + wallet stay.
 */
export function NavPill() {
  const pathname = usePathname();
  return (
    <header className="fixed top-6 left-1/2 z-50 -translate-x-1/2 w-[min(960px,calc(100%-2rem))]">
      <nav className="liquid-glass rounded-full pl-4 pr-3 py-2 flex items-center justify-between gap-3">
        <Link
          href="/"
          aria-label="WageShield home"
          className="shrink-0"
        >
          <span className="font-mono text-xs tracking-[0.3em] uppercase text-foreground">
            WageShield
          </span>
        </Link>

        <ul className="hidden sm:flex items-center gap-1">
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  className={`px-3 py-1.5 rounded-full font-mono text-[10px] tracking-[0.3em] uppercase transition-colors ${
                    active
                      ? "text-foreground bg-white/[0.06]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <WalletPill />
      </nav>
    </header>
  );
}
