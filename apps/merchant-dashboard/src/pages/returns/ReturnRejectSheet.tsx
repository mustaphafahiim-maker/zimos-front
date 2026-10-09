import { useEffect, useState } from "react";
import { Alert, Button, cn } from "@store-builder/ui";
import type { ReturnRequest } from "@store-builder/api-client";
import { returnSourceOf } from "@store-builder/api-client";
import { Sheet } from "@/components/Sheet";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { getErrorMessage } from "@/lib/errors";
import { splitReason, useReturnLabels } from "./returnLabels";

const STRINGS = {
  en: {
    title: "Reject this return?",
    reasonCustomer: "The customer's reason",
    reasonStore: "The reason on the return",
    final: "A rejection is final: this return can't be approved afterwards, and its pieces don't go back into stock.",
    keep: "Keep it waiting",
    confirm: "Reject the return",
    working: "Rejecting…",
  },
  ar: {
    title: "ترفض المرتجع ده؟",
    reasonCustomer: "سبب العميل",
    reasonStore: "السبب المكتوب على المرتجع",
    final: "الرفض نهائي: المرتجع ده مش هيتقبل بعد كده، وقطعه مش هترجع المخزون.",
    keep: "سيبه مستني",
    confirm: "ارفض المرتجع",
    working: "بنرفض…",
  },
} satisfies Messages;

/** The destructive one is the full danger fill, as in ConfirmDialog: it is the thing being asked about. */
const DANGER_FILL = "bg-danger text-paper-raised hover:bg-danger/90 focus-visible:ring-danger/30 dark:bg-danger dark:hover:bg-danger/90";

interface ReturnRejectSheetProps {
  /** The return being rejected. It stays here while the sheet closes, so the sheet does not empty on its way out. */
  ret: ReturnRequest | null;
  open: boolean;
  /** Who and which order, under the title: «أحمد علي · #1024». */
  who?: string;
  onClose: () => void;
  /** Sends the rejection. Resolve to close; throw to stay open with the message. */
  onConfirm: () => Promise<void>;
}

/**
 * Rejecting cannot be taken back, so it asks once — in a small sheet that puts
 * the reason the return was opened for in front of the merchant before they
 * say no to it. Nothing is typed here: PATCH /returns/:id takes the decision
 * and nothing else, so a field for the merchant's own reason would be a
 * promise the server does not keep.
 */
export function ReturnRejectSheet({ ret, open, who, onClose, onConfirm }: ReturnRejectSheetProps) {
  const t = useT(STRINGS);
  const labels = useReturnLabels();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open, ret?.id]);

  if (!ret) return null;
  const { code, detail } = splitReason(ret.reason);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
      title={t.title}
      description={who}
      size="sm"
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy} onClick={onClose}>
            {t.keep}
          </Button>
          <Button
            type="button"
            variant="danger"
            data-fill="danger"
            className={cn("rounded-full px-5", DANGER_FILL)}
            disabled={busy}
            onClick={() => void confirm()}
          >
            {busy ? t.working : t.confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Alert variant="danger">{error}</Alert>}
        <div data-slot="return-note" className="rounded-2xl bg-paper-sunken px-4 py-3">
          <p className="text-xs leading-4 font-medium text-ink-soft">
            {returnSourceOf(ret) === "shopper" ? t.reasonCustomer : t.reasonStore}
          </p>
          <p className="mt-1 text-[15px] leading-6 font-semibold text-ink">{labels.reason(code)}</p>
          {detail && (
            <p dir="auto" className="mt-1 text-sm leading-6 wrap-anywhere text-ink">
              {detail}
            </p>
          )}
        </div>
        <p className="text-sm leading-6 text-ink-soft">{t.final}</p>
      </div>
    </Sheet>
  );
}
