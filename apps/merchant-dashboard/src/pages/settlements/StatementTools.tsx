import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Alert, Button, cn } from "@store-builder/ui";
import { statementImport, statementMatch, type StatementLineStatus, type StatementReport } from "@store-builder/api-client";
import { Field, TextField } from "@/components/Field";
import { IconUpload } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { formatCount } from "@/lib/analytics";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { providerName } from "@/lib/providers";

const STRINGS = {
  en: {
    importTitle: "Import a courier statement",
    importDesc: "Upload the statement the courier sent with the transfer. Each waybill is matched to its order and the differences are listed before anything is saved.",
    columns: "The courier's Excel (.xlsx) or CSV file as it came: a waybill column and a collected-amount column, a fee column if it has one. Title lines above the table and the totals line are skipped.",
    courier: "Courier",
    chooseCourier: "Choose the courier",
    courierMissing: "Choose which courier sent this statement.",
    chooseFile: "Choose the statement file",
    changeFile: "Choose another file",
    reference: "Statement reference",
    check: "Match waybills",
    checking: "Matching…",
    create: "Create a settlement with {orders}",
    creating: "Saving…",
    created: "Draft settlement created from the statement.",
    fileTooBig: "The file is larger than one megabyte. Export a shorter period and try again.",
    sumOk: "Matched",
    sumMismatch: "Amount differs",
    sumNotFound: "Waybill not found",
    sumOther: "Skipped",
    sumMissing: "Not in the statement",
    difference: "Difference against what is due: {amount}",
    missingNote: "{orders} delivered, worth {amount}, are not in this statement — the courier is still holding them.",
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
    not_settleable: "Not a delivered, unpaid cash-on-delivery order",
    not_found: "Waybill not found",
    duplicate: "Repeated in the file",
    invalid: "Unreadable row",
    allGood: "Every row matches an order and its amount.",
  },
  ar: {
    importTitle: "استورد كشف شركة الشحن",
    importDesc: "ارفع الكشف اللي شركة الشحن بعتته مع التحويل. كل بوليصة بتتطابق مع الأوردر بتاعها، والفروق بتتعرض قبل ما أي حاجة تتحفظ.",
    columns: "ملف Excel (.xlsx) أو CSV من شركة الشحن زي ما وصلك: عمود لرقم البوليصة وعمود للمبلغ المحصّل، وعمود المصاريف لو موجود. سطور العنوان فوق الجدول وسطر الإجمالي بنعدّيهم.",
    courier: "شركة الشحن",
    chooseCourier: "اختار شركة الشحن",
    courierMissing: "اختار أنهي شركة شحن بعتت الكشف ده.",
    chooseFile: "اختار ملف الكشف",
    changeFile: "اختار ملف تاني",
    reference: "مرجع الكشف",
    check: "طابق البوالص",
    checking: "بنطابق…",
    create: "اعمل تسوية بـ {orders}",
    creating: "بنحفظ…",
    created: "اتعملت مسودة تسوية من الكشف.",
    fileTooBig: "الملف أكبر من ميجابايت واحد. نزّل فترة أقصر وجرّب تاني.",
    sumOk: "مطابق",
    sumMismatch: "المبلغ مختلف",
    sumNotFound: "بوليصة مش موجودة",
    sumOther: "اتعدّى",
    sumMissing: "مش في الكشف",
    difference: "الفرق عن المستحق: {amount}",
    missingNote: "{orders} اتسلّموا بقيمة {amount} مش موجودين في الكشف ده — لسه عند شركة الشحن.",
    discrepancies: "صفوف محتاجة مراجعة",
    line: "السطر",
    waybill: "البوليصة",
    order: "الأوردر",
    statementAmount: "الكشف",
    due: "المستحق",
    status: "النتيجة",
    ok: "مطابق",
    amount_mismatch: "المبلغ مختلف",
    already_settled: "اتسوّى قبل كده",
    not_settleable: "مش أوردر دفع عند الاستلام اتسلّم ولسه ما اتدفعش",
    not_found: "بوليصة مش موجودة",
    duplicate: "متكرر في الملف",
    invalid: "صف مش مقروء",
    allGood: "كل الصفوف مطابقة لأوردراتها ومبالغها.",
  },
} satisfies Messages;

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div data-slot="statement-stat" className="min-w-0 rounded-2xl bg-paper-sunken px-3 py-2">
      <p className="truncate text-xs leading-5 text-ink-soft">{label}</p>
      <p className={cn("text-lg leading-7 font-semibold tabular-nums", warn ? "text-danger" : "text-ink")}>{formatCount(value)}</p>
    </div>
  );
}

/**
 * «استورد كشف شركة الشحن»: the courier's own file becomes a draft settlement,
 * in a sheet over the page. Pick the courier and the file, match the waybills
 * (nothing is saved), read what differs, then create the draft — the same two
 * calls as before (`/statement/match`, then `/statement/import`).
 *
 * A `Modal`: the same pane as a sheet (a bottom sheet on the phone), which
 * also asks before a chosen file and a typed reference are thrown away.
 */
