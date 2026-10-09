import { Alert, buttonVariants, cn } from "@store-builder/ui";
import { paymentDisputesOfTimeline, type Payment, type PaymentTimeline, type Refund } from "@store-builder/api-client";
import { IconExternal } from "@/components/icons";
import { formatDate, formatMoney } from "@/lib/format";
import { providerName } from "@/lib/providers";
import { fmt, useT } from "@/i18n/LocaleContext";
import { DISPUTE_STRINGS, disputeRespondUrl, isOpenDispute } from "@/pages/payments/ledger/disputeText";

/**
 * The order's card disputes on its payment card (handoff 377): one banner per
 * dispute — open (with the deadline and the way to the gateway's dashboard,
 * where it is answered), won, an inquiry closed, or lost. Nothing for an
 * order with no dispute.
 */
export function PaymentDisputeBanners({ timeline }: { timeline: PaymentTimeline }) {
  const t = useT(DISPUTE_STRINGS);
  const disputes = paymentDisputesOfTimeline(timeline);
  if (disputes.length === 0) return null;
  return (
    <>
      {disputes.map((dispute) => {
        const amount = formatMoney(dispute.amount, dispute.currency || timeline.currency);
        const gateway = providerName(dispute.providerCode);
        if (isOpenDispute(dispute.status)) {
          const testMode = timeline.attempts.find((p) => p.id === dispute.paymentId)?.mode === "test";
          const url = disputeRespondUrl(dispute, testMode);
          return (
            <Alert key={dispute.id} variant="danger" data-dispute={dispute.status}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {dispute.evidenceDueBy
                    ? fmt(t.open, { amount, evidenceDueBy: formatDate(dispute.evidenceDueBy) })
                    : fmt(t.openNoDate, { amount })}
                </span>
                {url && (
                  <a href={url} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}>
                    {fmt(t.respond, { gateway })}
                    <IconExternal className="size-4 rtl:-scale-x-100" aria-hidden />
                  </a>
                )}
              </div>
            </Alert>
          );
        }
        if (dispute.status === "lost") {
          return (
            <Alert key={dispute.id} variant="danger" data-dispute={dispute.status}>
              {fmt(t.lost, { amount })}
            </Alert>
          );
        }
        return (
          <Alert key={dispute.id} variant="info" data-dispute={dispute.status}>
            {dispute.status === "won" ? t.won : t.closed}
          </Alert>
        );
      })}
    </>
  );
}

/**
 * Where a refund came from, for the two origins the dashboard did not make
 * itself: a lost dispute («رد بنكي») and one made in the gateway's dashboard.
 * Null for the rest — the caller keeps its own words.
 */
/** The two payment alerts a dispute raises: the banners above say them in full, so the alert list leaves them out. */
export function isDisputeAlert(alert: string, timeline: PaymentTimeline): boolean {
  return (alert === "payment_disputed" || alert === "chargeback_lost") && paymentDisputesOfTimeline(timeline).length > 0;
}

export function useRefundOrigin(): (refund: Refund, attempts: Payment[]) => string | null {
  const t = useT(DISPUTE_STRINGS);
  return (refund, attempts) => {
    const source = refund.source as string;
    if (source === "chargeback") return t.chargeback;
    if (source === "gateway") {
      const code = attempts.find((p) => p.id === refund.paymentId)?.providerCode;
      return code ? fmt(t.refundedInGateway, { gateway: providerName(code) }) : null;
    }
    return null;
  };
}
