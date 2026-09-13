import { useState, type ReactNode } from "react";
import { Button, Alert } from "@store-builder/ui";
import { Modal } from "./Modal";
import { getErrorMessage } from "@/lib/errors";
import { useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { cancel: "Cancel", confirm: "Confirm", working: "Working…" },
  ar: { cancel: "إلغاء", confirm: "تأكيد", working: "جارٍ التنفيذ…" },
};

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onCancel: () => void;
  /** Resolve to close. Throw to show the error inline and stay open. */
  onConfirm: () => Promise<unknown> | unknown;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
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
          <Button variant="outline" onClick={handleCancel} disabled={busy}>
            {t.cancel}
          </Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={handleConfirm} disabled={busy}>
            {busy ? t.working : (confirmLabel ?? t.confirm)}
          </Button>
        </>
      }
    >
      {error && (
        <Alert variant="danger" className="mb-3">
          {error}
        </Alert>
      )}
      {children}
    </Modal>
  );
}
