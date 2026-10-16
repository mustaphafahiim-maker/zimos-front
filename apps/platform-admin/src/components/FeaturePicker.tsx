import type { PlanFeatureCatalogEntry, PlanFeatureKey } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";

/**
 * The feature catalogue as tick boxes — what a plan includes, and what a
 * store is given or refused on top of its plan. The keys, their names and
 * whether each feature exists today all come from the backend's catalogue
 * (`catalog`), so a feature is named the same everywhere and nothing is
 * listed here.
 *
 * A feature that doesn't exist yet carries a "Coming soon" badge. With
 * `lockUnavailable` (the plan editor) it can't be ticked — the API refuses it
 * too (422 PLAN_FEATURE_NOT_AVAILABLE) — but a plan that already lists one can
 * still have it unticked.
 */
export function FeaturePicker({
  catalog,
  value,
  onChange,
  legend = "Features",
  disabled = [],
  lockUnavailable = false,
  hint,
  className,
}: {
  catalog: readonly PlanFeatureCatalogEntry[];
  value: PlanFeatureKey[];
  onChange: (next: PlanFeatureKey[]) => void;
  legend?: string;
  /** Keys that can't be ticked here, with the reason shown next to them. */
  disabled?: Array<{ key: PlanFeatureKey; reason: string }>;
  /** Refuse ticking a feature that isn't available yet. */
  lockUnavailable?: boolean;
  hint?: string;
  className?: string;
}) {
  const blocked = new Map(disabled.map((d) => [d.key, d.reason]));
  return (
    <fieldset className={className}>
      <legend className="mb-2 text-sm font-medium text-ink">{legend}</legend>
      {hint && <p className="-mt-1 mb-2 text-xs text-ink-soft">{hint}</p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {catalog.map((f) => {
          const checked = value.includes(f.key);
          const locked = lockUnavailable && !f.available && !checked;
          const reason = blocked.get(f.key) ?? (locked ? "Not available yet, so it can't be added to a plan" : undefined);
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
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5">
                  {f.label.en}
                  {!f.available && (
                    <span className="rounded-full border border-line px-1.5 py-px text-[11px] font-medium text-ink-soft">Coming soon</span>
                  )}
                </span>
                {reason && <span className="block text-xs text-ink-soft">{reason}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
