import { useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ORDER_PACKING_SLIPS_MAX,
  ORDER_PICK_LIST_MAX,
  ordersBulk,
  ordersManifestPdf,
  ordersMeta,
  ordersSelectionInvoicesPdf,
  ordersUpdateMeta,
  ordersWaybillsPdf,
  webhooksResendOrders,
  type Order,
  type OrderBulkAction,
  type OrderBulkResponse,
  type OrderWaybillFormat,
} from "@store-builder/api-client";
import {
  IconArchive,
  IconClipboard,
  IconCourier,
  IconDocument,
  IconDownload,
  IconEye,
  IconEyeOff,
  IconInvoice,
  IconPackageOpen,
  IconPrint,
  IconSend,
  IconSwap,
  IconTag,
  IconUndo,
} from "@/components/icons";
import type { BulkAction } from "@/components/list";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { countOf } from "@/lib/plural";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { BulkShipDialog } from "../components/BulkShipDialog";
import { ExportOrdersDialog } from "../components/ExportOrders";
import { useOrderErrorMessage } from "../orderErrors";
import { PackingSlipsDialog } from "../packing/PackingSlipsDialog";
import { savePickListSelection } from "../packing/packingStorage";
import { PACKING_STRINGS } from "../packing/packingStrings";
import { BulkActionDialog, BulkResultDialog, useBulkActionLabel, type BulkRequest, type BulkSent } from "./BulkActionDialog";
import { openBlob, useDocumentError } from "./orderDocuments";

const STRINGS = {
  en: {
    waybills: "Print waybills",
    waybillsThermal: "Waybills for a label printer (10×15)",
    manifest: "Courier manifest",
    invoices: "Print invoices",
    invoicesSkipped: "Left out, no invoice yet: {orders}",
    resend: "Resend to webhook",
    resent: "Sent {orders} again ({deliveries} deliveries).",
    noEndpoint: "No webhook listens to new orders. Add one under Settings → Webhooks.",
    resendTooMany: "Pick at most {max} orders to resend.",
    export: "Export",
    exportTooMany: "Export takes up to {max} ticked orders. For more, filter the list and export it from Tools.",
    updated: "{orders} updated.",
    archivedOne: "Order {number} archived.",
    unarchivedOne: "Order {number} is back from the archive.",
  },
  ar: {
    waybills: "اطبع البوالص",
    waybillsThermal: "بوالص لطابعة الملصقات (10×15)",
    manifest: "كشف تسليم المندوب",
    invoices: "اطبع الفواتير",
    invoicesSkipped: "ماتطبعوش، لسه ملهمش فاتورة: {orders}",
    resend: "ابعت تاني للويب هوك",
    resent: "اتبعت {orders} تاني ({deliveries} مرة إرسال).",
    noEndpoint: "مفيش ويب هوك بيستقبل الأوردرات الجديدة. ضيفه من الإعدادات ← الويب هوك.",
    resendTooMany: "اختار {max} أوردر بالكتير عشان تبعتهم تاني.",
    export: "صدّر",
    exportTooMany: "التصدير بياخد لحد {max} أوردر متحدد. لو أكتر، فلتر القائمة وصدّرها من «أدوات».",
    updated: "اتحدّث {orders}.",
    archivedOne: "الأوردر {number} اتأرشف.",
    unarchivedOne: "الأوردر {number} رجع من الأرشيف.",
  },
} satisfies Messages;

// The webhook resend takes up to 100 orders; the export's `ids` too.
const RESEND_MAX = 100;
const EXPORT_MAX = 100;

/** The actions that undo each other, when the rows they touched are known. */
const INVERSE: Partial<Record<OrderBulkAction, OrderBulkAction>> = {
  archive: "unarchive",
  unarchive: "archive",
  mark_seen: "mark_unseen",
  mark_unseen: "mark_seen",
  add_tag: "remove_tag",
  remove_tag: "add_tag",
};

const sameTag = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * What would put the orders back as they were before `sent`: the opposite
 * action over the orders it really changed. Only when every order it touched
 * is on screen — their state before is then known; an order that was already
 * archived, opened or tagged is left out, so Undo never changes more than the
 * action did. null when there is nothing to take back, or no way to know.
 */
function inverseOf(sent: BulkSent, rows: readonly Order[]): BulkSent | null {
  const action = INVERSE[sent.action];
  if (!action) return null;
  const byId = new Map(rows.map((order) => [order.id, order]));
  const changed: string[] = [];
  const tag = sent.payload.tags?.[0] ?? "";
  for (const id of sent.orderIds) {
    const order = byId.get(id);
    if (!order) return null;
    const meta = ordersMeta(order);
    const did =
      sent.action === "archive"
        ? !meta.archivedAt
        : sent.action === "unarchive"
          ? Boolean(meta.archivedAt)
          : sent.action === "mark_seen"
            ? !meta.isSeen
            : sent.action === "mark_unseen"
              ? meta.isSeen
              : sent.action === "add_tag"
                ? !meta.tags.some((existing) => sameTag(existing, tag))
                : meta.tags.some((existing) => sameTag(existing, tag));
    if (did) changed.push(id);
  }
  if (changed.length === 0) return null;
  return { action, orderIds: changed, payload: sent.payload };
}

