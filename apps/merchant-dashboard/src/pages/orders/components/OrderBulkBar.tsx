import { useState, type FormEvent } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  ORDER_STAGES,
  ordersBulk,
  type OrderBulkAction,
  type OrderBulkPayload,
  type OrderBulkResponse,
  type OrderStage,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { useOrderLabels } from "../orderLabels";
import { useOrderErrorMessage } from "../orderErrors";
import { SelectionDocuments } from "./OrderDocuments";

const STRINGS = {
  en: {
    selected: "{count} selected",
    clear: "Clear selection",
    action: "Bulk action",
    choose: "Choose an action…",
    a_set_status: "Change status",
    a_add_tag: "Add a tag",
    a_remove_tag: "Remove a tag",
    a_ship: "Ship with a courier",
    a_archive: "Archive",
    a_unarchive: "Restore from archive",
    a_mark_seen: "Mark as seen",
    a_mark_unseen: "Mark as not seen",
    title: "{action} — {count} orders",
    status: "New status",
    reason: "Reason (optional)",
    statusHint: "Orders that can't take this status from where they are stay as they are.",
    tag: "Tag",
    courier: "Courier",
    courierManual: "Other (type a name)",
    courierName: "Courier name",
    courierHint: "A connected courier books each order; any other name records a manual shipment.",
    confirm_archive: "The orders leave the list and its counts. Nothing is deleted.",
    confirm_generic: "This applies to every selected order.",
    cancel: "Cancel",
    apply: "Apply",
    applying: "Working…",
    resultTitle: "Result",
    resultOk: "{count} orders updated.",
    resultFailed: "{count} could not be updated:",
    close: "Close",
  },
  ar: {
    selected: "تم تحديد {count}",
    clear: "إلغاء التحديد",
    action: "إجراء جماعي",
    choose: "اختر إجراء…",
    a_set_status: "تغيير الحالة",
    a_add_tag: "إضافة تاج",
    a_remove_tag: "حذف تاج",
    a_ship: "شحن مع شركة شحن",
    a_archive: "أرشفة",
    a_unarchive: "استرجاع من الأرشيف",
    a_mark_seen: "تعليم كمشاهَد",
    a_mark_unseen: "تعليم كغير مشاهَد",
    title: "{action} — {count} أوردر",
    status: "الحالة الجديدة",
    reason: "السبب (اختياري)",
    statusHint: "الأوردرات التي لا تقبل هذه الحالة من وضعها الحالي تبقى كما هي.",
    tag: "التاج",
    courier: "شركة الشحن",
    courierManual: "أخرى (اكتب الاسم)",
    courierName: "اسم شركة الشحن",
    courierHint: "شركة الشحن المربوطة تحجز كل أوردر؛ أي اسم آخر يسجّل شحنة يدوية.",
    confirm_archive: "الأوردرات تختفي من القائمة وأعدادها. لا يُحذف شيء.",
    confirm_generic: "سيُطبَّق هذا على كل الأوردرات المحددة.",
    cancel: "إلغاء",
    apply: "تطبيق",
    applying: "جارٍ التنفيذ…",
    resultTitle: "النتيجة",
    resultOk: "تم تحديث {count} أوردر.",
    resultFailed: "تعذّر تحديث {count}:",
    close: "إغلاق",
  },
} satisfies Messages;

const ACTIONS: OrderBulkAction[] = [
  "set_status",
  "add_tag",
  "remove_tag",
  "ship",
  "archive",
  "unarchive",
  "mark_seen",
  "mark_unseen",
];

/**
 * The bar that appears above the table while orders are ticked: pick an
 * action, give it what it needs, and read what happened to each order.
 */
