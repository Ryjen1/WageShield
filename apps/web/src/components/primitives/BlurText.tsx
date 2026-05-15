"use client";

import { useEffect, useState } from "react";

/**
 * Word-by-word blur-in animation. Each word starts blurred + offset + transparent;
 * on mount each word animates to crisp + on-baseline + opaque, staggered by index.
 *
 * One word can be highlighted in italic serif (the "Compass move") — pass it via
 * `italicWords`. Matching is case-insensitive and strips trailing punctuation.
 */
export function BlurText({
  text,
  italicWords = [],
  className = "",
  delayPerWord = 120,
}: {
  text: string;
  italicWords?: string[];
  className?: string;
  delayPerWord?: number;
}) {
  const words = text.split(" ");
  const [revealed, setRevealed] = useState<boolean[]>(() => words.map(() => false));
  const italicLower = italicWords.map((w) => w.toLowerCase());

  useEffect(() => {
    const timers = words.map((_, i) =>
      setTimeout(() => {
        setRevealed((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, i * delayPerWord),
    );
    return () => timers.forEach(clearTimeout);
  }, [text, delayPerWord]);

  return (
    <span className={className}>
      {words.map((w, i) => {
        const stripped = w.toLowerCase().replace(/[.,;:!?]+$/, "");
        const isItalic = italicLower.includes(stripped);
        return (
          <span
            key={`${w}-${i}`}
            className={`inline-block transition-all duration-700 ease-out ${
              isItalic ? "font-serif italic" : ""
            }`}
            style={
              revealed[i]
                ? { opacity: 1, filter: "blur(0)", transform: "translateY(0)" }
                : { opacity: 0, filter: "blur(10px)", transform: "translateY(36px)" }
            }
          >
            {w}
            {i < words.length - 1 ? "\u00A0" : ""}
          </span>
        );
      })}
    </span>
  );
}