export function StatementImportSheet({
  open,
  onClose,
  workspaceId,
  carriers,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  /** Courier codes to offer (those with unsettled orders). */
  carriers: string[];
  onCreated: (settlementId: string) => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const input = useRef<HTMLInputElement>(null);
  const courierField = useRef<HTMLSelectElement>(null);
  const onlyCarrier = carriers.length === 1 ? (carriers[0] ?? "") : "";
  const [carrierCode, setCarrierCode] = useState(onlyCarrier);
  const [reference, setReference] = useState("");
  // The courier's file as it came (Excel or CSV), base64: the server reads it.
  const [fileBase64, setFileBase64] = useState("");
  const [fileName, setFileName] = useState("");
  const [report, setReport] = useState<StatementReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [courierError, setCourierError] = useState(false);
  const [busy, setBusy] = useState<"match" | "create" | null>(null);

  // The sheet opens clean every time.
  useEffect(() => {
    if (!open) return;
    setCarrierCode(onlyCarrier);
    setReference("");
    setFileBase64("");
    setFileName("");
    setReport(null);
    setError(null);
    setCourierError(false);
  }, [open, onlyCarrier]);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
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
    if (!carrierCode) {
      setCourierError(true);
      courierField.current?.focus();
      return;
    }
    setBusy("match");
    setError(null);
    try {
      setReport(await statementMatch(apiClient, workspaceId, { fileBase64, fileName, carrierCode }));
    } catch (err) {
      setError(errorMessage(err));
    }
    setBusy(null);
  }

  async function create() {
    setBusy("create");
    setError(null);
    try {
      const result = await statementImport(apiClient, workspaceId, { fileBase64, fileName, carrierCode, reference: reference.trim() || null });
      toast.success(t.created);
      onCreated(result.settlementId);
    } catch (err) {
      setError(errorMessage(err));
    }
    setBusy(null);
  }

  const s = report?.summary;
  const settleable = s ? s.ok + s.amountMismatch : 0;
  const money = (v: number | null | undefined) => (v === null || v === undefined ? "—" : formatMoney(v, report?.currency ?? "EGP"));
  const problems = report?.lines.filter((line) => line.status !== "ok") ?? [];
  const tone = (status: StatementLineStatus) =>
    status === "amount_mismatch" ? "warning" : status === "not_found" || status === "invalid" ? "danger" : "neutral";

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={t.importTitle}
      description={t.importDesc}
      className="max-w-3xl"
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose} disabled={busy !== null}>
            {common.cancel}
          </Button>
          {report && settleable > 0 ? (
            <Button type="button" className="rounded-full px-5" onClick={() => void create()} disabled={busy !== null}>
              {busy === "create" ? t.creating : fmt(t.create, { orders: countOf("order", settleable) })}
            </Button>
          ) : (
            <Button type="button" className="rounded-full px-5" onClick={() => void match()} disabled={busy !== null || !fileBase64}>
              {busy === "match" ? t.checking : t.check}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[13px] leading-5 text-pretty text-ink-soft">{t.columns}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t.courier} required error={courierError ? t.courierMissing : undefined}>
            {({ id, ...aria }) => (
              <Select
                id={id}
                ref={courierField}
                {...aria}
                className="h-11 md:h-10"
                value={carrierCode}
                onChange={(event) => {
                  setCarrierCode(event.target.value);
                  setCourierError(false);
                  setReport(null);
                }}
              >
                <option value="">{t.chooseCourier}</option>
                {carriers.map((code) => (
                  <option key={code} value={code}>
                    {providerName(code)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <TextField label={t.reference} dir="ltr" value={reference} maxLength={120} onChange={(event) => setReference(event.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={input}
            type="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => void onFile(event)}
          />
          <Button type="button" variant="outline" className="h-11 gap-2 rounded-full px-4" onClick={() => input.current?.click()}>
            <IconUpload className="size-4" aria-hidden />
            {fileName ? t.changeFile : t.chooseFile}
          </Button>
          {fileName && (
            <bdi dir="ltr" className="min-w-0 truncate text-sm text-ink-soft">
              {fileName}
            </bdi>
          )}
        </div>
        {error && <Alert variant="danger">{error}</Alert>}

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
                {t.difference.split("{amount}")[0]}
                <bdi dir="ltr" className="tabular-nums">
                  {money(s.differenceAmount)}
                </bdi>
              </p>
            )}
            {s.missingOrders > 0 && (
              <p className="text-sm leading-6 text-ink-soft">
                {fmt(t.missingNote, { orders: countOf("order", s.missingOrders), amount: money(s.missingAmount) })}
              </p>
            )}
            {problems.length === 0 ? (
              <p className="text-sm font-medium text-success">{t.allGood}</p>
            ) : (
              <div>
                <p className="mb-1.5 text-sm font-medium text-ink">{t.discrepancies}</p>
                {/* Six columns do not fit a phone: the table scrolls inside its own box, never the sheet. */}
                <div className="max-h-64 overflow-auto rounded-2xl ring-1 ring-line">
                  <table className="w-full min-w-[36rem] text-[13px]">
                    <thead>
                      <tr className="border-b border-line text-xs text-ink-soft">
                        <th className="px-3 py-2 text-start font-medium">{t.line}</th>
                        <th className="px-3 py-2 text-start font-medium">{t.waybill}</th>
                        <th className="px-3 py-2 text-start font-medium">{t.order}</th>
                        <th className="px-3 py-2 text-end font-medium">{t.statementAmount}</th>
                        <th className="px-3 py-2 text-end font-medium">{t.due}</th>
                        <th className="px-3 py-2 text-start font-medium">{t.status}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {problems.map((line) => (
                        <tr key={line.line} className="border-b border-line last:border-b-0">
                          <td className="px-3 py-2 tabular-nums">{formatCount(line.line)}</td>
                          <td className="px-3 py-2">
                            <bdi dir="ltr">{line.waybill || "—"}</bdi>
                          </td>
                          <td className="px-3 py-2">
                            <bdi dir="ltr">{line.orderNumber ?? "—"}</bdi>
                          </td>
                          <td className="px-3 py-2 text-end tabular-nums">
                            <bdi dir="ltr">{money(line.statementAmount)}</bdi>
                          </td>
                          <td className="px-3 py-2 text-end tabular-nums">
                            <bdi dir="ltr">{money(line.dueAmount)}</bdi>
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge value={line.status} tone={tone(line.status)} text={t[line.status]} />
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
