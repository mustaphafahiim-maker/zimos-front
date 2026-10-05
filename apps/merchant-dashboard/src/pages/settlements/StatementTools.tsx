import { useRef, useState, type ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { Alert, Badge, Button } from "@store-builder/ui";
import {
  statementGetHeld,
  statementImport,
  statementMatch,
  type StatementLineStatus,
  type StatementReport,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatMoney, humanize } from "@/lib/format";
import { formatCount } from "@/lib/analytics";
import { Field, TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Section } from "@/components/Section";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    heldTitle: "Money held by couriers",
    heldDesc: "Delivered cash-on-delivery orders the courier has not paid you for yet, by how long ago they were delivered.",
    courier: "Courier",
    orders: "Orders",
    upTo7: "0–7 days",
    upTo14: "8–14 days",
    over14: "Over 14 days",
    total: "Total held",
    oldest: "Oldest delivery",
    nothingHeld: "No courier is holding your money right now.",
    importButton: "Import courier statement",
    importTitle: "Import a courier statement",
    importDesc: "Upload the statement the courier sent with the transfer. Each waybill is matched to its order and the differences are listed before anything is saved.",
    columns: "The courier's Excel (.xlsx) or CSV file as it came: a waybill column and a collected-amount column, a fee column if it has one. Title lines above the table and the totals line are skipped.",
    chooseFile: "Choose the statement file",
    reference: "Statement reference",
    check: "Match waybills",
    create: "Create settlement with {n} orders",
    created: "Draft settlement created from the statement.",
    fileTooBig: "The file is larger than 1 MB.",
    chooseCourier: "Choose the courier",
    sumOk: "Matched",
    sumMismatch: "Amount differs",
    sumNotFound: "Waybill not found",
    sumOther: "Skipped",
    sumMissing: "Not in the statement",
    difference: "Difference against what is due: {amount}",
    missingNote: "{n} delivered orders worth {amount} are not in this statement — the courier is still holding them.",
    discrepancies: "Rows that need a look",
    line: "Line",
    waybill: "Waybill",
    order: "Order",
    statementAmount: "Statement",
    due: "Due",
    status: "Result",
    ok: "Matched",
    amount_mismatch: "Amount differs",
    already_settled: "Already settled",
    not_settleable: "Not a delivered unpaid COD order",
    not_found: "Waybill not found",
    duplicate: "Repeated in the file",
    invalid: "Unreadable row",
    allGood: "Every row matches an order and its amount.",
  },
  ar: {
    heldTitle: "أموال لدى شركات الشحن",
    heldDesc: "طلبات الدفع عند الاستلام المسلَّمة التي لم تحوّل شركة الشحن قيمتها بعد، حسب مدة التسليم.",
    courier: "شركة الشحن",
    orders: "الطلبات",
    upTo7: "0–7 أيام",
    upTo14: "8–14 يومًا",
    over14: "أكثر من 14 يومًا",
    total: "إجمالي المحتجَز",
    oldest: "أقدم تسليم",
    nothingHeld: "لا توجد أموال لك لدى شركات الشحن الآن.",
    importButton: "استيراد كشف شركة الشحن",
    importTitle: "استيراد كشف شركة الشحن",
    importDesc: "ارفع الكشف الذي أرسلته شركة الشحن مع التحويل. تُطابَق كل بوليصة مع طلبها وتُعرض الفروقات قبل حفظ أي شيء.",
    columns: "ملف Excel (.xlsx) أو CSV من شركة الشحن زي ما وصلك: عمود لرقم البوليصة وعمود للمبلغ المحصَّل، وعمود الرسوم لو موجود. سطور العنوان فوق الجدول وسطر الإجمالي بيتم تخطيهم.",
    chooseFile: "اختر ملف الكشف",
    reference: "مرجع الكشف",
    check: "طابِق البوالص",
    create: "أنشئ تسوية بـ {n} طلب",
    created: "تم إنشاء مسودة تسوية من الكشف.",
    fileTooBig: "الملف أكبر من 1 ميجابايت.",
    chooseCourier: "اختر شركة الشحن",
    sumOk: "مطابق",
    sumMismatch: "المبلغ مختلف",
    sumNotFound: "بوليصة غير موجودة",
    sumOther: "تم تخطيه",
    sumMissing: "غير موجود في الكشف",
    difference: "الفرق عن المستحق: {amount}",
    missingNote: "{n} طلب مسلَّم بقيمة {amount} غير موجود في هذا الكشف — ما زال لدى شركة الشحن.",
    discrepancies: "صفوف تحتاج مراجعة",
    line: "السطر",
    waybill: "البوليصة",
    order: "الطلب",
    statementAmount: "الكشف",
    due: "المستحق",
    status: "النتيجة",
    ok: "مطابق",
    amount_mismatch: "المبلغ مختلف",
    already_settled: "تمت تسويته من قبل",
    not_settleable: "ليس طلب دفع عند الاستلام مسلَّمًا وغير مدفوع",
    not_found: "بوليصة غير موجودة",
    duplicate: "مكرر في الملف",
    invalid: "صف غير مقروء",
    allGood: "كل الصفوف مطابقة لطلباتها ومبالغها.",
  },
} satisfies Messages;

