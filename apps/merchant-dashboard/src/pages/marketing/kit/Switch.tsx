import { useId } from "react";
import { cn } from "@store-builder/ui";

// The Mac switch of the dashboard (the one of the protection rules, pages/fraud/rules/RuleFields.tsx):
// a 48x28 track and a thumb that slides along the reading direction — translate only, on the house
// spring. A checkbox underneath, so the keyboard, a form's change event and a screen reader get the
// real control. On its own the track is grey and turns the brand colour; glass/returns-protection.css
// (`.zimos-switch`) gives it the brand gradient and the glow.
const SWITCH =
  "zimos-switch relative h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-line-strong/60 " +
  "transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] checked:bg-primary " +
  "disabled:cursor-default disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none " +
  "before:absolute before:start-0.5 before:top-0.5 before:size-6 before:rounded-full before:bg-white before:shadow-[0_1px_3px_rgb(0_0_0/0.3)] before:content-[''] " +
  "before:transition-[translate] before:duration-[var(--dur-move)] before:ease-[var(--ease-spring)] motion-reduce:before:transition-none " +
  "checked:before:translate-x-5 checked:before:bg-primary-foreground rtl:checked:before:-translate-x-5 forced-colors:checked:bg-[color:Highlight]";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** What it switches, for a screen reader: «شغّالة: رسالة الشحن». */
  label: string;
  disabled?: boolean;
  /** The change is on its way: a second press waits for the first. */
  busy?: boolean;
  className?: string;
}

/**
 * A switch on its own — on a card, at the end of a row. The track is 28px
 * tall; the label around it brings the target to 44px. It sits above whatever
 * button is laid over its card (`relative z-10`), and a press on it never
 * reaches that button.
 */
export function Switch({ checked, onChange, label, disabled = false, busy = false, className }: SwitchProps) {
  return (
    <label
      className={cn("relative z-10 inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center has-[:disabled]:cursor-default", className)}
      onClick={(event) => event.stopPropagation()}
    >
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        aria-busy={busy || undefined}
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          if (!busy) onChange(event.target.checked);
        }}
        className={SWITCH}
      />
    </label>
  );
}

export interface SwitchRowProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}

/** A switch with its label and hint. The whole row is the target, at least 44px tall. */
export function SwitchRow({ checked, onChange, label, hint, disabled = false, className }: SwitchRowProps) {
  const hintId = useId();
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-center gap-3 py-1 has-[:disabled]:cursor-default", className)}>
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-6 font-medium text-ink">{label}</span>
        {hint && (
          <span id={hintId} className="block text-[13px] leading-5 text-ink-soft">
            {hint}
          </span>
        )}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={hint ? hintId : undefined}
        className={SWITCH}
      />
    </label>
  );
}
