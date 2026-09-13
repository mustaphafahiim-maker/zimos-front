/**
 * The ZIMOS layered diagonal slabs (layer · connect · accelerate). Decorative
 * only; position it with utility classes. Styles live in globals.css.
 */
export function Ribbons({
  className = "",
  navy = false,
}: {
  className?: string;
  /** Use the brighter variant tuned for Navy surfaces. */
  navy?: boolean;
}) {
  return (
    <div aria-hidden className={`z-ribbons ${navy ? "z-ribbons-navy" : ""} ${className}`}>
      <span className="z-ribbon z-ribbon-1" />
      <span className="z-ribbon z-ribbon-2" />
      <span className="z-ribbon z-ribbon-3" />
    </div>
  );
}
