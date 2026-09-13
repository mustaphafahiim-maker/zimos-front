import { cn } from "@store-builder/ui";

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

/** Accessible switch. Renders label/description on the left when provided. */
export function Toggle({ checked, onChange, label, description, disabled, className }: ToggleProps) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        checked ? "bg-primary" : "bg-line",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <span
        className={cn(
          "inline-block size-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
  if (!label) return control;
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
