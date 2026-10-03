import type { PlanFeatureKey } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { PLAN_FEATURES } from "@/lib/planFeatures";

/**
 * The feature catalogue as tick boxes — what a plan includes, and what a
 * store is given or refused on top of its plan. One list of keys and labels
 * (lib/planFeatures) for both, so a feature is named the same everywhere.
 */
export function FeaturePicker({
  value,
  onChange,
  legend = "Features",
  disabled = [],
  hint,
  className,
}: {
  value: PlanFeatureKey[];
  onChange: (next: PlanFeatureKey[]) => void;
  legend?: string;
  /** Keys that can't be ticked here, with the reason shown next to them. */
  disabled?: Array<{ key: PlanFeatureKey; reason: string }>;
  hint?: string;
  className?: string;
}) {
  const blocked = new Map(disabled.map((d) => [d.key, d.reason]));
  return (
    <fieldset className={className}>
      <legend className="mb-2 text-sm font-medium text-ink">{legend}</legend>
      {hint && <p className="-mt-1 mb-2 text-xs text-ink-soft">{hint}</p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {PLAN_FEATURES.map((f) => {
          const checked = value.includes(f.key);
          const reason = blocked.get(f.key);
          return (
            <label
              key={f.key}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-[10px] border border-line px-3 py-2 text-sm text-ink",
                reason ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-ink-soft"
              )}
            >
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-primary)]"
                checked={checked}
                disabled={Boolean(reason)}
                onChange={() => onChange(checked ? value.filter((k) => k !== f.key) : [...value, f.key])}
              />
              <span>
                {f.label}
                {reason && <span className="block text-xs text-ink-soft">{reason}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
