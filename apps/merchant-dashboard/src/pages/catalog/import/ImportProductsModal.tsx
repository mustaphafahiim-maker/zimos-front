import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Download, FileUp, Pause, Play, Upload } from "lucide-react";
import { Button, Progress, Stepper, cn } from "@store-builder/ui";
import type { Product } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage } from "@/lib/errors";
import { Modal } from "@/components/Modal";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { downloadCsv, parseCsvRecords, readCsvFile, type CsvRecord } from "./csv";
import {
  FIELD_KEYS,
  MAX_FILE_BYTES,
  REQUIRED_FIELDS,
  TEMPLATE_ROWS,
  autoMap,
  buildImportPlan,
  buildUpdatePayload,
  cell,
  missingRequired,
  missingVariants,
  type FieldKey,
  type ImportPlan,
  type Mapping,
  type PlannedProduct,
} from "./productImport";

const STRINGS = {
  en: {
    title: "Import products from CSV",
    description: "Create or update products and variants in bulk.",
    stepUpload: "Upload",
    stepMap: "Map columns",
    stepValidate: "Validate",
    stepImport: "Import",
    dropHere: "Drag a CSV file here, or",
    chooseFile: "choose a file",
    fileHint: "CSV (UTF-8), up to 5 MB.",
    downloadTemplate: "Download template",
    groupingHelp:
      "One row per variant. Rows that share the same handle become variants of one product — fill the product name, description, status and tags on the first row; later rows only need option values, SKU, price and stock. Prices are in pounds (e.g. 299.50).",
    errNotCsv: "Please choose a .csv file.",
    errTooLarge: "The file is larger than 5 MB.",
    errEmpty: "The file has no data rows.",
    errRead: "Couldn't read the file.",
    fileRows: "{file} — {rows} data rows",
    mapHelp: "We matched your columns automatically. Check them and fix any that are wrong.",
    notMapped: "— Not imported —",
    required: "required",
    missingRequired: "Map the required columns: {fields}",
    preview: "Preview (first 5 rows)",
    back: "Back",
    next: "Next",
    validating: "Checking your file against your catalog…",
    summaryValid: "{count} products ready to import",
    summaryInvalid: "{count} products have errors and will be skipped",
    errorsTitle: "Errors by row",
    colRow: "Row",
    colColumn: "Column",
    colMessage: "Problem",
    moreErrors: "…and {count} more (download the error report for the full list).",
    fixAndReupload: "Fix the file and re-upload",
    existingTitle: "Already in your catalog",
    existingHelp:
      "These products match an existing handle. Update changes the name, description, status, tags and options and adds missing variants — existing variants, prices and stock are never deleted or changed.",
    skip: "Skip",
    update: "Update",
    allSkip: "Skip all",
    allUpdate: "Update all",
    imagesNote:
      "{count} image URLs found. Images can only be uploaded as files, so they won't be imported — upload them manually on each product.",
    startImport: "Import {count} products",
    nothingToImport: "Nothing to import — fix the file and re-upload.",
    importing: "Importing {done} of {total}…",
    paused: "Paused — {done} of {total} done.",
    pause: "Pause",
    resume: "Resume",
    cancel: "Cancel",
    cancelled: "Import cancelled.",
    finished: "Import finished.",
    created: "Created",
    updated: "Updated",
    skipped: "Skipped",
    failed: "Failed",
    failuresTitle: "Problems",
    imagesNotImported: "Images not imported — upload manually",
    downloadReport: "Download error report",
    done: "Done",
    close: "Close",
    variantFailed: "Variant on row {row} failed: {message}",
    cancelledItem: "Not imported (cancelled).",
    skippedExisting: "Skipped — product already exists.",
  },
  ar: {
    title: "استيراد المنتجات من ملف CSV",
    description: "أنشئ أو حدّث المنتجات والمتغيّرات دفعة واحدة.",
    stepUpload: "رفع الملف",
    stepMap: "ربط الأعمدة",
    stepValidate: "التحقق",
    stepImport: "الاستيراد",
    dropHere: "اسحب ملف CSV هنا، أو",
    chooseFile: "اختر ملفًا",
    fileHint: "ملف CSV بترميز UTF-8، حتى 5 ميجابايت.",
    downloadTemplate: "تنزيل القالب",
    groupingHelp:
      "صف واحد لكل متغيّر. الصفوف التي تشترك في نفس المعرّف (handle) تصبح متغيّرات لمنتج واحد — اكتب اسم المنتج والوصف والحالة والوسوم في الصف الأول، والصفوف التالية تحتاج فقط قيم الخيارات وSKU والسعر والمخزون. الأسعار بالجنيه (مثال: 299.50).",
    errNotCsv: "يُرجى اختيار ملف بصيغة ‎.csv.",
    errTooLarge: "حجم الملف أكبر من 5 ميجابايت.",
    errEmpty: "لا يحتوي الملف على صفوف بيانات.",
    errRead: "تعذّرت قراءة الملف.",
    fileRows: "{file} — {rows} صف بيانات",
    mapHelp: "طابقنا أعمدتك تلقائيًا. راجعها وصحّح أي عمود غير صحيح.",
    notMapped: "— لا يُستورد —",
    required: "مطلوب",
    missingRequired: "اربط الأعمدة المطلوبة: {fields}",
    preview: "معاينة (أول 5 صفوف)",
    back: "رجوع",
    next: "التالي",
    validating: "نراجع ملفك مقارنةً بكتالوجك…",
    summaryValid: "{count} منتج جاهز للاستيراد",
    summaryInvalid: "{count} منتج به أخطاء وسيتم تخطيه",
    errorsTitle: "الأخطاء حسب الصف",
    colRow: "الصف",
    colColumn: "العمود",
    colMessage: "المشكلة",
    moreErrors: "…و{count} أخطاء أخرى (نزّل تقرير الأخطاء للقائمة الكاملة).",
    fixAndReupload: "صحّح الملف وأعد رفعه",
    existingTitle: "موجودة بالفعل في كتالوجك",
    existingHelp:
      "هذه المنتجات تطابق معرّفًا موجودًا. التحديث يغيّر الاسم والوصف والحالة والوسوم والخيارات ويضيف المتغيّرات الناقصة — لا تُحذف المتغيّرات الحالية ولا تتغيّر أسعارها أو مخزونها.",
    skip: "تخطٍّ",
    update: "تحديث",
    allSkip: "تخطي الكل",
    allUpdate: "تحديث الكل",
    imagesNote:
      "وُجد {count} رابط صورة. يمكن رفع الصور كملفات فقط، لذلك لن تُستورد — ارفعها يدويًا في كل منتج.",
    startImport: "استيراد {count} منتج",
    nothingToImport: "لا يوجد ما يُستورد — صحّح الملف وأعد رفعه.",
    importing: "جارٍ استيراد {done} من {total}…",
    paused: "متوقف مؤقتًا — تم {done} من {total}.",
    pause: "إيقاف مؤقت",
    resume: "استئناف",
    cancel: "إلغاء",
    cancelled: "تم إلغاء الاستيراد.",
    finished: "اكتمل الاستيراد.",
    created: "تم إنشاؤه",
    updated: "تم تحديثه",
    skipped: "تم تخطيه",
    failed: "فشل",
    failuresTitle: "المشكلات",
    imagesNotImported: "لم تُستورد الصور — ارفعها يدويًا",
    downloadReport: "تنزيل تقرير الأخطاء",
    done: "تم",
    close: "إغلاق",
    variantFailed: "فشل المتغيّر في الصف {row}: {message}",
    cancelledItem: "لم يُستورد (أُلغي).",
    skippedExisting: "تم التخطي — المنتج موجود بالفعل.",
  },
};

