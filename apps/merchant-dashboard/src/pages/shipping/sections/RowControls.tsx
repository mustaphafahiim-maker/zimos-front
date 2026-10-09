import type { ReactNode } from "react";
import { cn } from "@store-builder/ui";

/**
 * A switch on its own, for a row of a list (a zone, a rate): the same track
 * and thumb as `SettingsSwitch`, in a 44px target. `label` says what it
 * switches, for screen readers and as the tooltip.
 */
export function MiniSwitch({
  checked,
  onChange,
  label,
  disabled = false,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-full px-1 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-55",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "zimos-settings-switch-track relative h-7 w-12 shrink-0 overflow-hidden rounded-full transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none forced-colors:border forced-colors:border-[color:ButtonText]",
          checked ? "bg-primary forced-colors:bg-[color:Highlight]" : "bg-line-strong"
        )}
      >
        <span
          className={cn(
            "zimos-settings-switch-thumb absolute start-0.5 top-0.5 size-6 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform duration-[var(--dur-pop)] ease-[var(--ease-pop)] motion-reduce:transition-none forced-colors:bg-[color:ButtonText]",
            checked && "translate-x-5 rtl:-translate-x-5"
          )}
        />
      </span>
    </button>
  );
}

/** A round 44px button that is only an icon: edit, delete. `label` is its name. */
export function RowIconButton({
  label,
  onClick,
  danger = false,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[background-color,color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 [&>svg]:size-[18px]",
        danger ? "hover:bg-danger-soft hover:text-danger" : "hover:bg-ink/8 hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}

/** The card a list of rows sits in: the same pane as a `SettingsGroup`, without its rows' own padding. */
export const LIST_CARD =
  "min-w-0 rounded-[var(--radius-card)] bg-card text-card-foreground shadow-[var(--shadow-card)] ring-1 ring-line [--radius-card:1.25rem]";
