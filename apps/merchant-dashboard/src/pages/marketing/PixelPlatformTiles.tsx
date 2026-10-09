import { useId } from "react";
import type { TrackingPixelPlatform, TrackingPixelPlatformInfo } from "@store-builder/api-client";
import { useT } from "@/i18n/LocaleContext";
import { AdPlatformMark } from "@/components/AdPlatformMark";
import { AD_PLATFORM_PIXEL_STRINGS } from "./adPlatformPixelStrings";

/**
 * The platform choice of the pixel form as tiles (handoff 251): one per
 * platform the API lists, each with its mark and name. Native radios, so the
 * arrow keys move between tiles. Once a pixel exists its platform is fixed:
 * `locked` shows that one tile alone.
 */
export function PixelPlatformTiles({
  platforms,
  value,
  locked,
  nameOf,
  onChange,
}: {
  platforms: TrackingPixelPlatformInfo[];
  value: TrackingPixelPlatform;
  locked: boolean;
  nameOf: (platform: TrackingPixelPlatform) => string;
  onChange: (platform: TrackingPixelPlatform) => void;
}) {
  const t = useT(AD_PLATFORM_PIXEL_STRINGS);
  const group = useId();
  const shown = locked ? platforms.filter((p) => p.name === value) : platforms;
  return (
    <fieldset disabled={locked} className="min-w-0">
      <legend className="mb-1.5 text-sm leading-none font-medium text-ink">{t.platform}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {shown.map((p) => (
          <label
            key={p.name}
            // A small pane per platform; the chosen one takes the brand ring (glass/sweep-marketing.css: `.zimos-pick-tile`).
            className="zimos-pick-tile flex min-h-12 cursor-pointer items-center gap-2.5 rounded-[0.875rem] bg-paper-raised px-2.5 py-1.5 text-sm leading-tight text-ink ring-1 ring-line transition-[scale,background-color,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] has-[:checked]:bg-primary-soft has-[:checked]:ring-2 has-[:checked]:ring-primary has-[:disabled]:cursor-default has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary motion-safe:active:scale-[0.97] motion-reduce:transition-none"
          >
            <input
              type="radio"
              name={group}
              value={p.name}
              className="sr-only"
              checked={p.name === value}
              onChange={() => onChange(p.name)}
            />
            <AdPlatformMark platform={p.name} decorative className="h-7 w-9" />
            <span className="min-w-0 break-words">{nameOf(p.name)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
