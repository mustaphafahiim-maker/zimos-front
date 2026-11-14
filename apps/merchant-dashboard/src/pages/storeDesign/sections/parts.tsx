import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Input, cn } from "@store-builder/ui";
import { SettingsRow } from "@/components/settings";
import { DataState, SkeletonBar } from "@/components/DataState";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";

/** The column every store-settings section lays its cards in: the page gap between them. */
export const STACK = "flex min-w-0 flex-col gap-[var(--bento-gap)]";

/** A field under a finger: 44px tall, 16px text on a phone so the page does not zoom. */
export const FIELD = "min-h-11 text-base sm:text-sm";

interface RowBase {
  label: string;
  hint?: string;
  error?: string;
  /** Put the control under the label at full width. */
  stacked?: boolean;
  rowClassName?: string;
}

/** A `SettingsRow` whose control is a text field, wired to the row's label. */
export function InputRow({
  label,
  hint,
  error,
  stacked,
  rowClassName,
  className,
  after,
  ...input
}: RowBase & Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & { after?: ReactNode }) {
  const id = useId();
  const field = (
    <Input
      id={id}
      aria-invalid={error ? true : undefined}
      {...input}
      className={cn(FIELD, error && "border-danger focus-visible:ring-danger/30", className)}
    />
  );
  return (
    <SettingsRow
      label={label}
      hint={hint}
      error={error}
      htmlFor={id}
      stacked={stacked}
      className={rowClassName}
      control={
        after ? (
          <div className="flex w-full items-center gap-2">
            {field}
            {after}
          </div>
        ) : (
          field
        )
      }
    />
  );
}

/** A `SettingsRow` whose control is a text area: always under its label. */
export function TextareaRow({
  label,
  hint,
  error,
  rowClassName,
  className,
  ...area
}: Omit<RowBase, "stacked"> & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id">) {
  const id = useId();
  return (
    <SettingsRow
      label={label}
      hint={hint}
      error={error}
      htmlFor={id}
      stacked
      className={rowClassName}
      control={<Textarea id={id} aria-invalid={error ? true : undefined} {...area} className={cn("text-base sm:text-sm", className)} />}
    />
  );
}

/** A `SettingsRow` whose control is a native select. */
export function SelectRow({
  label,
  hint,
  error,
  stacked,
  rowClassName,
  className,
  children,
  ...select
}: RowBase & Omit<SelectHTMLAttributes<HTMLSelectElement>, "id">) {
  const id = useId();
  return (
    <SettingsRow
      label={label}
      hint={hint}
      error={error}
      htmlFor={id}
      stacked={stacked}
      className={rowClassName}
      control={
        // The width sits on a wrapper: the select itself always fills what it is given.
        <div className={stacked ? "w-full" : "w-56 max-w-full"}>
          <Select id={id} {...select} className={cn(FIELD, className)}>
            {children}
          </Select>
        </div>
      }
    />
  );
}

/** Anything else inside a group's card (a preview, a note, a grid of choices), padded like a row with the hairline over it. */
export function GroupBlock({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative px-4 py-3 before:pointer-events-none before:absolute before:start-4 before:end-0 before:top-0 before:h-px before:bg-line before:content-[''] first:before:hidden",
        className
      )}
    >
      {children}
    </div>
  );
}

/** The pane while a section loads: cards of rows, the shape the settings arrive in. */
export function SettingsSkeleton({ groups = 2, rows = 3 }: { groups?: number; rows?: number }) {
  return (
    <div className={STACK}>
      {Array.from({ length: groups }, (_, g) => (
        <div key={g} className="rounded-[1.25rem] bg-card shadow-[var(--shadow-card)] ring-1 ring-line">
          {Array.from({ length: g === 0 ? rows : Math.max(2, rows - 1) }, (_, r) => (
            <div key={r} className="flex min-h-13 items-center justify-between gap-4 border-t border-line px-4 py-3 first:border-t-0">
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonBar className="w-40 max-w-[60%]" />
                <SkeletonBar className="h-2.5 w-64 max-w-[85%]" />
              </div>
              <SkeletonBar className="h-7 w-12 rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Loading, could-not-load and not-allowed for one part of a section that reads
 * its own data: the part's name stays over the state, so a lock says what is
 * locked. Once the data is there the children draw themselves (their own
 * `SettingsGroup` carries the same title).
 */
export function GroupState({
  title,
  loading,
  error,
  onRetry,
  rows = 2,
  children,
}: {
  title?: string;
  loading: boolean;
  error: unknown;
  onRetry?: () => void;
  rows?: number;
  children: ReactNode;
}) {
  if (!loading && !error) return <>{children}</>;
  return (
    <div className="min-w-0">
      {title && <h3 className="mb-2 px-4 text-[13px] leading-5 font-semibold text-ink-soft">{title}</h3>}
      <DataState loading={loading} error={error} onRetry={onRetry} skeleton={<SettingsSkeleton groups={1} rows={rows} />}>
        {null}
      </DataState>
    </div>
  );
}

/** On a wrapper around plain `Field`s (inside a folded part): their controls get the 44px height and 16px phone text. */
export const TOUCH_FIELDS =
  "[&_input]:min-h-11 [&_input]:text-base sm:[&_input]:text-sm [&_select]:min-h-11 [&_select]:text-base sm:[&_select]:text-sm [&_textarea]:text-base sm:[&_textarea]:text-sm";
