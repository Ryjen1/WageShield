/**
 * The WageShield mark as an inline React component. Uses `currentColor` so the
 * stroke + redaction bar inherit whatever text color the parent sets — keeps
 * the mark legible against light or dark backgrounds without two files.
 *
 * Editorial monochrome glyph:
 *  - Circle boundary (the "shield enclosure")
 *  - W inscribed (the company/worker letterform)
 *  - Solid horizontal bar across the middle (redaction across an identifier)
 *
 * For raster contexts (favicon, OG image) see the matching files in
 * apps/web/src/app/icon.svg and apps/web/public/brand/mark.svg.
 */
export function Mark({ className = "", strokeWidth = 1.6 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="WageShield"
      fill="none"
      className={className}
    >
      <circle cx="32" cy="32" r="29" stroke="currentColor" strokeWidth={strokeWidth} />
      <path
        d="M16 22 L23.5 44 L32 28 L40.5 44 L48 22"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="miter"
        strokeLinecap="square"
      />
      <rect x="11" y="31" width="42" height="2.5" fill="currentColor" />
    </svg>
  );
}
