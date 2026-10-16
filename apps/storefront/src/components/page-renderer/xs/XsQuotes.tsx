"use client";

import { useState } from "react";
import { XsPicture, type XsPictureSize } from "@/components/xs/XsPicture";

export interface XsQuote {
  /** Its place in the band's `items` as saved. */
  key: string;
  quote: string;
  name: string;
  role: string;
  image: string | null;
  size: XsPictureSize | null;
}

/**
 * `xs_quotes` — customers' words, one at a time, with arrows at the sides and
 * dots underneath. Every quote is in the markup from the server; this only
 * moves `data-active` between them.
 */
export function XsQuotes({ look, heading, quotes, prevLabel, nextLabel }: { look: string; heading: string; quotes: XsQuote[]; prevLabel: string; nextLabel: string }) {
  const [active, setActive] = useState(0);
  const count = quotes.length;
  const go = (step: number) => setActive((i) => (i + step + count) % count);

  return (
    <div className="xs-quotes" data-xs-look={look}>
      {heading ? <h2 className="xs-quotes__heading">{heading}</h2> : null}
      <div className="xs-quotes__stage">
        {count > 1 ? (
          <>
            <button type="button" className="xs-quotes__arrow xs-quotes__arrow--prev" aria-label={prevLabel} onClick={() => go(-1)}>
              <span aria-hidden>‹</span>
            </button>
            <button type="button" className="xs-quotes__arrow xs-quotes__arrow--next" aria-label={nextLabel} onClick={() => go(1)}>
              <span aria-hidden>›</span>
            </button>
          </>
        ) : null}
        {quotes.map((item, index) => (
          <figure key={item.key} className="xs-quotes__item" data-xs-item={`items.${item.key}`} data-active={index === active ? "" : undefined} aria-hidden={index === active ? undefined : true}>
            <blockquote>
              <p>“{item.quote}”</p>
            </blockquote>
            <figcaption>
              {item.image ? <XsPicture src={item.image} alt={item.name} className="xs-quotes__face" pic={`items.${item.key}.image`} size={item.size} /> : null}
              {item.name ? <strong className="xs-quotes__name">{item.name}</strong> : null}
              {item.role ? <span className="xs-quotes__role">{item.role}</span> : null}
            </figcaption>
          </figure>
        ))}
      </div>
      {count > 1 ? (
        <div className="xs-quotes__dots">
          {quotes.map((item, index) => (
            <button key={item.key} type="button" aria-label={`${index + 1}`} data-active={index === active ? "" : undefined} onClick={() => setActive(index)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