const FIELD_LABELS: Record<"en" | "ar", Record<FieldKey, string>> = {
  en: {
    handle: "Handle",
    name: "Name",
    description: "Description",
    status: "Status",
    option1_name: "Option 1 name",
    option1_value: "Option 1 value",
    option2_name: "Option 2 name",
    option2_value: "Option 2 value",
    option3_name: "Option 3 name",
    option3_value: "Option 3 value",
    sku: "SKU",
    price: "Price",
    compare_at_price: "Compare-at price",
    cost: "Cost",
    stock: "Stock",
    image_url: "Image URL",
    tags: "Tags",
  },
  ar: {
    handle: "المعرّف (handle)",
    name: "الاسم",
    description: "الوصف",
    status: "الحالة",
    option1_name: "اسم الخيار 1",
    option1_value: "قيمة الخيار 1",
    option2_name: "اسم الخيار 2",
    option2_value: "قيمة الخيار 2",
    option3_name: "اسم الخيار 3",
    option3_value: "قيمة الخيار 3",
    sku: "SKU",
    price: "السعر",
    compare_at_price: "السعر قبل الخصم",
    cost: "التكلفة",
    stock: "المخزون",
    image_url: "رابط الصورة",
    tags: "الوسوم",
  },
};

type Decision = "skip" | "update";
type Outcome = "created" | "updated" | "skipped" | "failed";

