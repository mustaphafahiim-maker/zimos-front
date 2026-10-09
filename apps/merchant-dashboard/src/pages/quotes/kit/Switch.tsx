import { useId } from "react";
import { cn } from "@store-builder/ui";

// The Mac switch the rules of Protection use (pages/fraud/rules/RuleFields.tsx): a 48x28 track and a thumb
// that slides along the reading direction — translate only, on the house spring. A checkbox underneath, so
// the keyboard and screen readers get the real control. On its own the track is grey and turns the brand
// colour; the glass layer styles `.zimos-switch` once (glass/returns-protection.css) with the brand gradient.
const SWITCH =
  "zimos-switch relative h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-line-strong/60 " +
  "transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] checked:bg-primary " +
  "disabled:cursor-default disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none " +
  "before:absolute before:start-0.5 before:top-0.5 before:size-6 before:rounded-full before:bg-white before:shadow-[0_1px_3px_rgb(0_0_0/0.3)] before:content-[''] " +
  "before:transition-[translate] before:duration-[var(--dur-move)] before:ease-[var(--ease-spring)] motion-reduce:before:transition-none " +
  "checked:before:translate-x-5 checked:before:bg-primary-foreground rtl:checked:before:-translate-x-5 forced-colors:checked:bg-[color:Highlight]";

export interface SwitchRowProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  /** The id of the switch itself, for a form that wants to focus it. */
  id?: string;
  /** Read out instead of the visible label, when the label alone would not say which row it belongs to. */
  ariaLabel?: string;
  /** The words lead and the switch closes the line (the default), or the switch leads a short label. */
  side?: "end" | "start";
  className?: string;
}

/** A switch with its label and hint. The whole row is the target, at least 44px tall. */
export function SwitchRow({ checked, onChange, label, hint, disabled, id, ariaLabel, side = "end", className }: SwitchRowProps) {
  const hintId = useId();
  const control = (
    <input
      id={id}
      type="checkbox"
      role="switch"
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={hint ? hintId : undefined}
      onChange={(event) => onChange(event.target.checked)}
      className={SWITCH}
    />
  );
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-center gap-3 py-1 has-[:disabled]:cursor-default", className)}>
      {side === "start" && control}
      <span className={cn("min-w-0", side === "end" && "flex-1")}>
        <span className="block text-sm leading-6 font-medium text-ink">{label}</span>
        {hint && (
          <span id={hintId} className="block text-[13px] leading-5 text-ink-soft">
            {hint}
          </span>
        )}
      </span>
      {side === "end" && control}
    </label>
  );
}
