import { useState, type ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { IconLock } from "@/components/icons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SkeletonBar, StateMessage } from "@/components/DataState";
import { useT, type Messages } from "@/i18n/LocaleContext";

/**
 * The small pieces every Payments section shares: the pane's skeleton, the
 * "not for your role" pane, a row that is pressed as a whole inside a
 * `SettingsGroup`, a switch small enough to sit in a row beside other
 * controls, and the question a sheet asks before it drops what was typed.
 */

const STRINGS = {
  en: {
    loading: "Loading…",
    noAccessTitle: "This part isn't in your role",
    noAccess: "Only the store owner or a workspace manager can open it. Ask the owner to change your role from Settings → Team.",
    discardTitle: "Discard what you typed?",
    discardBody: "It isn't saved yet. Leave and lose it, or keep editing and save.",
    discardLeave: "Discard",
    discardStay: "Keep editing",
  },
  ar: {
    loading: "بيحمّل…",
    noAccessTitle: "الجزء ده مش ضمن صلاحياتك",
    noAccess: "صاحب المتجر أو مدير مساحة العمل بس اللي يقدر يفتحه. اطلب من صاحب المتجر يغيّر دورك من الإعدادات ← الفريق.",
    discardTitle: "تسيب اللي كتبته؟",
    discardBody: "لسه ما اتحفظش. تسيبه ويضيع، ولا تكمّل وتحفظ؟",
    discardLeave: "سيبه",
    discardStay: "كمّل تعديل",
  },
} satisfies Messages;

/** Fields in a pane and in a sheet: 44px under a thumb, 16px text on a phone so iOS does not zoom. */
export const FIELD = "h-11 text-base md:text-sm";

/**
 * A row of a `SettingsGroup` that is not one of the kit's three: the same
 * floor, padding, corners and inset hairline, so it sits among them.
 */
export const GROUP_ROW =
  "relative flex min-h-13 w-full items-center gap-3 px-4 py-3 first:rounded-t-[1.25rem] last:rounded-b-[1.25rem] " +
  "before:pointer-events-none before:absolute before:start-4 before:end-0 before:top-0 before:h-px before:bg-line before:content-[''] first:before:hidden";

/** Added to `GROUP_ROW` when the whole row is pressed. */
export const GROUP_ROW_PRESS =
  "cursor-pointer text-start transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-ink/4 active:bg-ink/8 " +
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none";

/** A group of rows while it loads: the card and its rows, as tall as the real ones. */
export function PaneSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  const t = useT(STRINGS);
  const lines = Array.from({ length: Math.max(1, rows) }, (_, index) => index);
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={cn("min-w-0", className)}>
      <span className="sr-only">{t.loading}</span>
      <div
        aria-hidden
        data-slot="card"
        className="flex flex-col rounded-[1.25rem] bg-card shadow-[var(--shadow-card)] ring-1 ring-line [--radius-card:1.25rem]"
      >
        {lines.map((index) => (
          <div key={index} className={GROUP_ROW}>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <SkeletonBar className={cn("h-3.5", index % 2 === 0 ? "w-2/5" : "w-1/2")} />
              <SkeletonBar className={cn("h-3", index % 2 === 0 ? "w-3/5" : "w-1/3")} />
            </div>
            <SkeletonBar className="h-7 w-12 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** What a section shows to a role that may not read it: who can open it for them. */
export function NoAccess({ className }: { className?: string }) {
  const t = useT(STRINGS);
  return (
    <StateMessage
      role="status"
      icon={<IconLock aria-hidden />}
      title={t.noAccessTitle}
      description={t.noAccess}
      className={className}
    />
  );
}

/**
 * A switch that sits inside a row beside other controls (the kit's
 * `SettingsSwitch` is a whole row). Same track and thumb, so the glass layer
 * dresses both; the button around it is 44px for a thumb.
 */
export function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled = false,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Read by screen readers: what the switch turns on. */
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
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "group/toggle flex h-11 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "zimos-settings-switch-track relative h-7 w-12 shrink-0 overflow-hidden rounded-full transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] group-disabled/toggle:opacity-55 motion-reduce:transition-none forced-colors:border forced-colors:border-[color:ButtonText]",
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

/**
 * A sheet that holds a form asks once before it drops what was typed.
 * `requestClose` is what the sheet's `onOpenChange(false)` and its Cancel
 * button call; `dialog` goes inside the sheet's children, so the question is
 * nested in it and the sheet stays underneath.
 */
export function useDiscardGuard(dirty: boolean, close: () => void): { requestClose: () => void; dialog: ReactNode } {
  const t = useT(STRINGS);
  const [asking, setAsking] = useState(false);
  const requestClose = () => {
    if (dirty) setAsking(true);
    else close();
  };
  const dialog = (
    <ConfirmDialog
      open={asking}
      title={t.discardTitle}
      description={t.discardBody}
      confirmLabel={t.discardLeave}
      cancelLabel={t.discardStay}
      destructive
      onCancel={() => setAsking(false)}
      onConfirm={() => {
        setAsking(false);
        close();
      }}
    />
  );
  return { requestClose, dialog };
}
