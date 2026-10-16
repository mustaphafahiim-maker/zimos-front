"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useImmersiveAllowed } from "./useImmersive";

/**
 * Gives anything inside it a small, physical tilt: the card leans towards the
 * pointer and a highlight slides across it. On a phone, where there is no
 * pointer, it leans with the device instead.
 *
 * Deliberately CSS-only — no library, no canvas — so it is cheap enough to put
 * on every product card in a grid. When the visitor asks for reduced motion,
 * or the device looks weak, nothing moves and the card renders as-is.
 */
export function TiltCard({
  children,
  className = "",
  max = 10,
  sheen = true,
}: {
  children: ReactNode;
  className?: string;
  /** Maximum lean in degrees. */
  max?: number;
  sheen?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const allowed = useImmersiveAllowed();

  const lean = (xRatio: number, yRatio: number) => {
    const el = ref.current;
    if (!el) return;
    // The document direction flips the lean so it reads the same way in Arabic.
    const dir = getComputedStyle(el).direction === "rtl" ? -1 : 1;
    el.style.transform = `perspective(900px) rotateX(${(-yRatio * max).toFixed(2)}deg) rotateY(${(xRatio * max * dir).toFixed(2)}deg)`;
    el.style.setProperty("--tilt-sheen", `${(xRatio * 100).toFixed(1)}%`);
  };

  const rest = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "";
    el.style.setProperty("--tilt-sheen", "-120%");
  };

  // Phones have no pointer, so the lean follows how the device is held. iOS
  // needs an explicit permission prompt for this, which a product card is not
  // the place to ask for — there the card simply sits still.
  useEffect(() => {
    if (!allowed || typeof window === "undefined" || !window.matchMedia("(hover: none)").matches) return;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) return;
      lean(Math.max(-1, Math.min(1, e.gamma / 45)) / 2, Math.max(-1, Math.min(1, (e.beta - 45) / 45)) / 2);
    };
    window.addEventListener("deviceorientation", onTilt);
    return () => window.removeEventListener("deviceorientation", onTilt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, max]);

  if (!allowed) return <div className={className}>{children}</div>;

  return (
    <div
      ref={ref}
      className={`relative transition-transform duration-200 ease-out will-change-transform ${className}`}
      style={{ transformStyle: "preserve-3d" }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        lean((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={rest}
    >
      {children}
      {sheen && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
          style={{
            background:
              "linear-gradient(115deg, transparent 38%, color-mix(in srgb, var(--color-paper-raised) 55%, transparent) 50%, transparent 62%)",
            transform: "translateX(var(--tilt-sheen, -120%))",
            transition: "transform 200ms ease-out",
          }}
        />
      )}
    </div>
  );
}
