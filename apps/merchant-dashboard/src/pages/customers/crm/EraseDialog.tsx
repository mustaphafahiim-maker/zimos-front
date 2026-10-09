import { useState } from "react";
import { PRIVACY_NOTE_MAX, isApiErrorCode } from "@store-builder/api-client";
import { useErrorMessage } from "@/lib/errorMessages";
import { useCommon, useT } from "@/i18n/LocaleContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { PRIVACY_STRINGS } from "./privacyStrings";

/**
 * The confirmation before a customer is erased (handoff 235), shared by the
 * customer page's «امسح العميل» and the inbox's «نفّذ المسح»: what erasing
 * does and that it can't be undone, an optional note, and — once the API has
 * answered that orders are still on their way — the choice to erase anyway.
 */
export function EraseDialog({
  open,
  title,
  confirmLabel,
  onCancel,
  onErase,
  describeError,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  onCancel: () => void;
  /** Resolves once the customer is erased; the caller then closes the dialog. */
  onErase: (body: { force: boolean; note: string | null }) => Promise<void>;
  /** The caller's own wording for a refusal it knows, or null for the usual one. */
  describeError?: (err: unknown) => string | null;
}) {
  const t = useT(PRIVACY_STRINGS);
  const common = useCommon();
  const errorMessage = useErrorMessage();
  const [note, setNote] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [force, setForce] = useState(false);
  const [openedFor, setOpenedFor] = useState(false);
  // Each opening starts clean.
  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) {
      setNote("");
      setBlocked(false);
      setForce(false);
    }
  }

  async function confirm() {
    try {
      await onErase({ force: blocked && force, note: note.trim() || null });
    } catch (err) {
      if (isApiErrorCode(err, "CUSTOMER_HAS_OPEN_ORDERS")) {
        setBlocked(true);
        throw new Error(t.openOrders);
      }
      throw new Error(describeError?.(err) ?? errorMessage(err));
    }
  }

  return (
    <ConfirmDialog
      open={open}
      title={title}
      description={t.eraseBody}
      confirmLabel={confirmLabel}
      cancelLabel={common.cancel}
      busyLabel={t.erasing}
      destructive
      onCancel={onCancel}
      onConfirm={confirm}
    >
      <div className="space-y-3">
        {blocked && (
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-ink">
            <input type="checkbox" className="size-4 cursor-pointer accent-primary" checked={force} onChange={(e) => setForce(e.target.checked)} />
            {t.force}
          </label>
        )}
        <Field label={t.note} hint={t.noteHint}>
          {(props) => <Textarea {...props} dir="auto" rows={2} maxLength={PRIVACY_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      </div>
    </ConfirmDialog>
  );
}
