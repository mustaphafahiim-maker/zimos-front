import { useState, type ReactNode } from "react";
import type { Customer } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    blacklistConfirmTitle: "Block this customer?",
    blacklistConfirmDescription: "Blocking stops this customer from checking out, until you remove the block.",
    blacklistConfirm: "Block",
    working: "Working…",
    reason: "Reason",
    reasonPlaceholder: "Repeated failed deliveries",
    reasonRequired: "Enter a reason for blocking this customer.",
    customerBlacklisted: "Customer blocked.",
    unblacklistTitle: "Remove the block?",
    unblacklistDescription: "The customer will be able to place orders again.",
    remove: "Remove the block",
    customerUnblacklisted: "The block was removed.",
  },
  ar: {
    blacklistConfirmTitle: "تحظر العميل ده؟",
    blacklistConfirmDescription: "الحظر بيمنع العميل ده إنه يكمّل أي أوردر، لحد ما تشيل الحظر.",
    blacklistConfirm: "احظره",
    working: "بننفّذ…",
    reason: "السبب",
    reasonPlaceholder: "التوصيل فشل أكتر من مرة",
    reasonRequired: "اكتب سبب حظر العميل ده.",
    customerBlacklisted: "العميل اتحظر.",
    unblacklistTitle: "تشيل الحظر عن العميل؟",
    unblacklistDescription: "العميل هيقدر يعمل أوردرات تاني.",
    remove: "شيل الحظر",
    customerUnblacklisted: "الحظر اتشال.",
  },
} satisfies Messages;

export interface CustomerBlacklist {
  /** Asks for the reason, then blocks. */
  askBlock: () => void;
  /** Asks once, then removes the block. */
  askUnblock: () => void;
  /** The two confirmations, mounted once by the page. */
  dialogs: ReactNode;
}

/**
 * Blocking a customer and taking the block off — the page's old «الحظر» card,
 * as two confirmations the header's «…» menu and the hero open. What is sent
 * is what the card sent: `{ isBlacklisted: true, reason }` with the reason
 * required, or `{ isBlacklisted: false }`.
 */
export function useCustomerBlacklist(customer: Customer, onChanged: () => void): CustomerBlacklist {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [blacklisting, setBlacklisting] = useState(false);
  const [unblacklisting, setUnblacklisting] = useState(false);
  const [reason, setReason] = useState("");

  async function confirmBlacklist() {
    if (reason.trim() === "") throw new Error(t.reasonRequired);
    await apiClient.setCustomerBlacklist(workspaceId, customer.id, {
      isBlacklisted: true,
      reason: reason.trim(),
    });
    toast.success(t.customerBlacklisted);
    setBlacklisting(false);
    setReason("");
    onChanged();
  }

  async function confirmRemove() {
    await apiClient.setCustomerBlacklist(workspaceId, customer.id, { isBlacklisted: false });
    toast.success(t.customerUnblacklisted);
    setUnblacklisting(false);
    onChanged();
  }

  return {
    askBlock: () => {
      setReason("");
      setBlacklisting(true);
    },
    askUnblock: () => setUnblacklisting(true),
    dialogs: (
      <>
        <ConfirmDialog
          open={blacklisting}
          title={t.blacklistConfirmTitle}
          description={t.blacklistConfirmDescription}
          confirmLabel={t.blacklistConfirm}
          cancelLabel={common.cancel}
          busyLabel={t.working}
          destructive
          onCancel={() => setBlacklisting(false)}
          onConfirm={confirmBlacklist}
        >
          <Field label={t.reason} required>
            {({ id }) => (
              <Textarea id={id} dir="auto" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.reasonPlaceholder} />
            )}
          </Field>
        </ConfirmDialog>

        <ConfirmDialog
          open={unblacklisting}
          title={t.unblacklistTitle}
          description={t.unblacklistDescription}
          confirmLabel={t.remove}
          cancelLabel={common.cancel}
          busyLabel={t.working}
          onCancel={() => setUnblacklisting(false)}
          onConfirm={confirmRemove}
        />
      </>
    ),
  };
}
