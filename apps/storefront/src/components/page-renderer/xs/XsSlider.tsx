"use client";

import { useEffect, useState } from "react";
import { StoreLink } from "@/components/StoreRoute";
import { xsBackground } from "@/lib/xsPicture";

export interface XsSlide {
  key: string;
  image: string;
  eyebrow: string;
  heading: string;
  /** A sentence under the heading; empty draws none. */
  text: string;
  buttonLabel: string;
  buttonHref: string | null;
  /** The point the picture centres on ("30% 60%"); null keeps the look's. */
  focal?: string | null;
}

/**
 * `xs_slider` — full-width pictures that cross-fade, each with a small line,
 * a large heading and one button that drop in one after the other.
 *
 * Every slide is in the markup from the server, so the first paints without
 * JavaScript; this component only moves `data-active` from slide to slide.
 * Only the first slide's picture is asked for with the page: the others wait
 * until the page has loaded, so they never compete with what is on screen.
 */
export function XsSlider({
  look,
  slides,
  autoplay,
  seconds,
  prevLabel,
  nextLabel,
}: {
  look: string;
  slides: XsSlide[];
  autoplay: boolean;
  seconds: number;
  prevLabel: string;
  nextLabel: string;
}) {
  const [active, setActive] = useState(0);
  const [rest, setRest] = useState(false);
  const count = slides.length;

  useEffect(() => {
    if (document.readyState === "complete") {
      setRest(true);
      return;
    }
    const load = () => setRest(true);
    window.addEventListener("load", load, { once: true });
    return () => window.removeEventListener("load", load);
  }, []);

  useEffect(() => {
    if (!autoplay || count < 2) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % count), seconds * 1000);
    return () => window.clearInterval(id);
    // Restarting on `active` gives a slide its full time after a manual move.
  }, [autoplay, count, seconds, active]);

  const go = (step: number) => setActive((i) => (i + step + count) % count);

  return (
    <div className="xs-slider" data-xs-look={look}>
      {slides.map((slide, index) => (
        <div
          key={slide.key}
          className="xs-slider__slide"
          data-xs-item={`slides.${slide.key}`}
          data-active={index === active ? "" : undefined}
          aria-hidden={index === active ? undefined : true}
          style={index === 0 || rest || index === active ? xsBackground(slide.image, slide.focal) : undefined}
          data-xs-bg={`slides.${slide.key}.image`}
          data-xs-bg-src={slide.image}
        >
          {/* The template's photograph mirrored, on a right-to-left store only (app/xs-sections.css). */}
          <span className="xs-slider__photo" aria-hidden />
          <div className="xs-slider__inner">
            {slide.eyebrow ? <span className="xs-slider__eyebrow">{slide.eyebrow}</span> : null}
            {slide.heading ? <h2 className="xs-slider__heading">{slide.heading}</h2> : null}
            {slide.text ? <p className="xs-slider__line">{slide.text}</p> : null}
            {slide.buttonLabel && slide.buttonHref ? (
              <StoreLink href={slide.buttonHref} className="xs-slider__button" tabIndex={index === active ? undefined : -1}>
                {slide.buttonLabel}
              </StoreLink>
            ) : null}
          </div>
        </div>
      ))}
      {count > 1 ? (
        <>
          <button type="button" className="xs-slider__arrow xs-slider__arrow--prev" aria-label={prevLabel} onClick={() => go(-1)}>
            <span aria-hidden>‹</span>
          </button>
          <button type="button" className="xs-slider__arrow xs-slider__arrow--next" aria-label={nextLabel} onClick={() => go(1)}>
            <span aria-hidden>›</span>
          </button>
        </>
      ) : null}
    </div>
  );
}