/**
 * Everything the list can do to orders in bulk, and to one order from its
 * row's menu — the same endpoints and payloads as before, behind the kit's
 * bulk bar instead of a select and eight buttons:
 *
 *  - `POST /orders/bulk` actions (status, tags, ship, archive, seen) through
 *    the dialog that asks for what each needs; a connected courier goes on to
 *    the batch-ship dialog;
 *  - documents for the ticked orders: waybills (A4 × 4, 10 × 15), the courier's
 *    manifest, invoices, packing slips, the pick list;
 *  - resend to the webhook, export of the ticked orders.
 *
 * When every order took the action it says so in a toast — with Undo for
 * archive, opened / not opened and tags, where the opposite action is known to
 * be safe; when some did not, the result dialog lists them with the reason.
 */
export function useOrderBulk({
  rows,
  onChanged,
  onClearSelection,
}: {
  /** The orders on screen: their state before an action is what Undo goes back to. */
  rows: readonly Order[];
  /** Orders changed: read the list and the counts again. */
  onChanged: () => void;
  onClearSelection: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const packing = useT(PACKING_STRINGS);
  const actionLabel = useBulkActionLabel();
  const toast = useToast();
  const navigate = useNavigate();
  const errorMessage = useOrderErrorMessage();
  const documentError = useDocumentError();

  const requestId = useRef(0);
  const [request, setRequest] = useState<BulkRequest | null>(null);
  const [shipWith, setShipWith] = useState<{ carrierCode: string; orderIds: string[]; fromSelection: boolean } | null>(null);
  const [result, setResult] = useState<OrderBulkResponse | null>(null);
  const [slipsFor, setSlipsFor] = useState<string[] | null>(null);
  const [exportIds, setExportIds] = useState<string[] | null>(null);
  // A document is being prepared: the bar shows it and holds its buttons.
  const [busy, setBusy] = useState(false);

  /** Opens the dialog of a `POST /orders/bulk` action. */
  function open(action: OrderBulkAction, orderIds: string[], from: { selection: boolean; orderNumber?: string }) {
    if (orderIds.length === 0) return;
    requestId.current += 1;
    setRequest({ id: requestId.current, action, orderIds, orderNumber: from.orderNumber, fromSelection: from.selection });
  }

  function applied(response: OrderBulkResponse, sent: BulkSent, done: BulkRequest) {
    setRequest(null);
    // What Undo would send, worked out from the rows as they were before the list is read again.
    const inverse = inverseOf(sent, rows);
    if (done.fromSelection) onClearSelection();
    onChanged();
    if (response.results.some((r) => !r.ok)) {
      setResult(response);
      return;
    }
    const message = fmt(t.updated, { orders: countOf("order", response.succeeded) });
    if (!inverse) {
      toast.success(message);
      return;
    }
    toast.undo(message, async () => {
      await ordersBulk(apiClient, workspaceId, { action: inverse.action, orderIds: inverse.orderIds, payload: inverse.payload });
      onChanged();
    });
  }

  /** Archive (or bring back) one order, from its row's menu: at once, with Undo. */
  async function archiveOne(order: Order) {
    const wasArchived = Boolean(ordersMeta(order).archivedAt);
    try {
      await ordersUpdateMeta(apiClient, workspaceId, order.id, { archived: !wasArchived });
      onChanged();
      toast.undo(fmt(wasArchived ? t.unarchivedOne : t.archivedOne, { number: order.orderNumber }), async () => {
        await ordersUpdateMeta(apiClient, workspaceId, order.id, { archived: wasArchived });
        onChanged();
      });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function printing(make: () => Promise<Blob>) {
    if (busy) return;
    setBusy(true);
    try {
      openBlob(await make());
    } catch (err) {
      toast.error(documentError(err));
    } finally {
      setBusy(false);
    }
  }

  const waybills = (ids: string[], format: OrderWaybillFormat) => printing(() => ordersWaybillsPdf(apiClient, workspaceId, ids, format));

  async function invoices(ids: string[]) {
    if (busy) return;
    setBusy(true);
    try {
      const { pdf, skipped } = await ordersSelectionInvoicesPdf(apiClient, workspaceId, ids);
      openBlob(pdf);
      if (skipped.length > 0) toast.error(fmt(t.invoicesSkipped, { orders: skipped.join("، ") }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function resend(ids: string[]) {
    if (busy) return;
    if (ids.length > RESEND_MAX) {
      toast.error(fmt(t.resendTooMany, { max: RESEND_MAX }));
      return;
    }
    setBusy(true);
    try {
      const sent = await webhooksResendOrders(apiClient, workspaceId, ids);
      if (sent.deliveries === 0) toast.error(t.noEndpoint);
      else toast.success(fmt(t.resent, { orders: countOf("order", sent.orders), deliveries: sent.deliveries }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function pickList(ids: string[]) {
    if (ids.length > ORDER_PICK_LIST_MAX) {
      toast.error(fmt(packing.pickTooMany, { max: ORDER_PICK_LIST_MAX }));
      return;
    }
    // The page is its own route: the ids ride in the navigation and, for a reload, in the session.
    savePickListSelection(workspaceId, ids);
    navigate("/orders/pick-list", { state: { workspaceId, orderIds: ids } });
  }

  function packingSlips(ids: string[]) {
    if (ids.length > ORDER_PACKING_SLIPS_MAX) {
      toast.error(fmt(packing.slipsTooMany, { max: ORDER_PACKING_SLIPS_MAX }));
      return;
    }
    setSlipsFor(ids);
  }

  /**
   * The bar's actions for the ticked orders, in the order the bar draws them:
   * the first is the main one, the next few are pills, the rest fold into «كمان».
   */
  function barActions(ids: string[]): BulkAction[] {
    const bulk = (action: OrderBulkAction) => () => open(action, ids, { selection: true });
    const tooManyToExport = ids.length > EXPORT_MAX;
    return [
      { id: "ship", label: actionLabel("ship"), icon: IconCourier, onSelect: bulk("ship") },
      { id: "set_status", label: actionLabel("set_status"), icon: IconSwap, onSelect: bulk("set_status") },
      { id: "waybills", label: t.waybills, icon: IconPrint, onSelect: () => void waybills(ids, "a4x4") },
      {
        id: "export",
        label: t.export,
        icon: IconDownload,
        onSelect: () => setExportIds(ids),
        disabled: tooManyToExport,
        disabledReason: tooManyToExport ? fmt(t.exportTooMany, { max: EXPORT_MAX }) : undefined,
      },
      { id: "waybills-thermal", label: t.waybillsThermal, icon: IconPrint, onSelect: () => void waybills(ids, "10x15") },
      { id: "packing-slips", label: packing.packingSlips, icon: IconPackageOpen, onSelect: () => packingSlips(ids) },
      { id: "pick-list", label: packing.pickList, icon: IconClipboard, onSelect: () => pickList(ids) },
      {
        id: "manifest",
        label: t.manifest,
        icon: IconDocument,
        onSelect: () => void printing(() => ordersManifestPdf(apiClient, workspaceId, { orderIds: ids })),
      },
      { id: "invoices", label: t.invoices, icon: IconInvoice, onSelect: () => void invoices(ids) },
      { id: "add_tag", label: actionLabel("add_tag"), icon: IconTag, onSelect: bulk("add_tag") },
      { id: "remove_tag", label: actionLabel("remove_tag"), icon: IconTag, onSelect: bulk("remove_tag") },
      { id: "mark_seen", label: actionLabel("mark_seen"), icon: IconEye, onSelect: bulk("mark_seen") },
      { id: "mark_unseen", label: actionLabel("mark_unseen"), icon: IconEyeOff, onSelect: bulk("mark_unseen") },
      { id: "archive", label: actionLabel("archive"), icon: IconArchive, onSelect: bulk("archive") },
      { id: "unarchive", label: actionLabel("unarchive"), icon: IconUndo, onSelect: bulk("unarchive") },
      { id: "resend", label: t.resend, icon: IconSend, onSelect: () => void resend(ids) },
    ];
  }

  // Outside the list's own states: a result dialog must survive the list reloading.
  const dialogs: ReactNode = (
    <>
      <BulkActionDialog
        request={request}
        onClose={() => setRequest(null)}
        onApplied={applied}
        onShipWith={(carrierCode, from) => {
          setRequest(null);
          setShipWith({ carrierCode, orderIds: from.orderIds, fromSelection: from.fromSelection });
        }}
      />
      {shipWith && (
        <BulkShipDialog
          carrierCode={shipWith.carrierCode}
          orderIds={shipWith.orderIds}
          onClose={() => setShipWith(null)}
          onStarted={() => {
            const fromSelection = shipWith.fromSelection;
            setShipWith(null);
            if (fromSelection) onClearSelection();
            onChanged();
          }}
        />
      )}
      <BulkResultDialog result={result} onClose={() => setResult(null)} />
      <PackingSlipsDialog open={slipsFor !== null} orderIds={slipsFor ?? []} onClose={() => setSlipsFor(null)} />
      {exportIds && <ExportOrdersDialog filters={{ ids: exportIds.join(",") }} onClose={() => setExportIds(null)} />}
    </>
  );

  return {
    /** A `POST /orders/bulk` action for these orders: opens its dialog. */
    open,
    archiveOne,
    barActions,
    /** A document is being prepared. */
    busy,
    dialogs,
  };
}

export type OrderBulk = ReturnType<typeof useOrderBulk>;
