"use client";

import { useState, type ReactNode } from "react";
import { Button } from "./button";
import { Alert } from "./alert";
import { Modal } from "./modal";
import { defaultErrorMessage } from "./data-state";

export interface ConfirmDialogLabels {
  cancel: string;
  confirm: string;
  working: string;
  close: string;
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  /** Disable the confirm button (e.g. until a required reason is typed). */
  confirmDisabled?: boolean;
  onCancel: () => void;
  /** Resolve to close. Throw to show the error inline and stay open. */
  onConfirm: () => Promise<unknown> | unknown;
  children?: ReactNode;
  labels?: Partial<ConfirmDialogLabels>;
  /** Turns a thrown error into user-facing text. */
  getErrorMessage?: (err: unknown) => string;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  confirmDisabled = false,
  onCancel,
  onConfirm,
  children,
  labels,
  getErrorMessage = defaultErrorMessage,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const l = { cancel: "Cancel", confirm: "Confirm", working: "Working…", close: "Close", ...labels };

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
      closeLabel={l.close}
      footer={
        <>
          <Button variant="outline" onClick={handleCancel} disabled={busy}>
            {l.cancel}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={handleConfirm}
            disabled={busy || confirmDisabled}
          >
            {busy ? l.working : (confirmLabel ?? l.confirm)}
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
