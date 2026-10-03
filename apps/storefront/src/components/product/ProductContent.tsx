import type { ProductCms } from "@store-builder/api-client";
import type { Locale } from "@/lib/i18n";
import { card } from "../ui";
import { productPageText } from "./productPageText";

function Stars({ rating, label }: { rating: number; label: string }) {
  return (
    <span role="img" aria-label={label} className="text-sm tracking-tight text-primary" dir="ltr">
      {"★".repeat(rating)}
      <span className="text-line">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

/**
 * The product's structured content, as the merchant wrote it: what makes it
 * worth buying, and what real customers said. (Its FAQs go in the page's FAQ
 * tab.) Renders nothing when the product has neither.
 */
export function ProductContent({ cms, locale }: { cms: ProductCms; locale: Locale }) {
  const text = productPageText(locale);
  if (cms.features.length === 0 && cms.testimonials.length === 0) return null;

  return (
    <div className="mt-12 space-y-12">
      {cms.features.length > 0 && (
        <section aria-labelledby="product-features-title">
          <h2 id="product-features-title" className="text-xl font-semibold text-ink">
            {text.features}
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cms.features.map((feature, i) => (
              <li key={i} className={`${card} overflow-hidden`}>
                {feature.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={feature.image} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                )}
                <div className="p-5">
                  <h3 className="text-base font-semibold text-ink">{feature.title}</h3>
                  {feature.description && (
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{feature.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {cms.testimonials.length > 0 && (
        <section aria-labelledby="product-testimonials-title">
          <h2 id="product-testimonials-title" className="text-xl font-semibold text-ink">
            {text.testimonials}
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cms.testimonials.map((item, i) => (
              <li key={i} className={`${card} flex flex-col gap-3 p-5`}>
                {item.rating ? <Stars rating={item.rating} label={text.ratingOf(item.rating)} /> : null}
                <blockquote className="flex-1 whitespace-pre-line text-sm leading-relaxed text-ink">{item.text}</blockquote>
                <div className="flex items-center gap-3">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt="" loading="lazy" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary"
                    >
                      {item.name.trim().charAt(0)}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-ink">{item.name}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
