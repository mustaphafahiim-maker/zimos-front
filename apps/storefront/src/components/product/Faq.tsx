import { ChevronIcon } from "../Icons";

/** Native <details> accordion — no client JS. */
export function Faq({ title, items }: { title: string; items: { q: string; a: string }[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="faq-title">
      <h2 id="faq-title" className="text-xl font-semibold text-ink">
        {title}
      </h2>
      <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-raised">
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
