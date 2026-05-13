"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "./WalletButton";

const TABS = [
  { href: "/worker", label: "Worker" },
  { href: "/attorney", label: "Attorney" },
  { href: "/regulator", label: "Regulator" },
  { href: "/about", label: "About" },
] as const;

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-900 sticky top-0 z-10">
      <nav className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-semibold text-lg tracking-tight">
          WageShield <span className="text-seal-500">·</span>{" "}
          <span className="font-mono text-xs text-ink-500">v0.1</span>
        </Link>
        <div className="flex items-center gap-6">
          <ul className="flex gap-4 text-sm">
            {TABS.map((t) => {
              const active = pathname === t.href;
              return (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    className={
                      active
                        ? "text-seal-600 font-medium"
                        : "text-ink-500 hover:text-ink-900 dark:hover:text-ink-50"
                    }
                  >
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <WalletButton />
        </div>
      </nav>
    </header>
  );
}
