import { useRef, useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  ApiError,
  ordersImportTracking,
  ordersManifestPdf,
  ordersWaybillsPdf,
  type OrderTrackingImportResult,
  type OrderWaybillFormat,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { useOrderErrorMessage } from "../orderErrors";

const STRINGS = {
  en: {
    printA4: "Print waybills (A4 × 4)",
    printThermal: "Print waybills (10×15)",
    manifest: "Courier manifest",
    manifestToday: "Today's manifest",
    preparing: "Preparing…",
    NO_SHIPMENTS: "There are no shipments to hand over.",
    TOO_MANY_ORDERS: "At most 200 orders can be printed at once.",
    sync: "Sync from file",
    syncTitle: "Update tracking from a file",
    syncDescription:
      "Upload the CSV your courier sent. Columns: order_number (required), tracking_number, tracking_url, carrier, status.",
    statuses: "Status can be: shipped, out_for_delivery, delivered, failed, returned.",
    choose: "Choose a CSV file",
    template: "Download a sample file",
    uploading: "Reading the file…",
    resultOk: "{count} rows applied.",
    resultFailed: "{count} rows could not be applied:",
    line: "Line {line}",
    close: "Close",
    EMPTY_FILE: "The file has no rows under its header.",
    MISSING_COLUMN: "The file needs an order_number column.",
    TOO_MANY_ROWS: "The file has too many rows (2000 at most).",
    ORDER_NOT_FOUND: "No order with this number.",
    UNKNOWN_STATUS: "Unknown status.",
    MISSING_ORDER_NUMBER: "No order number on this row.",
  },
  ar: {
    printA4: "طباعة البوالص (A4 × 4)",
    printThermal: "طباعة البوالص (10×15)",
    manifest: "كشف تسليم المندوب",
    manifestToday: "كشف تسليم اليوم",
    preparing: "جارٍ التجهيز…",
    NO_SHIPMENTS: "لا توجد شحنات للتسليم.",
    TOO_MANY_ORDERS: "يمكن طباعة 200 أوردر على الأكثر في المرة.",
    sync: "تحديث من ملف",
    syncTitle: "تحديث التتبع من ملف",
    syncDescription:
      "ارفع ملف CSV الذي أرسلته شركة الشحن. الأعمدة: order_number (مطلوب)، tracking_number، tracking_url، carrier، status.",
    statuses: "الحالة يمكن أن تكون: shipped، out_for_delivery، delivered، failed، returned.",
    choose: "اختر ملف CSV",
    template: "تحميل ملف نموذجي",
    uploading: "جارٍ قراءة الملف…",
    resultOk: "تم تطبيق {count} صف.",
    resultFailed: "تعذّر تطبيق {count} صف:",
    line: "السطر {line}",
    close: "إغلاق",
    EMPTY_FILE: "الملف لا يحتوي على صفوف تحت العناوين.",
    MISSING_COLUMN: "الملف يحتاج عمود order_number.",
    TOO_MANY_ROWS: "عدد الصفوف كبير جدًا (2000 على الأكثر).",
    ORDER_NOT_FOUND: "لا يوجد أوردر بهذا الرقم.",
    UNKNOWN_STATUS: "حالة غير معروفة.",
    MISSING_ORDER_NUMBER: "لا يوجد رقم أوردر في هذا الصف.",
  },
} satisfies Messages;

type Strings = Record<keyof (typeof STRINGS)["en"], string>;

function useDocumentError() {
  const t = useT(STRINGS) as Strings;
  const fallback = useOrderErrorMessage();
  return (err: unknown): string => {
    const code =
      err instanceof ApiError
        ? (err.code as string | undefined)
        : err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code)
          : undefined;
    if (code && code in t) return t[code as keyof Strings];
    return fallback(err);
  };
}

function openBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Waybill and manifest buttons for the orders ticked in the list. */
export function SelectionDocuments({ orderIds }: { orderIds: string[] }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useDocumentError();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, make: () => Promise<Blob>) {
    setBusy(key);
    try {
      openBlob(await make());
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }
  const waybills = (format: OrderWaybillFormat) => () => ordersWaybillsPdf(apiClient, workspaceId, orderIds, format);

  return (
    <>
      <Button variant="outline" size="sm" className="min-h-11" disabled={busy !== null} onClick={() => run("a4", waybills("a4x4"))}>
        {busy === "a4" ? t.preparing : t.printA4}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="min-h-11"
        disabled={busy !== null}
        onClick={() => run("thermal", waybills("10x15"))}
      >
        {busy === "thermal" ? t.preparing : t.printThermal}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="min-h-11"
        disabled={busy !== null}
        onClick={() => run("manifest", () => ordersManifestPdf(apiClient, workspaceId, { orderIds }))}
      >
        {busy === "manifest" ? t.preparing : t.manifest}
      </Button>
    </>
  );
}

const SAMPLE =
  "order_number,tracking_number,tracking_url,carrier,status\nORD-XXXX-XXXX,AWB-1001,https://courier.example/track/AWB-1001,Courier name,shipped\n";

/** The list header's "Today's manifest" and "Sync from file". */
export function OrderListDocuments({ onImported }: { onImported: () => void }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useDocumentError();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manifestBusy, setManifestBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrderTrackingImportResult | null>(null);

  async function manifest() {
    setManifestBusy(true);
    try {
      openBlob(await ordersManifestPdf(apiClient, workspaceId));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setManifestBusy(false);
    }
  }

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const answer = await ordersImportTracking(apiClient, workspaceId, await file.text());
      setResult(answer);
      if (answer.succeeded > 0) onImported();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const failures = result ? result.results.filter((r) => !r.ok) : [];

  return (
    <>
      <Button variant="outline" size="sm" className="min-h-11" onClick={manifest} disabled={manifestBusy}>
        {manifestBusy ? t.preparing : t.manifestToday}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="min-h-11"
        onClick={() => {
          setError(null);
          setResult(null);
          setOpen(true);
        }}
      >
        {t.sync}
      </Button>

      <Modal
        open={open}
        onClose={() => (busy ? undefined : setOpen(false))}
        title={t.syncTitle}
        description={t.syncDescription}
        footer={
          <Button className="min-h-11" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            {t.close}
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">{t.statuses}</p>
          {error && (
            <Alert variant="danger" role="alert">
              {error}
            </Alert>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              id="orders-tracking-file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
              }}
            />
            <Button className="min-h-11" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? t.uploading : t.choose}
            </Button>
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`}
              download="tracking-sample.csv"
              className="text-sm text-primary-dark underline dark:text-primary"
            >
              {t.template}
            </a>
          </div>

          {result && (
            <div className="space-y-2 border-t border-line pt-3">
              <p className="text-sm text-ink">{fmt(t.resultOk, { count: result.succeeded })}</p>
              {failures.length > 0 && (
                <>
                  <p className="text-sm font-medium text-danger">{fmt(t.resultFailed, { count: failures.length })}</p>
                  <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
                    {failures.map((f) => (
                      <li key={f.line} className="flex flex-wrap gap-2">
                        <span className="text-ink-soft">{fmt(t.line, { line: f.line })}</span>
                        {f.orderNumber && (
                          <bdi dir="ltr" className="font-medium text-ink">
                            {f.orderNumber}
                          </bdi>
                        )}
                        <span className="text-ink-soft">{errorMessage({ code: f.code, message: f.message })}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
