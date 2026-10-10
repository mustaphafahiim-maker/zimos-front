import { useId } from "react";
import { Button, cn } from "@store-builder/ui";
import { RangeInput } from "@/components/RangeInput";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { GLOW_FULL, resetGlow, setGlow, useAppearance } from "@/lib/appearance";
import { GLOW_PRESETS, ORIGINAL_GLOW_LEFT, ORIGINAL_GLOW_RIGHT, type GlowPreset } from "@/lib/glowPresets";

const STRINGS = {
  en: {
    palettes: "Ready palettes",
    original: "Original",
    ocean: "Ocean",
    emerald: "Emerald",
    violet: "Violet",
    sunset: "Sunset",
    grey: "Grey",
    none: "No glows",
    left: "Left glow",
    right: "Right glow",
    intensity: "Intensity",
    percent: "{n}%",
    off: "Off",
    reset: "Reset",
  },
  ar: {
    palettes: "لوحات جاهزة",
    original: "الأصلي",
    ocean: "المحيط",
    emerald: "الزمرّد",
    violet: "البنفسجي",
    sunset: "الغروب",
    grey: "الرمادي",
    none: "بلا توهّج",
    left: "التوهّج الأيسر",
    right: "التوهّج الأيمن",
    intensity: "الشدّة",
    percent: "{n}%",
    off: "متوقف",
    reset: "إعادة الضبط",
  },
} satisfies Messages;

/** The swatch of a palette: its two colours side by side, as they fall on the screen. */
function swatchOf(preset: GlowPreset): string {
  return `linear-gradient(to right, ${preset.left ?? ORIGINAL_GLOW_LEFT}, ${preset.right ?? ORIGINAL_GLOW_RIGHT})`;
}

const PICKER =
  "size-9 shrink-0 cursor-pointer rounded-[0.625rem] border border-line-strong bg-transparent p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * The colours the glass backdrop glows in: ready palettes, a colour of your
 * own for each side, how strong the glows are, and a way back to the ones
 * the backdrop always had. Shown while glass is on; each change is drawn and
 * kept at once (lib/appearance.ts).
 */
export function GlowColours() {
  const t = useT(STRINGS);
  const { glowLeft, glowRight, glowIntensity } = useAppearance();
  const intensityId = useId();

  const off = glowIntensity === 0;
  const untouched = glowLeft === null && glowRight === null && glowIntensity === GLOW_FULL;
  // "No glows" is the strength at nothing, whatever the two colours are; any other palette is its two colours.
  const chosen = off
    ? "none"
    : GLOW_PRESETS.find((preset) => preset.intensity > 0 && preset.left === glowLeft && preset.right === glowRight)?.id;

  function choose(preset: GlowPreset) {
    if (preset.intensity === 0) setGlow({ intensity: 0 });
    // A palette picked while the glows are off brings them back.
    else setGlow({ left: preset.left, right: preset.right, intensity: off ? GLOW_FULL : undefined });
  }

  return (
    <div className="flex flex-col gap-2">
      {/* A 44px target around a 28px swatch: pulled back so the first swatch starts where the row's words do. */}
      <div role="group" aria-label={t.palettes} className="-ms-2 flex flex-wrap">
        {GLOW_PRESETS.map((preset) => {
          const pressed = preset.id === chosen;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={pressed}
              aria-label={t[preset.id]}
              title={t[preset.id]}
              onClick={() => choose(preset)}
              className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              <span
                aria-hidden
                style={preset.intensity === 0 ? undefined : { backgroundImage: swatchOf(preset) }}
                className={cn(
                  "relative block size-7 overflow-hidden rounded-full ring-1 ring-line-strong",
                  preset.intensity === 0 && "bg-paper-sunken",
                  // The chosen palette is told by a second ring, not by colour alone.
                  pressed && "outline-2 outline-offset-2 outline-primary"
                )}
              >
                {preset.intensity === 0 && <span className="absolute inset-x-0 top-1/2 h-px -rotate-45 bg-line-strong" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="color"
            value={glowLeft ?? ORIGINAL_GLOW_LEFT}
            onChange={(event) => setGlow({ left: event.target.value })}
            className={PICKER}
          />
          {t.left}
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="color"
            value={glowRight ?? ORIGINAL_GLOW_RIGHT}
            onChange={(event) => setGlow({ right: event.target.value })}
            className={PICKER}
          />
          {t.right}
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span id={intensityId} className="text-sm text-ink">
          {t.intensity}
        </span>
        <RangeInput
          labelledBy={intensityId}
          value={glowIntensity}
          onChange={(intensity) => setGlow({ intensity })}
          valueText={off ? t.off : fmt(t.percent, { n: glowIntensity })}
          className="min-w-32 flex-1"
        />
        <output className="min-w-10 text-end text-[13px] leading-5 text-ink-soft tabular-nums">
          {off ? t.off : fmt(t.percent, { n: glowIntensity })}
        </output>
        <Button type="button" size="sm" variant="outline" className="min-h-9" disabled={untouched} onClick={resetGlow}>
          {t.reset}
        </Button>
      </div>
    </div>
  );
}
