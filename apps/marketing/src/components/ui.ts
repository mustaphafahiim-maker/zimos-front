import type { CSSProperties } from "react";

/** Shared button recipes — combine with a height/padding/text-size set. */
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-zimos-blue font-semibold text-white transition-colors duration-200 hover:bg-zimos-blue/90 active:bg-zimos-blue/80";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-line-strong bg-paper-raised font-medium text-ink transition-colors duration-200 hover:border-zimos-blue hover:text-primary";

export const btnGhost =
  "inline-flex items-center justify-center rounded-lg font-medium text-ink-soft transition-colors duration-200 hover:bg-primary-soft hover:text-ink";

export const container = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

/** Stagger for `.z-layer` entrance animations. */
export function layerDelay(ms: number): CSSProperties {
  return { "--z-delay": `${ms}ms` } as CSSProperties;
}
