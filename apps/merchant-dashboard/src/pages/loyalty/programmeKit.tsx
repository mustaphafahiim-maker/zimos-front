import type { ReactNode } from "react";
import { Alert, Input, cn } from "@store-builder/ui";
import { SkeletonBar } from "@/components/DataState";
import type { IconComponent } from "@/components/icons";
import { ViewLink } from "@/components/ViewLink";

/**
 * What the four programme pages of Customers → Loyalty & rewards share (loyalty
 * points, VIP tiers, refer a friend, store credit): the controls a settings row
 * holds, the note that points at another setting, the sentence the customer
 * reads, and the placeholder of the page while it loads. Material for the
 * `data-slot`s here is in glass/sweep-loyalty.css.
 */

/** A short number: 44px tall, 16px digits under a finger (no zoom on focus), always left-to-right. */
const NUMBER_INPUT = "h-11 w-28 text-center text-base tabular-nums md:text-sm";
const INVALID = "border-danger focus-visible:ring-danger/30";

interface NumberControlProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
  /** `decimal` for a rate with a fraction; whole numbers otherwise. */
  inputMode?: "numeric" | "decimal";
  /** Said after the field: «٪», «يوم». */
  unit?: string;
  /** The unit is a sign («٪»), not a word: a screen reader has it from the label. */
  unitHidden?: boolean;
  className?: string;
}

/** A number typed as text (an Arabic keyboard types ٠–٩; the page reads both), with its unit after it. */
export function NumberControl({ id, value, onChange, invalid, disabled, maxLength, placeholder, inputMode = "numeric", unit, unitHidden, className }: NumberControlProps) {
  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        type="text"
        inputMode={inputMode}
        dir="ltr"
        autoComplete="off"
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        aria-invalid={invalid ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(NUMBER_INPUT, invalid && INVALID, className)}
      />
      {unit && (
        <span aria-hidden={unitHidden || undefined} className="shrink-0 text-sm text-ink-soft">
          {unit}
        </span>
      )}
    </div>
  );
}

interface MoneyControlProps {
  id: string;
  /** Major-unit text as typed; the page converts it on save. */
  value: string;
  onChange: (value: string) => void;
  currency: string;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

/** An amount of money in a settings row: the currency inside the field's start, the digits left-to-right. */
export function MoneyControl({ id, value, onChange, currency, invalid, disabled, placeholder = "0.00" }: MoneyControlProps) {
  return (
    <div className="relative w-40 max-w-full">
      <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-sm text-ink-soft">{currency}</span>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        dir="ltr"
        autoComplete="off"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={invalid ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-11 ps-12 text-base tabular-nums md:text-sm", invalid && INVALID)}
      />
    </div>
  );
}

/** Something another setting decides (customer accounts are off, the points programme is off), with the way there. */
export function ProgrammeNote({ children, to, action }: { children: ReactNode; to: string; action: string }) {
  return (
    <Alert>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="min-w-0 flex-1 basis-64">{children}</span>
        <ViewLink
          to={to}
          className="inline-flex min-h-11 items-center rounded-full font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {action}
        </ViewLink>
      </div>
    </Alert>
  );
}

/** The rules as the customer meets them, worked out on the numbers being typed. */
export function ProgrammeExample({ icon: ExampleIcon, label, children }: { icon?: IconComponent; label?: string; children: ReactNode }) {
  return (
    <div data-slot="programme-example" className="rounded-2xl bg-paper-sunken px-4 py-3">
      {label && (
        <p className="flex items-center gap-1.5 text-xs leading-5 font-medium text-ink-soft">
          {ExampleIcon && <ExampleIcon className="size-4 shrink-0" aria-hidden />}
          {label}
        </p>
      )}
      <p className={cn("text-sm leading-6 text-ink", label && "mt-0.5")}>{children}</p>
    </div>
  );
}

/**
 * After a save was refused by the form itself: the first row with a problem is
 * brought to the middle of the screen and its field takes the focus, so the
 * sentence under it is the next thing read.
 */
export function focusFirstInvalid(form: HTMLElement | null): void {
  // A row marks itself (`data-invalid`) and so does its field; a row whose control is not a field (a segmented choice) only the first.
  const found = form?.querySelector<HTMLElement>('[data-slot="settings-row"][data-invalid], [aria-invalid="true"]');
  if (!found) return;
  const field = found.matches('[data-slot="settings-row"]')
    ? (found.querySelector<HTMLElement>('input, select, textarea, [role="radio"][tabindex="0"], button') ?? found)
    : found;
  const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  field.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
  field.focus({ preventScroll: true });
}

/** One grey group of rows: the shape of a `SettingsGroup` before it arrives. */
function GroupBones({ rows }: { rows: number }) {
  return (
    <div className="rounded-[1.25rem] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex min-h-13 items-center justify-between gap-4 border-b border-line px-4 py-3 last:border-b-0">
          <div className="min-w-0 flex-1">
            <SkeletonBar className={index % 2 === 0 ? "h-3 w-2/5" : "h-3 w-1/3"} />
            <SkeletonBar className="mt-2 h-2.5 w-3/5" />
          </div>
          <SkeletonBar className="h-7 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** The page while its settings load: the switch, then the groups of rules. `tiles` holds room for stat cards. */
export function ProgrammeSkeleton({ tiles = 0, groups = [1, 2, 2] }: { tiles?: number; groups?: readonly number[] }) {
  return (
    <div className="max-w-3xl space-y-5">
      {tiles > 0 && (
        <div className="grid grid-cols-2 gap-[var(--bento-gap)] lg:grid-cols-3">
          {Array.from({ length: tiles }, (_, index) => (
            <div key={index} className="h-24 rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line">
              <SkeletonBar className="h-2.5 w-1/2" />
              <SkeletonBar className="mt-5 h-6 w-2/3" />
            </div>
          ))}
        </div>
      )}
      {groups.map((rows, index) => (
        <GroupBones key={index} rows={rows} />
      ))}
    </div>
  );
}

/**
 * A yes / no inside a form that is not a settings group (a tier's "free
 * shipping"): the whole line is the switch, 44px tall. The track and the thumb
 * are the ones of `SettingsSwitch`, so the glass layer draws them the same.
 */
export function InlineSwitch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group/switch flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-[0.875rem] text-start text-sm font-medium text-ink select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed"
    >
      <span className="min-w-0 group-disabled/switch:opacity-55">{label}</span>
      <span
        aria-hidden
        className={cn(
          "zimos-settings-switch-track relative h-7 w-12 shrink-0 overflow-hidden rounded-full transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] group-disabled/switch:opacity-55 motion-reduce:transition-none forced-colors:border forced-colors:border-[color:ButtonText]",
          checked ? "bg-primary forced-colors:bg-[color:Highlight]" : "bg-line-strong"
        )}
      >
        <span
          className={cn(
            "zimos-settings-switch-thumb absolute start-0.5 top-0.5 flex size-6 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform duration-[var(--dur-pop)] ease-[var(--ease-pop)] motion-reduce:transition-none forced-colors:bg-[color:ButtonText]",
            checked && "translate-x-5 rtl:-translate-x-5"
          )}
        />
      </span>
    </button>
  );
}
