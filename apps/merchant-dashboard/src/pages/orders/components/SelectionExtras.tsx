import { useState } from "react";
import { Button } from "@store-builder/ui";
import { ordersSelectionInvoicesPdf, webhooksResendOrders } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { useOrderErrorMessage } from "../orderErrors";
import { ExportOrders } from "./ExportOrders";

const STRINGS = {
  en: {
    invoices: "Print invoices",
    preparing: "Preparing…",
    skipped: "Left out, no invoice yet: {orders}",
    resend: "Resend to webhook",
    resending: "Sending…",
    resent: "Sent {orders} orders again ({deliveries} deliveries).",
    noEndpoint: "No webhook listens to new orders. Add one under Settings → Webhooks.",
    tooMany: "Pick at most {max} orders to resend.",
    exportSelected: "Export selected",
  },
  ar: {
    invoices: "طباعة الفواتير",
    preparing: "بنجهّز…",
    skipped: "لم تُطبع، لا فاتورة لها بعد: {orders}",
    resend: "إعادة الإرسال للويب هوك",
    resending: "بنبعت…",
    resent: "أُعيد إرسال {orders} طلب ({deliveries} إرسال).",
    noEndpoint: "لا يوجد ويب هوك يستقبل الطلبات الجديدة. أضفه من الإعدادات ← الويب هوك.",
    tooMany: "اختر {max} طلب على الأكثر لإعادة الإرسال.",
    exportSelected: "تصدير المحدد",
  },
} satisfies Messages;

// The webhook resend takes up to 100 orders; the export's `ids` too.
const RESEND_MAX = 100;
const EXPORT_MAX = 100;

/** Invoices, webhook resend and export for the orders ticked in the list (SPEC §4.3 bulk actions). */
export function SelectionExtras({ orderIds }: { orderIds: string[] }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useOrderErrorMessage();
  const [busy, setBusy] = useState<"invoices" | "resend" | null>(null);

  async function invoices() {
    setBusy("invoices");
    try {
      const { pdf, skipped } = await ordersSelectionInvoicesPdf(apiClient, workspaceId, orderIds);
      const url = URL.createObjectURL(pdf);
      window.open(url, "_blank", "noopener");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      if (skipped.length > 0) toast.error(fmt(t.skipped, { orders: skipped.join("، ") }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function resend() {
    if (orderIds.length > RESEND_MAX) {
      toast.error(fmt(t.tooMany, { max: RESEND_MAX }));
      return;
    }
    setBusy("resend");
    try {
      const result = await webhooksResendOrders(apiClient, workspaceId, orderIds);
      if (result.deliveries === 0) toast.error(t.noEndpoint);
      else toast.success(fmt(t.resent, { orders: result.orders, deliveries: result.deliveries }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" className="min-h-11" disabled={busy !== null} onClick={invoices}>
        {busy === "invoices" ? t.preparing : t.invoices}
      </Button>
      <Button variant="outline" size="sm" className="min-h-11" disabled={busy !== null} onClick={resend}>
        {busy === "resend" ? t.resending : t.resend}
      </Button>
      {orderIds.length <= EXPORT_MAX && (
        <ExportOrders filters={{ ids: orderIds.join(",") }} label={t.exportSelected} size="sm" />
      )}
    </>
  );
}