export function OrderBulkBar({
  selectedIds,
  onClear,
  onDone,
}: {
  selectedIds: string[];
  onClear: () => void;
  onDone: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const errorMessage = useOrderErrorMessage();
  const [action, setAction] = useState<OrderBulkAction | null>(null);
  const [status, setStatus] = useState<OrderStage>("ready_to_ship");
  const [reason, setReason] = useState("");
  const [tag, setTag] = useState("");
  const [courier, setCourier] = useState("");
  const [courierName, setCourierName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrderBulkResponse | null>(null);

  const carriers = useAsync(
    () => apiClient.listCarriers(workspaceId).then((r) => r.carriers.filter((c) => c.connection)),
    [workspaceId]
  );
  const connected = carriers.data ?? [];

  if (selectedIds.length === 0 && !result) return null;

  function payload(): OrderBulkPayload | null {
    if (action === "set_status") return { status, reason: reason.trim() || undefined };
    if (action === "add_tag" || action === "remove_tag") return tag.trim() ? { tags: [tag.trim()] } : null;
    if (action === "ship") {
      const code = courier || courierName.trim();
      return code ? { carrierCode: code } : null;
    }
    return {};
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!action) return;
    const body = payload();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      const response = await ordersBulk(apiClient, workspaceId, { action, orderIds: selectedIds, payload: body });
      setAction(null);
      setResult(response);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const failures = result ? result.results.filter((r) => !r.ok) : [];

  return (
    <>
      {selectedIds.length > 0 && (
        <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-primary/40 bg-primary-soft px-3 py-2">
          <span className="text-sm font-medium text-ink">{fmt(t.selected, { count: selectedIds.length })}</span>
          <label className="sr-only" htmlFor="orders-bulk-action">
            {t.action}
          </label>
          <Select
            id="orders-bulk-action"
            value=""
            className="h-11 w-auto min-w-48"
            onChange={(e) => {
              setError(null);
              setAction((e.target.value || null) as OrderBulkAction | null);
            }}
          >
            <option value="">{t.choose}</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {t[`a_${a}`]}
              </option>
            ))}
          </Select>
          <SelectionDocuments orderIds={selectedIds} />
          <Button variant="ghost" size="sm" className="ms-auto min-h-11" onClick={onClear}>
            {t.clear}
          </Button>
        </div>
      )}

      <Modal
        open={action !== null}
        onClose={() => (busy ? undefined : setAction(null))}
        title={action ? fmt(t.title, { action: t[`a_${action}`], count: selectedIds.length }) : ""}
      >
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && (
            <Alert variant="danger" role="alert">
              {error}
            </Alert>
          )}

          {action === "set_status" && (
            <>
              <Field label={t.status} hint={t.statusHint}>
                {({ id }) => (
                  <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as OrderStage)} className="h-11">
                    {ORDER_STAGES.filter((s) => s !== "awaiting_payment").map((s) => (
                      <option key={s} value={s}>
                        {labels.stage(s)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <TextField label={t.reason} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
            </>
          )}

          {(action === "add_tag" || action === "remove_tag") && (
            <Field label={t.tag} required>
              {({ id }) => (
                <Input id={id} value={tag} maxLength={40} autoFocus onChange={(e) => setTag(e.target.value)} className="h-11" />
              )}
            </Field>
          )}

          {action === "ship" && (
            <>
              <Field label={t.courier} hint={t.courierHint}>
                {({ id }) => (
                  <Select id={id} value={courier} onChange={(e) => setCourier(e.target.value)} className="h-11">
                    {connected.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                    <option value="">{t.courierManual}</option>
                  </Select>
                )}
              </Field>
              {!courier && (
                <TextField
                  label={t.courierName}
                  required
                  value={courierName}
                  maxLength={100}
                  onChange={(e) => setCourierName(e.target.value)}
                />
              )}
            </>
          )}

          {action === "archive" && <p className="text-sm text-ink-soft">{t.confirm_archive}</p>}
          {(action === "unarchive" || action === "mark_seen" || action === "mark_unseen") && (
            <p className="text-sm text-ink-soft">{t.confirm_generic}</p>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setAction(null)} disabled={busy}>
              {t.cancel}
            </Button>
            <Button type="submit" className="min-h-11" disabled={busy || payload() === null}>
              {busy ? t.applying : t.apply}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={result !== null}
        onClose={() => setResult(null)}
        title={t.resultTitle}
        footer={
          <Button className="min-h-11" onClick={() => setResult(null)}>
            {t.close}
          </Button>
        }
      >
        {result && (
          <div className="space-y-3">
            <p className="text-sm text-ink">{fmt(t.resultOk, { count: result.succeeded })}</p>
            {failures.length > 0 && (
              <>
                <p className="text-sm font-medium text-danger">{fmt(t.resultFailed, { count: failures.length })}</p>
                <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
                  {failures.map((f) => (
                    <li key={f.orderId} className="flex flex-wrap gap-2">
                      <bdi dir="ltr" className="font-medium text-ink">
                        {f.orderNumber ?? f.orderId}
                      </bdi>
                      <span className="text-ink-soft">{errorMessage({ code: f.code, message: f.message })}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
