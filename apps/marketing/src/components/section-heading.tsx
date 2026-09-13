/** Kicker + h2 + intro, used at the top of every section. */
export function SectionHeading({
  id,
  kicker,
  heading,
  intro,
  align = "start",
  className = "",
}: {
  /** Put on the <h2>; the section references it with aria-labelledby. */
  id: string;
  kicker: string;
  heading: string;
  intro?: string;
  align?: "start" | "center";
  className?: string;
}) {
  const center = align === "center";
  return (
    <div className={`max-w-2xl ${center ? "mx-auto text-center" : ""} ${className}`}>
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
        <span
          aria-hidden
          className="h-1.5 w-4 -skew-x-[24deg] rounded-[2px] bg-linear-to-r from-zimos-blue to-zimos-sky"
        />
        {kicker}
      </p>
      <h2 id={id} className="mt-3 text-3xl font-bold text-ink sm:text-4xl">
        {heading}
      </h2>
      {intro ? (
        <p className="mt-4 text-lg leading-relaxed text-pretty text-ink-soft">{intro}</p>
      ) : null}
    </div>
  );
}
