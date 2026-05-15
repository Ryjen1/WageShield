import { Eyebrow } from "./Eyebrow";

/**
 * Editorial section: eyebrow → title → body. Used for every content section
 * outside the hero so the page reads with a consistent rhythm.
 */
export function Section({
  eyebrow,
  title,
  children,
  className = "",
}: {
  eyebrow?: string;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`max-w-3xl space-y-5 ${className}`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      {title && (
        <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">{title}</h2>
      )}
      <div className="space-y-4 text-base text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}
