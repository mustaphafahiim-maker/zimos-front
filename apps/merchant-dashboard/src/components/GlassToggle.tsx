import { cn } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";
import { setGlass, useAppearance, type GlassState } from "@/lib/appearance";

const STRINGS = {
  en: { name: "Glass surfaces" },
  ar: { name: "الأسطح الزجاجية" },
};

export type { GlassState };

/**
 * Whether glass is on, off by choice, or held off — by the device ("system")
 * or by the Black look ("black") — for the row that explains the switch.
 * The choice itself, and the attribute on <html>, are lib/appearance.ts.
 */
export function useGlassState(): GlassState {
  return useAppearance().glass;
}

interface GlassToggleProps {
  /** id of the visible label of the row; the switch takes its name from it. */
  labelledBy?: string;
  /** id of the visible hint of the row. */
  describedBy?: string;
  className?: string;
}

/** Turns the dashboard's glass surfaces on or off on this device. Drawn like the other switches, in a 44px target. */
export function GlassToggle({ labelledBy, describedBy, className }: GlassToggleProps) {
  const t = useT(STRINGS);
  const state = useGlassState();
  const on = state === "on";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : t.name}
      aria-describedby={describedBy}
      disabled={state === "system" || state === "black"}
      onClick={() => setGlass(!on)}
      className={cn(
        "group flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-11 rounded-full border transition-colors motion-reduce:transition-none",
          "group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-primary",
          on ? "border-primary bg-primary" : "border-line-strong bg-paper"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4.5 rounded-full bg-paper-raised shadow-sm transition-[inset-inline-start] motion-reduce:transition-none",
            on ? "start-[1.375rem]" : "start-0.5"
          )}
        />
      </span>
    </button>
  );
}
