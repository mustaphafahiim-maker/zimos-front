import { useState } from "react";
import { Button } from "@store-builder/ui";
import { storeTransferOfferGet, storeTransferOfferWithdraw } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { IconClock } from "@/components/icons";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    sent: "Offer sent to {name} — the store moves when they accept",
    until: "The offer is open until {date}.",
    withdraw: "Withdraw offer",
    withdrawing: "Withdrawing…",
    withdrawn: "The offer was withdrawn.",
    someone: "the new owner",
    notConfirmed: "That person hasn't confirmed their email yet",
  },
  ar: {
    sent: "بعتنا عرض لـ {name} — المتجر هيتنقل لما يوافق",
    until: "العرض مفتوح لحد {date}.",
    withdraw: "إلغاء العرض",
    withdrawing: "بنلغي…",
    withdrawn: "العرض اتلغى.",
    someone: "المالك الجديد",
    notConfirmed: "الشخص ده لسه مأكدش إيميله",
  },
} satisfies Messages;

/** The transfer's own sentences, for the dialog that sends the offer. */
export function useOwnershipOfferTexts() {
  return useT(STRINGS);
}

/**
 * The transfer waiting for the new owner's yes (handoff 379): who it was sent
 * to, until when, and «إلغاء العرض». Nothing while there is no offer. `version`
 * changes when the dialog sends one, so the panel reads again.
 */
export function OwnershipOfferPanel({ version }: { version: number }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  // An offer that can't be read is not shown; the button under it still works.
  const offer = useAsync(() => storeTransferOfferGet(apiClient, workspaceId).catch(() => null), [workspaceId, version]);
  const [busy, setBusy] = useState(false);

  const current = offer.data;
  if (!current) return null;
  const name = current.toUser?.fullName?.trim() || current.toUser?.email || t.someone;

  async function withdraw() {
    setBusy(true);
    try {
      await storeTransferOfferWithdraw(apiClient, workspaceId);
      toast.success(t.withdrawn);
      offer.setData(null);
    } catch (err) {
      toast.error(errorMessage(err));
      void offer.refresh({ silent: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="status" className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius)] bg-paper-sunken px-3 py-3">
      <IconClock className="size-5 shrink-0 text-ink-soft" aria-hidden />
      <div className="min-w-0 flex-[1_1_12rem]">
        <p className="text-sm font-medium text-ink">{fmt(t.sent, { name })}</p>
        <p className="text-xs text-ink-soft">{fmt(t.until, { date: formatDate(current.expiresAt) })}</p>
      </div>
      <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => void withdraw()}>
        {busy ? t.withdrawing : t.withdraw}
      </Button>
    </div>
  );
}
