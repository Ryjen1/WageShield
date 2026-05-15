/**
 * Mono micro-label that appears above every section. `10px / 0.3em tracking /
 * uppercase`. Reads as "field-note label" — gives the editorial / classified-document
 * feel without using any decorative chrome.
 */

export function Eyebrow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={`eyebrow ${className}`}>{children}</p>;
}
