import { useState, type ReactNode } from "react";
import { Button, Alert, cn } from "@store-builder/ui";
import { Modal } from "./Modal";
import { getErrorMessage } from "@/lib/errors";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { confirm: "Confirm", cancel: "Cancel", busy: "Working…" },
  ar: { confirm: "تأكيد", cancel: "إلغاء", busy: "ثانية واحدة…" },
} satisfies Messages;

interface ConfirmDialogProps {
  open: boolean;
  /** The question. For a destructive one, name the thing: «تمسح المنتج ده؟». */
  title: string;
  /** What happens next. For a destructive one, say what will be lost and whether it can come back. */
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Shown on the confirm button while `onConfirm` runs. */
  busyLabel?: string;
  destructive?: boolean;
  onCancel: () => void;
  /** Resolve to close. Throw to show the error inline and stay open. */
  onConfirm: () => Promise<unknown> | unknown;
  children?: ReactNode;
}

/** Both actions are pills; the footer of the sheet gives them their height (44px rows on the phone). */
const ACTION = "rounded-full px-5";
/** The destructive one is the full danger fill, not a tint: it is the thing being asked about. */
const DANGER_FILL =
  "bg-danger text-paper-raised hover:bg-danger/90 focus-visible:ring-danger/30 dark:bg-danger dark:hover:bg-danger/90";

/**
 * Asks once before something that cannot be taken back with Undo
 * (docs/ux/REDESIGN_PROMPT.md §6): a destructive confirmation names what will
 * be lost in its title and description, and its confirm button says the verb
 * («امسح», not «تأكيد»). It is a `Modal`, so on a phone it is a bottom sheet
 * with the two actions stacked full width — the confirm on top — and from
 * `sm` up a small centred dialog with them at the end.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  busyLabel,
  destructive = false,
  onCancel,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const t = useT(STRINGS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
      return;
    }
    setBusy(false);
  }

  function handleCancel() {
    if (busy) return;
    setError(null);
    onCancel();
  }

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" className={ACTION} onClick={handleCancel} disabled={busy}>
            {cancelLabel ?? t.cancel}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            data-fill={destructive ? "danger" : undefined}
            className={cn(ACTION, destructive && DANGER_FILL)}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? (busyLabel ?? t.busy) : (confirmLabel ?? t.confirm)}
          </Button>
        </>
      }
    >
      {error && (
        <Alert variant="danger" className="mb-3 last:mb-0">
          {error}
        </Alert>
      )}
      {children}
    </Modal>
  );
}
