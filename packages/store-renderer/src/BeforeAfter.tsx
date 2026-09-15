"use client";

import { useState } from "react";

/**
 * Before/after comparison: two stacked images, the "before" one clipped to
 * the slider position. A native range input covers the frame, so it works by
 * drag, tap and keyboard, and follows RTL (the before side sits at the start).
 */
export function BeforeAfter({
  before,
  after,
  beforeLabel,
  afterLabel,
}: {
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
}) {
  const [pos, setPos] = useState(50);
  return (
    <div className="zr-ba" style={{ ["--zr-ba" as string]: `${pos}%` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt={afterLabel} className="zr-ba__img" loading="lazy" decoding="async" draggable={false} />
      <div className="zr-ba__before">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt={beforeLabel} className="zr-ba__img" loading="lazy" decoding="async" draggable={false} />
      </div>
      <span className="zr-ba__line" aria-hidden>
        <span className="zr-ba__knob">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 6-6 6 6 6M15 6l6 6-6 6" />
          </svg>
        </span>
      </span>
      {beforeLabel && <span className="zr-ba__tag zr-ba__tag--before">{beforeLabel}</span>}
      {afterLabel && <span className="zr-ba__tag zr-ba__tag--after">{afterLabel}</span>}
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={[beforeLabel, afterLabel].filter(Boolean).join(" / ") || "Before / after"}
        className="zr-ba__range"
      />
    </div>
  );
}
