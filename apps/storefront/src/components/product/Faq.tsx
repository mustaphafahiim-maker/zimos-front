import { ChevronIcon } from "../Icons";

/**
 * Native <details> accordion — no client JS. Inside the product page's tabs
 * the tab itself is the visible title, so `titleHidden` keeps the heading for
 * screen readers only.
 */
export function Faq({
  title,
  items,
  titleHidden = false,
}: {
  title: string;
  items: { q: string; a: string }[];
  titleHidden?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="faq-title">
      <h2 id="faq-title" className={titleHidden ? "sr-only" : "text-xl font-semibold text-ink"}>
        {title}
      </h2>
      <div className={`divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-raised ${titleHidden ? "" : "mt-4"}`}>
        {items.map((item, i) => (
          <details key={i} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-paper [&::-webkit-details-marker]:hidden">
              {item.q}
              <ChevronIcon size={18} className="shrink-0 text-ink-soft transition-transform group-open:rotate-180" />
            </summary>
            <p className="whitespace-pre-line px-5 pb-4 text-sm leading-relaxed text-ink-soft">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
