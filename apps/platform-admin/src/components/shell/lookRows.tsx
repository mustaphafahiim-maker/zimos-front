import { useId, type ReactNode } from "react";
import { cn } from "@store-builder/ui";

/*
 * The rows of "Language and look", drawn as the merchant dashboard draws a
 * group of settings (its components/settings/SettingsRow.tsx): one card whose
 * rows are separated by hairlines, the label and hint at the start and the
 * control at the end, and a switch that is its whole row. The theme gives the
 * card, the hairlines and the switch their material on the zimos-settings-*
 * hooks (glass/settings.css).
 */

const ROW =
  "zimos-settings-row relative min-h-13 px-4 py-3 first:rounded-t-[1.25rem] last:rounded-b-[1.25rem] " +
  "before:pointer-events-none before:absolute before:end-0 before:top-0 before:h-px before:bg-line before:content-[''] first:before:hidden";

const PRESSABLE =
  "cursor-pointer text-start transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary";

/** One card of rows, with a quiet line under it. */
export function LookGroup({ footer, children }: { footer?: ReactNode; children: ReactNode }) {
  return (
    <section data-slot="settings-group" className="min-w-0">
      <div
        data-slot="card"
        className="zimos-settings-card @container flex flex-col rounded-[var(--radius-card)] bg-card text-card-foreground shadow-[var(--shadow-card)] ring-1 ring-line [--radius-card:1.25rem]"
      >
        {children}
      </div>
      {footer && <div className="mt-2 px-4 text-[13px] leading-5 text-ink-soft">{footer}</div>}
    </section>
  );
}

/** One setting: its label and hint, and what changes it. `stacked` puts the control under the label at full width. */
export function LookRow({ label, hint, control, stacked = false }: { label: string; hint?: string; control: ReactNode; stacked?: boolean }) {
  const labelId = useId();
  return (
    <div
      data-slot="settings-row"
      data-stacked={stacked ? "" : undefined}
      role="group"
      aria-labelledby={labelId}
      className={cn(ROW, "flex flex-wrap items-center gap-x-4 gap-y-2 before:start-4")}
    >
      <div className="min-w-0 flex-1">
        <p id={labelId} className="text-sm leading-5 font-medium text-ink">
          {label}
        </p>
        {hint && <p className="mt-0.5 text-[13px] leading-5 text-ink-soft">{hint}</p>}
      </div>
      <div data-slot="settings-row-control" className={cn("flex min-w-0 flex-col gap-1.5", stacked ? "min-w-full items-stretch" : "max-w-[60%] items-end")}>
        {control}
      </div>
    </div>
  );
}

/** A setting that is on or off, as a full row: the whole row is the switch. */
export function LookSwitch({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  const labelId = useId();
  const hintId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={hint ? hintId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      data-slot="settings-switch"
      className={cn(
        ROW,
        PRESSABLE,
        "group/switch flex w-full items-center gap-4 select-none before:start-4",
        "enabled:hover:bg-ink/4 enabled:active:bg-ink/8 disabled:cursor-not-allowed"
      )}
    >
      <span className="min-w-0 flex-1 group-disabled/switch:opacity-55">
        <span id={labelId} className="block text-sm leading-5 font-medium text-ink">
          {label}
        </span>
        {hint && (
          <span id={hintId} className="mt-0.5 block text-[13px] leading-5 text-ink-soft">
            {hint}
          </span>
        )}
      </span>
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
}