/** "Money held by couriers" (SPEC §15.5): what is owed, per courier, by age. */
export function HeldByCouriers({ workspaceId, refreshKey }: { workspaceId: string; refreshKey?: number }) {
  const t = useT(STRINGS);
  const held = useAsync(() => statementGetHeld(apiClient, workspaceId), [workspaceId, refreshKey]);
  const data = held.data;
  if (!data) return null;
  const money = (v: number) => <bdi dir="ltr">{formatMoney(v, data.currency)}</bdi>;
  return (
    <Section title={t.heldTitle} description={t.heldDesc} flush className="mb-8">
      {data.carriers.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-ink-soft">{t.nothingHeld}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-y border-line text-xs text-ink-soft">
                <th className="px-4 py-2 text-start font-medium">{t.courier}</th>
                <th className="px-4 py-2 text-end font-medium">{t.orders}</th>
                <th className="px-4 py-2 text-end font-medium">{t.upTo7}</th>
                <th className="px-4 py-2 text-end font-medium">{t.upTo14}</th>
                <th className="px-4 py-2 text-end font-medium">{t.over14}</th>
                <th className="px-4 py-2 text-end font-medium">{t.total}</th>
                <th className="px-4 py-2 text-end font-medium">{t.oldest}</th>
              </tr>
            </thead>
            <tbody>
              {data.carriers.map((c) => (
                <tr key={c.carrierCode} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-2.5 font-medium text-ink">{humanize(c.carrierCode)}</td>
                  <td className="tabular-nums px-4 py-2.5 text-end">{formatCount(c.orders)}</td>
                  <td className="tabular-nums px-4 py-2.5 text-end">{money(c.buckets.upTo7)}</td>
                  <td className="tabular-nums px-4 py-2.5 text-end">{money(c.buckets.upTo14)}</td>
                  <td className={`tabular-nums px-4 py-2.5 text-end ${c.buckets.over14 > 0 ? "font-medium text-danger" : ""}`}>
                    {money(c.buckets.over14)}
                  </td>
                  <td className="tabular-nums px-4 py-2.5 text-end font-medium text-ink">{money(c.dueAmount)}</td>
                  <td className="px-4 py-2.5 text-end text-ink-soft">{formatDate(c.oldestDeliveredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/** The button + dialog that turns a courier's statement into a draft settlement. */
export function StatementImport({
  workspaceId,
  carriers,
  onCreated,
}: {
  workspaceId: string;
  /** Courier codes to offer (those with unsettled orders). */
  carriers: string[];
  onCreated: (settlementId: string) => void;
}) {
  const t = useT(STRINGS);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="size-4" aria-hidden />
        {t.importButton}
      </Button>
      {open && (
        <StatementModal
          workspaceId={workspaceId}
          carriers={carriers}
          onClose={() => setOpen(false)}
          onCreated={(id) => {
            setOpen(false);
            onCreated(id);
          }}
        />
      )}
    </>
  );
}

function StatementModal({
  workspaceId,
  carriers,
  onClose,
  onCreated,
}: {
  workspaceId: string;
  carriers: string[];
  onClose: () => void;
  onCreated: (settlementId: string) => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [carrierCode, setCarrierCode] = useState(carriers.length === 1 ? carriers[0] : "");
  const [reference, setReference] = useState("");
  // The courier's file as it came (Excel or CSV), base64: the server reads it.
  const [fileBase64, setFileBase64] = useState("");
  const [fileName, setFileName] = useState("");
  const [report, setReport] = useState<StatementReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReport(null);
    setError(null);
    if (file.size > 1_000_000) return setError(t.fileTooBig);
    setFileName(file.name);
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    setFileBase64(btoa(binary));
  }

  async function match() {
    if (!carrierCode) return setError(t.chooseCourier);
    setBusy(true);
    setError(null);
    try {
      setReport(await statementMatch(apiClient, workspaceId, { fileBase64, fileName, carrierCode }));
    } catch (err) {
      setError(getErrorMessage(err));
    }
    setBusy(false);
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const result = await statementImport(apiClient, workspaceId, { fileBase64, fileName, carrierCode, reference: reference.trim() || null });
      toast.success(t.created);
      onCreated(result.settlementId);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  const s = report?.summary;
  const settleable = s ? s.ok + s.amountMismatch : 0;
  const money = (v: number | null | undefined) =>
    v === null || v === undefined ? "—" : formatMoney(v, report?.currency ?? "EGP");
  const problems = report?.lines.filter((l) => l.status !== "ok") ?? [];
  const tone = (status: StatementLineStatus) =>
    status === "amount_mismatch" ? "secondary" : status === "not_found" || status === "invalid" ? "destructive" : "outline";

  return (
    <Modal
      open
      onClose={onClose}
      title={t.importTitle}
      description={t.importDesc}
      className="max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {common.cancel}
          </Button>
          {report && settleable > 0 ? (
            <Button onClick={() => void create()} disabled={busy}>
              {fmt(t.create, { n: settleable })}
            </Button>
          ) : (
            <Button onClick={() => void match()} disabled={busy || !fileBase64}>
              {t.check}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-ink-soft">{t.columns}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t.courier} required>
            {({ id }) => (
              <Select
                id={id}
                value={carrierCode}
                onChange={(e) => {
                  setCarrierCode(e.target.value);
                  setReport(null);
                }}
              >
                <option value="">{t.chooseCourier}</option>
                {carriers.map((c) => (
                  <option key={c} value={c}>
                    {humanize(c)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <TextField label={t.reference} dir="ltr" value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={input} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => void onFile(e)} />
          <Button variant="outline" onClick={() => input.current?.click()}>
            <Upload className="size-4" aria-hidden />
            {t.chooseFile}
          </Button>
          {fileName && (
            <span className="truncate text-sm text-ink-soft" dir="ltr">
              {fileName}
            </span>
          )}
        </div>
        {error && <Alert variant="destructive">{error}</Alert>}

        {s && report && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Stat label={t.sumOk} value={s.ok} />
              <Stat label={t.sumMismatch} value={s.amountMismatch} warn={s.amountMismatch > 0} />
              <Stat label={t.sumNotFound} value={s.notFound} warn={s.notFound > 0} />
              <Stat label={t.sumOther} value={s.alreadySettled + s.notSettleable + s.duplicate + s.invalid} />
              <Stat label={t.sumMissing} value={s.missingOrders} warn={s.missingOrders > 0} />
            </div>
            {s.differenceAmount !== 0 && (
              <p className="text-sm font-medium text-danger">
                {fmt(t.difference, { amount: money(s.differenceAmount) })}
              </p>
            )}
            {s.missingOrders > 0 && (
              <p className="text-sm text-ink-soft">{fmt(t.missingNote, { n: s.missingOrders, amount: money(s.missingAmount) })}</p>
            )}
            {problems.length === 0 ? (
              <p className="text-sm text-success">{t.allGood}</p>
            ) : (
              <div>
                <p className="mb-1 text-sm font-medium text-ink">{t.discrepancies}</p>
                <div className="max-h-56 overflow-auto rounded-lg border border-line">
                  <table className="w-full min-w-[34rem] text-xs">
                    <thead>
                      <tr className="border-b border-line text-ink-soft">
                        <th className="px-3 py-2 text-start font-medium">{t.line}</th>
                        <th className="px-3 py-2 text-start font-medium">{t.waybill}</th>
                        <th className="px-3 py-2 text-start font-medium">{t.order}</th>
                        <th className="px-3 py-2 text-end font-medium">{t.statementAmount}</th>
                        <th className="px-3 py-2 text-end font-medium">{t.due}</th>
                        <th className="px-3 py-2 text-start font-medium">{t.status}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {problems.map((l) => (
                        <tr key={l.line} className="border-b border-line last:border-b-0">
                          <td className="tabular-nums px-3 py-1.5">{l.line}</td>
                          <td className="px-3 py-1.5" dir="ltr">{l.waybill || "—"}</td>
                          <td className="px-3 py-1.5" dir="ltr">{l.orderNumber ?? "—"}</td>
                          <td className="tabular-nums px-3 py-1.5 text-end"><bdi dir="ltr">{money(l.statementAmount)}</bdi></td>
                          <td className="tabular-nums px-3 py-1.5 text-end"><bdi dir="ltr">{money(l.dueAmount)}</bdi></td>
                          <td className="px-3 py-1.5">
                            <Badge variant={tone(l.status)}>{t[l.status]}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-line px-3 py-2">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className={`tabular-nums text-lg font-semibold ${warn ? "text-danger" : "text-ink"}`}>{formatCount(value)}</p>
    </div>
  );
}
