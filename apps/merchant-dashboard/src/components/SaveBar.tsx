import type { ReactNode } from "react";
import { Button, cn } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { unsaved: "You have unsaved changes", save: "Save", saving: "Saving…", discard: "Discard" },
  ar: { unsaved: "لديك تغييرات لم تُحفظ بعد", save: "حفظ", saving: "جارٍ الحفظ…", discard: "تجاهل" },
};

interface SaveBarProps {
  /** The bar shows only while there is something to save, or a save is running. */
  dirty: boolean;
  saving?: boolean;
  /** Left out inside a `<form>`: the save button then submits it. */
  onSave?: () => void;
  /** Adds a second button that puts the saved values back. */
  onDiscard?: () => void;
  saveLabel?: string;
  savingLabel?: string;
  discardLabel?: string;
  /** Said instead of "You have unsaved changes" — the reason a save failed, say. */
  message?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * The save action of a long form, kept in reach: it appears once something
 * changed and stays pinned above the phone dock, clear of it (at the bottom edge
 * from md up) until the change is saved or discarded. So a merchant who edits the first
 * field of a three-screen form sees both that the edit is not saved yet and the
 * button that saves it, without scrolling to the end to find out.
 *
 * Put it last inside the form or card it saves: it sticks while that box is on
 * screen. It keeps a solid fill on purpose — the page scrolls beneath it.
 */
export function SaveBar({
  dirty,
  saving = false,
  onSave,
  onDiscard,
  saveLabel,
  savingLabel,
  discardLabel,
  message,
  disabled = false,
  className,
}: SaveBarProps) {
  const t = useT(STRINGS);
  if (!dirty && !saving) return null;
  return (
    <div
      role="region"
      aria-label={t.unsaved}
      className={cn(
        "sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] bg-paper-raised px-4 py-3 shadow-[var(--shadow-raised)] ring-1 ring-line md:bottom-4",
        className
      )}
    >
      <p className="min-w-0 text-sm font-medium text-ink">{message ?? t.unsaved}</p>
      <div className="flex shrink-0 gap-2">
        {onDiscard && (
          <Button type="button" variant="outline" className="min-h-11 md:min-h-0" disabled={saving} onClick={onDiscard}>
            {discardLabel ?? t.discard}
          </Button>
        )}
        <Button
          type={onSave ? "button" : "submit"}
          className="min-h-11 md:min-h-0"
          disabled={saving || disabled}
          onClick={onSave}
        >
          {saving ? (savingLabel ?? t.saving) : (saveLabel ?? t.save)}
        </Button>
      </div>
    </div>
  );
}
