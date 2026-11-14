import { cn } from "@store-builder/ui";

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  /** Visually hide the label but keep it for assistive tech. */
  hideLabel?: boolean;
  description?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Accessible switch. Renders label/description at the start when provided.
 * The track and the thumb are the merchant dashboard's switch (its
 * components/settings/SettingsRow.tsx): a grey well when off, the brand fill
 * when on, a white thumb that travels toward the end side. The theme gives
 * them their material on the zimos-settings-switch-* hooks.
 */
export function Toggle({ checked, onChange, label, hideLabel, description, disabled, className }: ToggleProps) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "group/switch inline-flex shrink-0 cursor-pointer items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        disabled && "cursor-not-allowed"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "zimos-settings-switch-track relative h-7 w-12 shrink-0 overflow-hidden rounded-full transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] group-disabled/switch:opacity-55 motion-reduce:transition-none forced-colors:border forced-colors:border-[color:ButtonText]",
          checked ? "bg-primary forced-colors:bg-[color:Highlight]" : "bg-line-strong"
        )}
      >
        <span
          className={cn(
            // 24px in a 28 × 48 track with 2px of air: it travels 20px, toward the end side.
            "zimos-settings-switch-thumb absolute start-0.5 top-0.5 flex size-6 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform duration-[var(--dur-pop)] ease-[var(--ease-pop)] motion-reduce:transition-none forced-colors:bg-[color:ButtonText]",
            checked && "translate-x-5 rtl:-translate-x-5"
          )}
        />
      </span>
    </button>
  );
  if (!label || hideLabel) return control;
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {description && <p className="mt-0.5 text-xs text-ink-soft">{description}</p>}
      </div>
      {control}
    </div>
  );
}
