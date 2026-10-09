import { useEffect, useState, type ReactNode } from "react";
import { IconCaretLeft, IconCaretRight } from "@/components/icons";
import { cn } from "@store-builder/ui";
import {
  orderListExtrasOf,
  ordersInvoicePdf,
  ordersMeta,
  ordersNeighbors,
  ordersUpdateMeta,
  type Order,
  type OrderNeighbors,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ViewLink } from "@/components/ViewLink";
import { useOrderErrorMessage } from "../orderErrors";
import { lastOrdersListQuery } from "../orderListQuery";

const STRINGS = {
  en: {
    previous: "Previous order",
    next: "Next order",
    neighbors: "Move between orders",
    invoiceNone: "This order has no invoice yet: it is issued once the order is paid or placed as cash on delivery.",
    archiveTitle: "Archive this order?",
    archiveDescription:
      "The order leaves the orders list and its counts. Nothing is deleted: you can find it under “Archived” and restore it.",
    archiveConfirm: "Archive order",
    keep: "Keep it",
    working: "Working…",
    archived: "Order archived.",
    unarchived: "Order restored.",
    testOn: "Marked as a test order. It no longer counts as a sale.",
    testOff: "No longer a test order.",
    linkCopied: "The customer's tracking link is copied.",
    linkCopyFailed: "We couldn't copy the link. Copy it from here: {link}",
    badgeTest: "Test order",
    badgeArchived: "Archived",
    source: "Source",
    source_store: "Store",
    source_funnel: "Funnel",
    source_manual: "Manual",
    source_api: "API",
    source_import: "Import",
    source_upsell: "Upsell",
  },
  ar: {
    previous: "الأوردر اللي قبله",
    next: "الأوردر اللي بعده",
    neighbors: "اتنقّل بين الأوردرات",
    invoiceNone: "الأوردر ده لسه مالوش فاتورة: بتطلع لما يتدفع أو لما يتطلب بالدفع عند الاستلام.",
    archiveTitle: "تأرشف الأوردر ده؟",
    archiveDescription: "الأوردر هيختفي من قايمة الأوردرات وأعدادها. مفيش حاجة بتتمسح: هتلاقيه تحت «المؤرشفة» وتقدر ترجّعه.",
    archiveConfirm: "أرشف الأوردر",
    keep: "سيبه",
    working: "ثانية واحدة…",
    archived: "الأوردر اتأرشف.",
    unarchived: "الأوردر رجع من الأرشيف.",
    testOn: "اتعلّم كأوردر تجريبي ومش هيتحسب في المبيعات.",
    testOff: "مبقاش أوردر تجريبي.",
    linkCopied: "لينك التتبع بتاع العميل اتنسخ.",
    linkCopyFailed: "معرفناش ننسخ اللينك. انسخه من هنا: {link}",
    badgeTest: "أوردر تجريبي",
    badgeArchived: "مؤرشف",
    source: "المصدر",
    source_store: "المتجر",
    source_funnel: "مسار بيع",
    source_manual: "يدوي",
    source_api: "API",
    source_import: "استيراد",
    source_upsell: "عرض إضافي",
  },
} satisfies Messages;

