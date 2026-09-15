"use client";

import { useState } from "react";
import { BoxIcon } from "../Icons";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];

  return (
    <div>
      <div className="aspect-square overflow-hidden rounded-2xl border border-line bg-paper">
        {current ? (
          // Merchant media are arbitrary remote URLs (no next/image allowlist).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current}
            alt={name}
            width={900}
            height={900}
            fetchPriority="high"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary/40">
            <BoxIcon size={72} />
          </div>
        )}
      </div>

      {images.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <li key={`${src}-${i}`} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`${name} — ${i + 1}/${images.length}`}
                aria-pressed={i === active}
                className={`block h-16 w-16 cursor-pointer overflow-hidden rounded-xl border-2 transition-colors sm:h-20 sm:w-20 ${
                  i === active ? "border-primary" : "border-line hover:border-primary"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" width={80} height={80} loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
