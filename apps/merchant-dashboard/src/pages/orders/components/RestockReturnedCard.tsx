import { useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import { ApiError, restockReturnPreview, restockReturnRun, type Order, type RestockReturnUnit } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Section } from "@/components/Section";
import { useToast } from "@/components/Toast";
import { revealOrderSection } from "./courierBookingLock";

/** System roles holding orders.manage: putting units back needs it. */
const MANAGE_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager", "order_operator"]);

const STRINGS = {
  en: {
    title: "Parcel back? Put the items back in stock",
    description: "This order came back undelivered. Its units stay held until you say the parcel is on your shelf.",
    button: "Back in stock",
    working: "Putting back…",
    confirmTitle: "Put these units back in stock?",
    confirmBody: "These units go back to the stock available to sell. Is the parcel with you?",
    done: "Items are back in stock",
    restockedOn: "Restocked on {date}",
    wasDelivered: "This parcel was delivered before it came back. Open a return and restock it from there",
    openReturns: "Go to the returns section",
    sku: "SKU {sku}",
    times: "× {n}",
    viewOnly: "Your role can't put units back in stock.",
  },
  ar: {
    title: "الشحنة رجعت؟ رجّع المنتجات للمخزون",
    description: "الطلب ده رجع من غير ما يتسلّم. القطع بتاعته محجوزة لحد ما تقول إن الشحنة وصلتك.",
    button: "رجّع للمخزون",
    working: "بنرجّع…",
    confirmTitle: "ترجّع القطع دي للمخزون؟",
    confirmBody: "هترجع الكميات دي للمخزون المتاح للبيع. متأكد إن الشحنة وصلتك؟",
    done: "رجعت المنتجات للمخزون",
    restockedOn: "اترجعت للمخزون في {date}",
    wasDelivered: "الشحنة اتسلمت قبل ما ترجع، افتح مرتجع ورجّعه للمخزون من هناك",
    openReturns: "روح لقسم المرتجعات",
    sku: "SKU {sku}",
    times: "× {n}",
    viewOnly: "دورك مش مسموح له يرجّع القطع للمخزون.",
  },
} satisfies Messages;

function unitOptions(unit: RestockReturnUnit): string {
  return unit.optionValues ? Object.values(unit.optionValues).filter(Boolean).join(" · ") : "";
}

/**
 * Order page, stage "returned" (handoff 354): a parcel that came back
 * undelivered keeps its units held. This card lists them and gives them back
 * to the sellable stock once the parcel is on the shelf; afterwards it says
 * when that was done. A parcel that was delivered first goes through a return
 * instead, and the card says so.
 */
export function RestockReturnedCard({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace } = useWorkspace();
  const canManage = MANAGE_ROLES.has(currentWorkspace?.role ?? "");
  const returned = order.stage === "returned";
  const [asking, setAsking] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const preview = useAsync(
    () => (returned ? restockReturnPreview(apiClient, workspaceId, order.id) : Promise.resolve(null)),
    [workspaceId, order.id, returned, order.updatedAt]
  );
  const data = preview.data;

  if (!returned || !data) {
    // A failed read on a returned order is worth saying; anything else draws nothing.
    if (returned && preview.error && !(preview.error instanceof ApiError && [403, 404].includes(preview.error.status))) {
      return <Alert variant="danger">{errorMessage(preview.error)}</Alert>;
    }
    return null;
  }

  const wasDelivered = !data.canRestock && data.reason === "was_delivered";
  if (!data.canRestock && !data.restockedAt && !wasDelivered) return null;

  async function restock() {
    try {
      const result = await restockReturnRun(apiClient, workspaceId, order.id);
      preview.setData({ canRestock: false, reason: "nothing_held", units: [], restockedAt: result.restockedAt });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        setAsking(false);
        toast.error(errorMessage(err));
        return;
      }
      // Restocked meanwhile, or booked again: show where it stands now.
      void preview.refresh({ silent: true });
      throw new Error(errorMessage(err));
    }
    setAsking(false);
    toast.success(t.done);
    onChanged();
  }

  return (
    <Section title={t.title} description={data.canRestock ? t.description : undefined} className="zimos-restock-returned">
      {data.canRestock ? (
        <div className="space-y-3">
          <ul className="divide-y divide-line rounded-[0.75rem] border border-line">
            {data.units.map((unit) => {
              const options = unitOptions(unit);
              return (
                <li key={unit.variantId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      <bdi>{unit.productName}</bdi>
                    </p>
                    <p className="flex flex-wrap gap-x-2 text-xs text-ink-soft">
                      {options && <bdi>{options}</bdi>}
                      {unit.sku && <bdi dir="ltr">{fmt(t.sku, { sku: unit.sku })}</bdi>}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">{fmt(t.times, { n: unit.quantity })}</span>
                </li>
              );
            })}
          </ul>
          {canManage && !forbidden ? (
            <div className="flex justify-end">
              <Button type="button" className="min-h-11" onClick={() => setAsking(true)}>
                {t.button}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">{t.viewOnly}</p>
          )}
        </div>
      ) : wasDelivered ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 flex-1 text-sm text-ink">{t.wasDelivered}</p>
          <button
            type="button"
            onClick={() => revealOrderSection("order-returns")}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-2 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {t.openReturns}
          </button>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">{fmt(t.restockedOn, { date: formatDateTime(data.restockedAt) })}</p>
      )}

      <ConfirmDialog
        open={asking}
        title={t.confirmTitle}
        description={t.confirmBody}
        confirmLabel={t.button}
        cancelLabel={common.cancel}
        busyLabel={t.working}
        onCancel={() => setAsking(false)}
        onConfirm={restock}
      />
    </Section>
  );
}