/** Opening an order marks it seen, once. Failures are silent: it is bookkeeping. */
export function useMarkSeen(order: Order | null, onMarked: () => void) {
  const workspaceId = useWorkspaceId();
  const id = order?.id;
  const unseen = order ? !ordersMeta(order).isSeen : false;
  useEffect(() => {
    if (!id || !unseen) return;
    ordersUpdateMeta(apiClient, workspaceId, id, { isSeen: true }).then(onMarked, () => undefined);
    // Once per order opened; `onMarked` is not part of the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, id, unseen]);
}

/** Source, test and archived badges, among the hero's state chips. */
export function OrderMetaBadges({ order }: { order: Order }) {
  const t = useT(STRINGS);
  const meta = ordersMeta(order);
  // SPEC §4.3/§4.4: a funnel order names its funnel.
  const funnelName = orderListExtrasOf(order).funnelName;
  const sourceText = meta.source === "funnel" && funnelName ? `${t.source_funnel}: ${funnelName}` : t[`source_${meta.source}`];
  return (
    <>
      <StatusBadge label={t.source} value={meta.source} tone="neutral" text={sourceText} />
      {meta.isTest && <StatusBadge value="test" tone="warning" text={t.badgeTest} />}
      {meta.archivedAt && <StatusBadge value="archived" tone="neutral" text={t.badgeArchived} />}
    </>
  );
}

// A round 44px control (40px under a mouse). Its material — the small glass pane — is in glass/order-page.css.
const ARROW =
  "zimos-order-tool inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-paper-raised text-ink-soft ring-1 ring-line transition-[color,background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] pointer-fine:size-10 motion-reduce:transition-none";
const ARROW_LIVE =
  "hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:active:scale-[0.97]";

/**
 * The orders before and after this one, following the list the merchant came
 * from (its last query is remembered for the tab). Asked for with the id from
 * the route, so it runs beside the order's own request, once per order. Null
 * while the answer for this order is on its way: the last order's neighbours
 * are never offered as this one's.
 */
export function useOrderNeighbors(orderId: string): OrderNeighbors | null {
  const workspaceId = useWorkspaceId();
  const neighbors = useAsync(
    () => ordersNeighbors(apiClient, workspaceId, orderId, lastOrdersListQuery()),
    [workspaceId, orderId]
  );
  return neighbors.loading ? null : neighbors.data;
}

/** Previous / next in the page header: two round arrows, dimmed where the list ends. */
export function OrderNeighborArrows({ neighbors: data }: { neighbors: OrderNeighbors | null }) {
  const t = useT(STRINGS);
  const link = (id: string | null | undefined, label: string, icon: ReactNode) =>
    id ? (
      <ViewLink to={`/orders/${id}`} aria-label={label} title={label} className={cn(ARROW, ARROW_LIVE)}>
        {icon}
      </ViewLink>
    ) : (
      <span aria-hidden className={cn(ARROW, "opacity-40")}>
        {icon}
      </span>
    );
  return (
    <div role="group" aria-label={t.neighbors} className="flex items-center gap-2">
      {link(data?.prevId, t.previous, <IconCaretLeft className="size-4 rtl:rotate-180" weight="bold" aria-hidden />)}
      {link(data?.nextId, t.next, <IconCaretRight className="size-4 rtl:rotate-180" weight="bold" aria-hidden />)}
    </div>
  );
}

/** Text to the clipboard, with the old selection trick where the clipboard API is missing (http, a refused permission). */
async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      field.remove();
    }
  }
}

export interface OrderMetaActions {
  isTest: boolean;
  isArchived: boolean;
  /** Copies the customer's tracking link and says so. */
  copyTrackingLink: () => void;
  openInvoice: () => void;
  invoiceBusy: boolean;
  toggleTest: () => void;
  testBusy: boolean;
  /** Asks first (the dialog below). */
  archive: () => void;
  unarchive: () => void;
  /** The archive confirmation; render it once, outside any menu. */
  dialog: ReactNode;
}

/**
 * The order's bookkeeping actions — copy the customer's tracking link, the
 * invoice, mark as test, archive / restore — as handlers, for the order
 * page's «…» menu (pages/orders/detail/OrderMoreMenu.tsx).
 */
export function useOrderMetaActions(order: Order, onChanged: () => void): OrderMetaActions {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useOrderErrorMessage();
  const meta = ordersMeta(order);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState(false);

  const trackingLink = `${STOREFRONT_URL}/store/${workspaceId}/track?number=${encodeURIComponent(order.orderNumber)}`;

  async function setArchived(archived: boolean) {
    await ordersUpdateMeta(apiClient, workspaceId, order.id, { archived });
    toast.success(archived ? t.archived : t.unarchived);
    setConfirmArchive(false);
    onChanged();
  }

  async function openInvoice() {
    setInvoiceBusy(true);
    try {
      const blob = await ordersInvoicePdf(apiClient, workspaceId, order.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
      toast.error(code === "INVOICE_NOT_ISSUED" ? t.invoiceNone : errorMessage(err));
    } finally {
      setInvoiceBusy(false);
    }
  }

  async function toggleTest() {
    setTestBusy(true);
    try {
      await ordersUpdateMeta(apiClient, workspaceId, order.id, { isTest: !meta.isTest });
      toast.success(meta.isTest ? t.testOff : t.testOn);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setTestBusy(false);
    }
  }

  async function copyTrackingLink() {
    if (await copyText(trackingLink)) toast.success(t.linkCopied);
    else toast.error(fmt(t.linkCopyFailed, { link: trackingLink }));
  }

  const dialog = (
    <ConfirmDialog
      open={confirmArchive}
      title={t.archiveTitle}
      description={t.archiveDescription}
      confirmLabel={t.archiveConfirm}
      cancelLabel={t.keep}
      busyLabel={t.working}
      onCancel={() => setConfirmArchive(false)}
      onConfirm={async () => {
        try {
          await setArchived(true);
        } catch (err) {
          throw new Error(errorMessage(err));
        }
      }}
    />
  );

  return {
    isTest: meta.isTest,
    isArchived: Boolean(meta.archivedAt),
    copyTrackingLink: () => void copyTrackingLink(),
    openInvoice: () => void openInvoice(),
    invoiceBusy,
    toggleTest: () => void toggleTest(),
    testBusy,
    archive: () => setConfirmArchive(true),
    unarchive: () => void setArchived(false).catch((err) => toast.error(errorMessage(err))),
    dialog,
  };
}
