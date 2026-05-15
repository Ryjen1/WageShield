"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "default" | "primary" | "evidence" | "ghost";

const classByVariant: Record<Variant, string> = {
  default: "pill-btn",
  primary: "pill-btn-primary",
  evidence: "pill-btn-evidence",
  ghost: "pill-btn-ghost",
};

interface BaseProps {
  variant?: Variant;
  arrow?: boolean;
  className?: string;
  children: React.ReactNode;
}

type AsLink = BaseProps & { href: string } & Omit<ComponentProps<typeof Link>, "href" | "children">;
type AsButton = BaseProps & { href?: undefined } & Omit<ComponentProps<"button">, "children">;

/**
 * PillButton — rounded-full border CTA in monospaced caps with a trailing arrow.
 * The "default" variant is subdued; "primary" tints the border seal-blue; "evidence"
 * tints it green for decryption moments; "ghost" drops the border entirely (used
 * for tertiary navigation links).
 *
 * Renders as <Link> when `href` is provided, otherwise <button>.
 */
export function PillButton(props: AsLink | AsButton) {
  const { variant = "default", arrow = true, className = "", children, ...rest } = props as any;
  const cls = `${classByVariant[variant as Variant]} ${className}`;
  const content = (
    <>
      <span>{children}</span>
      {arrow && <span aria-hidden>→</span>}
    </>
  );
  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={cls} {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <button className={cls} {...rest}>
      {content}
    </button>
  );
}
