import { Link } from "react-router-dom";
import { Button, cn } from "@store-builder/ui";
import { rfmCustomerGet } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";
import { CustomerCard, type CustomerCardFrame } from "../detail/CardFrame";
import { StatusBadge } from "@/components/StatusBadge";
import { RFM_STRINGS, RFM_TONE, rfmLabelHelp, rfmLabelName } from "./rfmStrings";

const STEPS = [1, 2, 3, 4, 5] as const;

/**
 * The customer page's group card: the RFM group as a badge,
 * what it means, and the three scores out of 5. A customer with no delivered
 * order has no group, and no card.
 *
 * `frame` lets the customer page draw the card as one of its folding sections
 * (the group's name and what it means as the folded line); left out, it is the
 * `Section` it always was.
 */
export function CustomerRfmCard({ customerId, frame }: { customerId: string; frame?: CustomerCardFrame }) {
  const t = useT(RFM_STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const rfm = useAsync(() => rfmCustomerGet(apiClient, workspaceId, customerId), [workspaceId, customerId]);

  if (rfm.error && !isPermissionError(rfm.error)) {
    return (
      <CustomerCard frame={frame} title={t.cardTitle}>
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-danger">{errorMessage(rfm.error)}</p>
          <Button variant="outline" size="sm" className="min-h-11 md:min-h-8" onClick={() => void rfm.refresh()}>
            {common.retry}
          </Button>
        </div>
      </CustomerCard>
    );
  }
  // Still loading, no role for it, or no delivered order yet: the page's other cards stand, this one stays out.
  if (!rfm.data) return null;

  const { label, scores } = rfm.data;
  const meters: [string, string, number][] = [
    ["R", t.recency, scores.r],
    ["F", t.frequency, scores.f],
    ["M", t.money, scores.m],
  ];

  const chip = <StatusBadge value={label} tone={RFM_TONE[label]} text={rfmLabelName(t, label)} className="text-sm" />;

  return (
    <CustomerCard
      frame={frame}
      title={t.cardTitle}
      description={rfmLabelHelp(t, label)}
      // Folded, the group's chip closes the row; it is not said twice once the section is open.
      actions={frame ? undefined : chip}
      badge={chip}
      summary={rfmLabelHelp(t, label)}
    >
      <dl className="grid grid-cols-3 gap-3">
        {meters.map(([letter, name, score]) => (
          <div key={letter} className="min-w-0">
            <dt className="text-xs text-ink-soft">
              {name} <span dir="ltr">({letter})</span>
            </dt>
            <dd className="mt-1">
              <span className="text-sm font-semibold tabular-nums text-ink">{fmt(t.scoreOf, { n: score })}</span>
              {/* The same score as five steps; the number beside it is what is read out. */}
              <span aria-hidden className="mt-1.5 flex gap-0.5">
                {STEPS.map((step) => (
                  <span key={step} className={cn("h-1.5 flex-1 rounded-full", step <= score ? "bg-primary" : "bg-paper-sunken")} />
                ))}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <Link to={`/customers?group=${label}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline md:min-h-0">
        {t.seeGroup}
      </Link>
    </CustomerCard>
  );
}
