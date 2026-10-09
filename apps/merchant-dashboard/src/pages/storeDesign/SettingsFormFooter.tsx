import { useEffect, useId } from "react";
import { Alert } from "@store-builder/ui";
import { IconLock } from "@/components/icons";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { SaveBar } from "@/components/SaveBar";
import { useUnsavedGuard } from "@/lib/useUnsavedGuard";

const STRINGS = {
  en: {
    save: "Save changes",
    saving: "Saving…",
    reset: "Discard changes",
    readOnlyTitle: "View only",
    readOnly: "Only the store owner, a workspace manager or an editor can change these settings.",
  },
  ar: {
    save: "احفظ التغييرات",
    saving: "بنحفظ…",
    reset: "سيبها زي ما كانت",
    readOnlyTitle: "للعرض بس",
    readOnly: "صاحب المتجر أو مدير مساحة العمل أو المحرر بس هم اللي يقدروا يغيّروا الإعدادات دي. اطلب من صاحب المتجر يديك الصلاحية.",
  },
} satisfies Messages;

/** The no-permission notice every store-settings section opens with: what it means and who can grant it. */
export function ReadOnlyNotice({ editable }: { editable: boolean }) {
  const t = useT(STRINGS);
  if (editable) return null;
  return (
    <Alert>
      <p className="flex items-center gap-1.5 font-medium">
        <IconLock className="size-4 shrink-0" aria-hidden />
        {t.readOnlyTitle}
      </p>
      <p>{t.readOnly}</p>
    </Alert>
  );
}

/**
 * The save of a store-settings section: nothing while the form is as saved;
 * once something changed, the shared SaveBar (Discard / Save) pinned in reach
 * for the length of the form, with a failed save said on it. No wrapper
 * element: the bar must be a child of the section's own column to stay
 * pinned. It also tells the page's unsaved guard about the draft, so a switch
 * of section asks first; outside a guard (a form on its own) that is a no-op.
 *
 * The bar is pinned over the page: leave room for it in the column (it is the
 * last child), so the last field is never under it.
 */
export function SettingsFormFooter({
  editable,
  dirty,
  saving,
  error,
  blocked,
  onSave,
  onReset,
}: {
  editable: boolean;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  /**
   * Why the draft cannot be saved as it stands (a field is not valid yet). The
   * bar stays up — the edits still count as unsaved and can be discarded — but
   * its save button waits, and the reason is said on it.
   */
  blocked?: string | null;
  onSave: () => void;
  onReset: () => void;
}) {
  const t = useT(STRINGS);
  const pinned = editable && (dirty || saving);
  const { setDirty } = useUnsavedGuard();
  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
  return (
    <>
      {error && !pinned && <Alert variant="danger">{error}</Alert>}
      {pinned && (
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={onSave}
          onDiscard={onReset}
          saveLabel={t.save}
          savingLabel={t.saving}
          discardLabel={t.reset}
          disabled={Boolean(blocked)}
          // A failed save is said here: the bar is what the merchant is looking at when it fails.
          message={
            (error ?? blocked) ? (
              <span role="alert" className="text-danger">
                {error ?? blocked}
              </span>
            ) : undefined
          }
        />
      )}
    </>
  );
}

/**
 * A switch with its label and hint, for a setting inside a folded part or a
 * plain card (inside a `SettingsGroup` use `SettingsSwitch`). The whole line
 * is the target (44px at least); underneath it is a checkbox with the switch
 * role, so Space toggles it and a form reads it as before.
 */
export function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const hintId = useId();
  return (
    <label
      className={`relative flex min-h-11 items-center justify-between gap-4 py-2 first:pt-0 last:pb-0 ${disabled ? "cursor-default" : "cursor-pointer"}`}
    >
      <span className={`min-w-0 ${disabled ? "opacity-55" : ""}`}>
        <span className="block text-sm leading-5 font-medium text-ink">{label}</span>
        {hint && (
          <span id={hintId} className="mt-0.5 block text-[13px] leading-5 text-ink-soft">
            {hint}
          </span>
        )}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-7 w-12 shrink-0 rounded-full bg-line-strong transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:opacity-55 after:absolute after:start-0.5 after:top-0.5 after:size-6 after:rounded-full after:bg-white after:shadow-[0_1px_3px_rgb(0_0_0/0.3)] after:transition-transform after:duration-[var(--dur-pop)] after:ease-[var(--ease-pop)] after:content-[''] peer-checked:after:translate-x-5 motion-reduce:transition-none motion-reduce:after:transition-none rtl:peer-checked:after:-translate-x-5"
      />
    </label>
  );
}
