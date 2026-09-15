/**
 * The layered diagonal slabs of the Z motif (layer · connect · accelerate).
 * Decorative only; position it with utility classes. Styles live in
 * globals.css, in the primary family only — never amber, since the slabs sit
 * behind body text.
 */
export function Ribbons({
  className = "",
  onDark = false,
}: {
  className?: string;
  /** Use the brighter variant tuned for the deep closing band. */
  onDark?: boolean;
}) {
  return (
    <div aria-hidden className={`z-ribbons ${onDark ? "z-ribbons-deep" : ""} ${className}`}>
      <span className="z-ribbon z-ribbon-1" />
      <span className="z-ribbon z-ribbon-2" />
      <span className="z-ribbon z-ribbon-3" />
    </div>
  );
}