interface ReportLine {
  row: string;
  handle: string;
  name: string;
  type: "validation" | "product" | "variant" | "image" | "skipped";
  message: string;
}

interface RunState {
  total: number;
  done: number;
  counts: Record<Outcome, number>;
  lines: ReportLine[];
  status: "running" | "paused" | "cancelled" | "finished";
}

const MAX_ERRORS_SHOWN = 100;

async function fetchAllProducts(workspaceId: string): Promise<Product[]> {
  const all: Product[] = [];
  let cursor: string | undefined;
  do {
    const page = await apiClient.listProducts(workspaceId, { limit: 200, cursor });
    all.push(...page.products);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return all;
}

export function ImportProductsModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const labels = FIELD_LABELS[locale];
  const workspaceId = useWorkspaceId();

  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<CsvRecord[]>([]);
  const [mapping, setMapping] = useState<Mapping>(() => autoMap([]));
  const [validating, setValidating] = useState(false);
  const [validateError, setValidateError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [run, setRun] = useState<RunState | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const pausedRef = useRef(false);
  const cancelRef = useRef(false);
  const resumeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setFileName("");
    setFileError(null);
    setHeaders([]);
    setRecords([]);
    setPlan(null);
    setDecisions({});
    setRun(null);
    setValidateError(null);
  }, [open]);

  const running = run?.status === "running" || run?.status === "paused";

  function reset() {
    setStep(0);
    setPlan(null);
    setRun(null);
    setFileName("");
    setRecords([]);
    setHeaders([]);
  }

  async function acceptFile(file: File | undefined) {
    if (!file) return;
    setFileError(null);
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") return setFileError(t.errNotCsv);
    if (file.size > MAX_FILE_BYTES) return setFileError(t.errTooLarge);
    try {
      const text = await readCsvFile(file);
      const parsed = parseCsvRecords(text);
      if (parsed.length < 2) return setFileError(t.errEmpty);
      const [header, ...data] = parsed;
      setHeaders(header.cells.map((h) => h.trim()));
      setRecords(data);
      setMapping(autoMap(header.cells));
      setFileName(file.name);
      setStep(1);
    } catch {
      setFileError(t.errRead);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void acceptFile(e.dataTransfer.files?.[0]);
  }

  async function validate() {
    setValidating(true);
    setValidateError(null);
    try {
      const existing = await fetchAllProducts(workspaceId);
      const next = buildImportPlan(records, mapping, existing);
      setPlan(next);
      setDecisions(Object.fromEntries(next.validProducts.filter((p) => p.existing).map((p) => [p.key, "skip" as Decision])));
      setStep(2);
    } catch (err) {
      setValidateError(getErrorMessage(err));
    } finally {
      setValidating(false);
    }
  }

  const missing = missingRequired(mapping);
  const imageCount = plan ? plan.validProducts.reduce((n, p) => n + p.imageUrls.length, 0) : 0;
  const existingValid = plan?.validProducts.filter((p) => p.existing) ?? [];

  function validationLines(): ReportLine[] {
    if (!plan) return [];
    return plan.invalidProducts.flatMap((p) =>
      p.issues.map((i) => ({
        row: String(i.row),
        handle: p.handle,
        name: p.payload.name,
        type: "validation" as const,
        message: `${i.field ? labels[i.field] + ": " : ""}${i.message[locale]}`,
      }))
    );
  }

  function waitWhilePaused(): Promise<void> {
    if (!pausedRef.current) return Promise.resolve();
    return new Promise((resolve) => {
      resumeRef.current = resolve;
    });
  }

  async function startImport() {
    if (!plan) return;
    const queue = plan.validProducts;
    pausedRef.current = false;
    cancelRef.current = false;
    const state: RunState = {
      total: queue.length,
      done: 0,
      counts: { created: 0, updated: 0, skipped: 0, failed: 0 },
      lines: [],
      status: "running",
    };
    const push = () => setRun({ ...state, counts: { ...state.counts }, lines: [...state.lines] });
    setStep(3);
    push();

    const line = (p: PlannedProduct, type: ReportLine["type"], message: string, row = p.rows.join(" ")) =>
      state.lines.push({ row, handle: p.handle, name: p.payload.name, type, message });

    const createVariants = async (p: PlannedProduct, productId: string, variants = p.variants) => {
      let failures = 0;
      for (const v of variants) {
        try {
          await apiClient.createVariant(workspaceId, productId, v.payload);
        } catch (err) {
          failures++;
          line(p, "variant", fmt(t.variantFailed, { row: v.row, message: getErrorMessage(err) }), String(v.row));
        }
      }
      return failures;
    };

    for (const p of queue) {
      await waitWhilePaused();
      if (cancelRef.current) break;
      try {
        if (p.existing && decisions[p.key] !== "update") {
          state.counts.skipped++;
          line(p, "skipped", t.skippedExisting);
        } else if (p.existing) {
          await apiClient.updateProduct(workspaceId, p.existing.id, buildUpdatePayload(p, p.existing));
          const fresh = await apiClient.getProduct(workspaceId, p.existing.id);
          const failures = await createVariants(p, p.existing.id, missingVariants(p, fresh.variants ?? []));
          state.counts.updated++;
          state.counts.failed += failures;
        } else {
          const product = await apiClient.createProduct(workspaceId, p.payload);
          const failures = await createVariants(p, product.id);
          state.counts.created++;
          state.counts.failed += failures;
        }
        if (decisions[p.key] !== "skip" || !p.existing)
          for (const url of p.imageUrls) line(p, "image", `${t.imagesNotImported}: ${url}`);
      } catch (err) {
        state.counts.failed++;
        line(p, "product", getErrorMessage(err));
      }
      state.done++;
      push();
    }

    if (cancelRef.current) {
      const remaining = queue.length - state.done;
      state.counts.skipped += remaining;
      for (const p of queue.slice(state.done)) line(p, "skipped", t.cancelledItem);
    }
    state.status = cancelRef.current ? "cancelled" : "finished";
    push();
    if (state.counts.created + state.counts.updated > 0) onImported();
  }

  function togglePause() {
    if (pausedRef.current) {
      pausedRef.current = false;
      resumeRef.current?.();
      resumeRef.current = null;
      setRun((r) => (r ? { ...r, status: "running" } : r));
    } else {
      pausedRef.current = true;
      setRun((r) => (r ? { ...r, status: "paused" } : r));
    }
  }

  function cancelRun() {
    cancelRef.current = true;
    if (pausedRef.current) togglePause();
  }

  function downloadReport() {
    const lines = [...validationLines(), ...(run?.lines ?? [])];
    downloadCsv("product-import-errors.csv", [
      ["row", "handle", "name", "type", "message"],
      ...lines.map((l) => [l.row, l.handle, l.name, l.type, l.message]),
    ]);
  }

  const steps = useMemo(
    () => [{ label: t.stepUpload }, { label: t.stepMap }, { label: t.stepValidate }, { label: t.stepImport }],
    [t]
  );

  const previewKeys = FIELD_KEYS.filter((k) => mapping[k] !== null);

  let footer: ReactNode = null;
  if (step === 1) {
    footer = (
      <>
        <Button variant="outline" onClick={reset}>
          {t.back}
        </Button>
        <Button onClick={validate} disabled={missing.length > 0 || validating}>
          {validating ? t.validating : t.next}
        </Button>
      </>
    );
  } else if (step === 2 && plan) {
    footer = (
      <>
        <Button variant="outline" onClick={() => setStep(1)}>
          {t.back}
        </Button>
        <Button onClick={startImport} disabled={plan.validProducts.length === 0}>
          {fmt(t.startImport, { count: plan.validProducts.length })}
        </Button>
      </>
    );
  } else if (step === 3 && run) {
    footer = running ? (
      <>
        <Button variant="outline" onClick={togglePause}>
          {run.status === "paused" ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
          {run.status === "paused" ? t.resume : t.pause}
        </Button>
        <Button variant="destructive" onClick={cancelRun}>
          {t.cancel}
        </Button>
      </>
    ) : (
      <>
        {(run.lines.some((l) => l.type !== "skipped") || (plan?.invalidProducts.length ?? 0) > 0) && (
          <Button variant="outline" onClick={downloadReport}>
            <Download className="size-4" aria-hidden />
            {t.downloadReport}
          </Button>
        )}
        <Button onClick={onClose}>{t.done}</Button>
      </>
    );
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!running) onClose();
      }}
      title={t.title}
      description={t.description}
      className="max-w-4xl"
      footer={footer}
    >
      <Stepper steps={steps} current={step} className="mb-5" />

      {step === 0 && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors",
              dragging ? "border-primary bg-primary-soft" : "border-line bg-paper"
            )}
          >
            <FileUp className="size-8 text-ink-muted" aria-hidden />
            <p className="text-sm text-ink">
              {t.dropHere}{" "}
              <button
                type="button"
                className="cursor-pointer font-medium text-primary hover:underline"
                onClick={() => inputRef.current?.click()}
              >
                {t.chooseFile}
              </button>
            </p>
            <p className="text-xs text-ink-soft">{t.fileHint}</p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label={t.chooseFile}
              onChange={(e) => {
                void acceptFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          {fileError && (
            <p role="alert" className="text-sm text-danger">
              {fileError}
            </p>
          )}
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-paper-raised p-4 sm:flex-row sm:items-start">
            <p className="flex-1 text-sm text-ink-soft">{t.groupingHelp}</p>
            <Button variant="outline" size="sm" onClick={() => downloadCsv("zimos-products-template.csv", TEMPLATE_ROWS)}>
              <Download className="size-4" aria-hidden />
              {t.downloadTemplate}
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            <bdi>{fmt(t.fileRows, { file: fileName, rows: records.length })}</bdi> · {t.mapHelp}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {FIELD_KEYS.map((key) => (
              <label key={key} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                <span className="text-ink">
                  {labels[key]}
                  {REQUIRED_FIELDS.includes(key) && <span className="ms-1 text-xs text-danger">({t.required})</span>}
                </span>
                <select
                  value={mapping[key] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [key]: e.target.value === "" ? null : Number(e.target.value) }))
                  }
                  className="max-w-[55%] rounded-md border border-line bg-paper-raised px-2 py-1 text-sm text-ink"
                >
                  <option value="">{t.notMapped}</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `#${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {missing.length > 0 && (
            <p role="alert" className="text-sm text-danger">
              {fmt(t.missingRequired, { fields: missing.map((k) => labels[k]).join("، ") })}
            </p>
          )}
          {validateError && (
            <p role="alert" className="text-sm text-danger">
              {validateError}
            </p>
          )}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">{t.preview}</h3>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-line bg-paper text-ink-soft">
                    <th className="px-2 py-2 text-start font-medium">{t.colRow}</th>
                    {previewKeys.map((k) => (
                      <th key={k} className="whitespace-nowrap px-2 py-2 text-start font-medium">
                        {labels[k]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 5).map((r) => (
                    <tr key={r.row} className="border-b border-line last:border-0">
                      <td className="px-2 py-1.5 text-ink-soft">{r.row}</td>
                      {previewKeys.map((k) => (
                        <td key={k} className="max-w-[180px] truncate px-2 py-1.5 text-ink">
                          <bdi>{cell(r, mapping, k)}</bdi>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {step === 2 && plan && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-success">
              <CheckCircle2 className="size-4" aria-hidden />
              {fmt(t.summaryValid, { count: plan.validProducts.length })}
            </span>
            {plan.invalidProducts.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-danger-soft px-3 py-1.5 text-danger">
                <AlertTriangle className="size-4" aria-hidden />
                {fmt(t.summaryInvalid, { count: plan.invalidProducts.length })}
              </span>
            )}
          </div>

          {plan.issues.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink">{t.errorsTitle}</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={downloadReport}>
                    <Download className="size-4" aria-hidden />
                    {t.downloadReport}
                  </Button>
                  <Button size="sm" variant="outline" onClick={reset}>
                    <Upload className="size-4" aria-hidden />
                    {t.fixAndReupload}
                  </Button>
                </div>
              </div>
              <div className="max-h-64 overflow-auto rounded-xl border border-line">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-paper">
                    <tr className="border-b border-line text-xs text-ink-soft">
                      <th className="px-3 py-2 text-start font-medium">{t.colRow}</th>
                      <th className="px-3 py-2 text-start font-medium">{t.colColumn}</th>
                      <th className="px-3 py-2 text-start font-medium">{t.colMessage}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.issues.slice(0, MAX_ERRORS_SHOWN).map((issue, i) => (
                      <tr key={i} className="border-b border-line last:border-0">
                        <td className="px-3 py-1.5 text-ink-soft">{issue.row}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-ink">{issue.field ? labels[issue.field] : "—"}</td>
                        <td className="px-3 py-1.5 text-danger">
                          <bdi>{issue.message[locale]}</bdi>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {plan.issues.length > MAX_ERRORS_SHOWN && (
                <p className="text-xs text-ink-soft">{fmt(t.moreErrors, { count: plan.issues.length - MAX_ERRORS_SHOWN })}</p>
              )}
            </div>
          )}

          {existingValid.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink">{t.existingTitle}</h3>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDecisions(Object.fromEntries(existingValid.map((p) => [p.key, "skip"])))}
                  >
                    {t.allSkip}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDecisions(Object.fromEntries(existingValid.map((p) => [p.key, "update"])))}
                  >
                    {t.allUpdate}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-ink-soft">{t.existingHelp}</p>
              <ul className="max-h-48 divide-y divide-line overflow-auto rounded-xl border border-line">
                {existingValid.map((p) => (
                  <li key={p.key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-ink">
                      <bdi>{p.payload.name}</bdi>{" "}
                      <span className="text-xs text-ink-soft">
                        · <bdi dir="ltr">{p.existing?.slug}</bdi>
                      </span>
                    </span>
                    <div role="group" className="flex shrink-0 gap-1 rounded-lg border border-line p-0.5">
                      {(["skip", "update"] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={decisions[p.key] === d}
                          onClick={() => setDecisions((prev) => ({ ...prev, [p.key]: d }))}
                          className={cn(
                            "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium",
                            decisions[p.key] === d ? "bg-primary-soft text-primary-dark" : "text-ink-soft hover:text-ink"
                          )}
                        >
                          {d === "skip" ? t.skip : t.update}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {imageCount > 0 && (
            <p className="flex items-start gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink-soft">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              {fmt(t.imagesNote, { count: imageCount })}
            </p>
          )}
          {plan.validProducts.length === 0 && <p className="text-sm text-danger">{t.nothingToImport}</p>}
        </div>
      )}

      {step === 3 && run && (
        <div className="space-y-4">
          <p className="text-sm text-ink" aria-live="polite">
            {run.status === "running"
              ? fmt(t.importing, { done: run.done, total: run.total })
              : run.status === "paused"
                ? fmt(t.paused, { done: run.done, total: run.total })
                : run.status === "cancelled"
                  ? t.cancelled
                  : t.finished}
          </p>
          <Progress
            value={run.done}
            max={run.total}
            tone={run.status === "finished" ? (run.counts.failed ? "warning" : "success") : "primary"}
            label={fmt(t.importing, { done: run.done, total: run.total })}
          />
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["created", "updated", "skipped", "failed"] as const).map((k) => (
              <div key={k} className="rounded-xl border border-line bg-paper px-3 py-2">
                <dt className="text-xs text-ink-soft">{t[k]}</dt>
                <dd className={cn("text-xl font-semibold", k === "failed" && run.counts.failed ? "text-danger" : "text-ink")}>
                  {run.counts[k]}
                </dd>
              </div>
            ))}
          </dl>
          {run.lines.some((l) => l.type !== "skipped") && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">{t.failuresTitle}</h3>
              <ul className="max-h-56 space-y-1 overflow-auto rounded-xl border border-line p-3 text-sm">
                {run.lines
                  .filter((l) => l.type !== "skipped")
                  .map((l, i) => (
                    <li key={i} className={l.type === "image" ? "text-ink-soft" : "text-danger"}>
                      <span className="text-ink">
                        <bdi>{l.name || l.handle}</bdi>
                      </span>{" "}
                      — <bdi>{l.message}</bdi>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
