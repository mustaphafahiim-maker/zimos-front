import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Alert, Button, Spinner, cn } from "@store-builder/ui";
import {
  CONTACT_IMPORT_MAX_BYTES,
  contactImport,
  contactImportTemplate,
  type ContactImportField,
  type ContactImportMode,
  type ContactImportResult,
  type ContactImportRowError,
} from "@store-builder/api-client";
import { DataState, SkeletonBar } from "@/components/DataState";
import { TextField } from "@/components/Field";
import { IconArrowLeft, IconArrowRight, IconCheck, IconDownload, IconInfo, IconSheet, IconSuccess, IconUpload } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Segmented } from "@/components/Segmented";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { pluralOf } from "@/lib/plural";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useIsPhone } from "@/pages/returns/rowkit/useScreen";

/**
 * Contacts → Import (frontend-handoff 187), in three short steps: the file
 * and what happens to contacts already in the store → the columns the server
 * matched → the review, and the import. The sheet is checked first (dryRun:
 * the same counts, nothing saved), then imported with the same file. The
 * template is fetched on arrival — it doubles as the check that this teammate
 * may import contacts (customers.manage), so a missing permission shows
 * before any file is chosen.
 */

/** The API takes sheets up to this many megabytes and rows. */
const MAX_MB = Math.round(CONTACT_IMPORT_MAX_BYTES / (1024 * 1024));
const MAX_ROWS = 5000;

const STRINGS = {
  en: {
    title: "Import contacts",
    description: "Add your customers from a CSV or Excel sheet. Check the file first, then import it.",
    back: "Contacts",
    stepsLabel: "Import steps",
    stepOf: "Step {n} of {total}: {name}",
    stepDone: "Step {n} of {total}: {name}, done",
    stepNumber: "{n}",
    stepFile: "File",
    stepColumns: "Columns",
    stepReview: "Review",
    fileTitle: "Choose the file",
    fileHint: "CSV or Excel (.xlsx), up to {mb} MB and {rows} rows. The first row names the columns: phone (required), and name, email, tags and marketing consent if you have them — in English or Arabic.",
    template: "Download the template",
    chooseFile: "Choose a file",
    changeFile: "Choose another file",
    noFile: "No file chosen yet",
    fileSize: "{size} KB",
    existingTitle: "Contacts already in your store",
    update: "Update them",
    updateHint: "Their name, email and marketing consent come from the sheet, and the sheet's tags are added to theirs.",
    skip: "Leave them",
    skipHint: "A phone number already in your store is left exactly as it is.",
    tags: "Add these tags to everyone",
    tagsHint: "Optional. Separate them with commas, e.g. imported-oct.",
    consent: "Only mark marketing consent yes for people who agreed to receive your offers.",
    needFile: "Choose a file first.",
    check: "Check the file",
    checking: "Checking the file…",
    next: "Next: review",
    backStep: "Back",
    import: "Import",
    importing: "Importing…",
    checkNote: "Nothing is saved yet.",
    doneTitle: "Done — your contacts are in",
    rowsInFile: "The file has {rows}. If you import it:",
    rowsDone: "From {rows} in the file:",
    nothingToImport: "Nothing new to import from this file.",
    columnsTitle: "Columns we matched",
    columnsHint: "A column missing or matched wrong? Rename it in your sheet to the name in the template, then choose the file again.",
    notFound: "Not in the file",
    errorsTitle: "Rows to look at",
    moreErrors_one: "…and 1 more not shown.",
    moreErrors_other: "…and {n} more not shown.",
    rowN: "Row {n}",
    field_phone: "Phone",
    field_fullName: "Name",
    field_email: "Email",
    field_tags: "Tags",
    field_consent: "Marketing consent",
    field_marketing_consent: "Marketing consent",
    problemPhone: "is not a phone number — this row is not imported.",
    problemEmail: "is not an email — the row is imported without it.",
    problemConsent: "— write yes or no; consent is left as it was.",
    tileCreated: "New contacts",
    tileUpdated: "Updated",
    tileSkipped: "Left as they are",
    tileUnchanged: "Already up to date",
    tileInvalid: "Rows not imported",
    backToList: "Back to contacts",
    another: "Import another file",
    tooLarge: "The file is larger than {mb} MB. Split it into smaller files and import them one by one.",
    invalidFile:
      "We couldn't read this file or find its phone column. The first row must name the columns, with one for the phone (phone or الموبايل) — download the template and follow it.",
    sep: ", ",
    created_one: "1 new contact",
    created_other: "{n} new contacts",
    updatedDry_one: "1 will be updated",
    updatedDry_other: "{n} will be updated",
    updatedDone_one: "1 updated",
    updatedDone_other: "{n} updated",
    skippedDry_one: "1 will be skipped",
    skippedDry_other: "{n} will be skipped",
    skippedDone_one: "1 skipped",
    skippedDone_other: "{n} skipped",
    unchanged_one: "1 already up to date",
    unchanged_other: "{n} already up to date",
    invalid_one: "1 row without a valid phone",
    invalid_other: "{n} rows without a valid phone",
    rows_one: "1 row",
    rows_other: "{n} rows",
  },
  ar: {
    title: "استيراد العملاء",
    description: "ضيف عملاءك من شيت CSV أو Excel. راجع الملف الأول، وبعدين استورده.",
    back: "العملاء",
    stepsLabel: "خطوات الاستيراد",
    stepOf: "الخطوة {n} من {total}: {name}",
    stepDone: "الخطوة {n} من {total}: {name}، خلصت",
    stepNumber: "{n}",
    stepFile: "الملف",
    stepColumns: "الأعمدة",
    stepReview: "المراجعة",
    fileTitle: "اختار الملف",
    fileHint: "CSV أو Excel (.xlsx)، لحد {mb} ميجا و{rows} صف. أول صف فيه أسامي الأعمدة: الموبايل (لازم)، والاسم والإيميل والتاجات وموافقة التسويق لو عندك — بالعربي أو بالإنجليزي.",
    template: "نزّل النموذج",
    chooseFile: "اختار ملف",
    changeFile: "اختار ملف تاني",
    noFile: "لسه مختارتش ملف",
    fileSize: "{size} كيلوبايت",
    existingTitle: "العملاء اللي موجودين عندك",
    update: "حدّثهم",
    updateHint: "الاسم والإيميل وموافقة التسويق بيتاخدوا من الشيت، وتاجات الشيت بتتضاف على تاجاتهم.",
    skip: "سيبهم زي ما هم",
    skipHint: "أي رقم موجود عندك في المتجر مش هيتغير فيه حاجة.",
    tags: "ضيف التاجات دي للكل",
    tagsHint: "اختياري. افصل بينها بفاصلة، زي: imported-oct",
    consent: "علّم موافقة التسويق بـ«نعم» بس للناس اللي وافقوا يستقبلوا عروضك.",
    needFile: "اختار ملف الأول.",
    check: "راجع الملف",
    checking: "بنراجع الملف…",
    next: "التالي: المراجعة",
    backStep: "رجوع",
    import: "استورد",
    importing: "بنستورد…",
    checkNote: "لسه محدش اتحفظ.",
    doneTitle: "خلصنا — عملاءك اتضافوا",
    rowsInFile: "الملف فيه {rows}. لو استوردته:",
    rowsDone: "من {rows} في الملف:",
    nothingToImport: "مفيش حاجة جديدة تتضاف من الملف ده.",
    columnsTitle: "الأعمدة اللي لقيناها",
    columnsHint: "فيه عمود ناقص أو متظبطش صح؟ غيّر اسمه في الشيت لنفس الاسم اللي في النموذج، واختار الملف تاني.",
    notFound: "مش موجود في الملف",
    errorsTitle: "صفوف محتاجة تبص عليها",
    moreErrors_one: "…وكمان واحدة مش ظاهرة.",
    moreErrors_two: "…وكمان اتنين مش ظاهرين.",
    moreErrors_few: "…وكمان {n} مش ظاهرين.",
    moreErrors_other: "…وكمان {n} مش ظاهرين.",
    rowN: "صف {n}",
    field_phone: "الموبايل",
    field_fullName: "الاسم",
    field_email: "الإيميل",
    field_tags: "التاجات",
    field_consent: "موافقة التسويق",
    field_marketing_consent: "موافقة التسويق",
    problemPhone: "مش رقم موبايل صحيح — الصف ده مش بيتضاف.",
    problemEmail: "مش إيميل صحيح — الصف بيتضاف من غيره.",
    problemConsent: "— اكتب نعم أو لا؛ الموافقة بتفضل زي ما هي.",
    tileCreated: "عملاء جداد",
    tileUpdated: "تحديث",
    tileSkipped: "متسابين زي ما هم",
    tileUnchanged: "مفيهمش جديد",
    tileInvalid: "صفوف مش هتتضاف",
    backToList: "ارجع لقايمة العملاء",
    another: "استورد ملف تاني",
    tooLarge: "الملف أكبر من {mb} ميجا. قسّمه لملفات أصغر واستوردهم واحد ورا التاني.",
    invalidFile:
      "معرفناش نقرا الملف أو نلاقي عمود الموبايل. أول صف لازم يبقى أسامي الأعمدة، ومنها عمود للموبايل (الموبايل أو phone) — نزّل النموذج وامشي عليه.",
    sep: "، ",
    created_zero: "مفيش عملاء جداد",
    created_one: "عميل جديد واحد",
    created_two: "عميلين جداد",
    created_few: "{n} عملاء جداد",
    created_other: "{n} عميل جديد",
    updatedDry_zero: "محدش هيتحدّث",
    updatedDry_one: "عميل واحد هيتحدّث",
    updatedDry_two: "عميلين هيتحدّثوا",
    updatedDry_few: "{n} عملاء هيتحدّثوا",
    updatedDry_other: "{n} عميل هيتحدّث",
    updatedDone_zero: "محدش اتحدّث",
    updatedDone_one: "عميل واحد اتحدّث",
    updatedDone_two: "عميلين اتحدّثوا",
    updatedDone_few: "{n} عملاء اتحدّثوا",
    updatedDone_other: "{n} عميل اتحدّث",
    skippedDry_zero: "محدش هيتساب",
    skippedDry_one: "عميل واحد هيتساب زي ما هو",
    skippedDry_two: "عميلين هيتسابوا زي ما هم",
    skippedDry_few: "{n} عملاء هيتسابوا زي ما هم",
    skippedDry_other: "{n} عميل هيتساب زي ما هو",
    skippedDone_zero: "محدش اتساب",
    skippedDone_one: "عميل واحد اتساب زي ما هو",
    skippedDone_two: "عميلين اتسابوا زي ما هم",
    skippedDone_few: "{n} عملاء اتسابوا زي ما هم",
    skippedDone_other: "{n} عميل اتساب زي ما هو",
    unchanged_one: "عميل واحد مفيهوش جديد",
    unchanged_two: "عميلين مفيهمش جديد",
    unchanged_few: "{n} عملاء مفيهمش جديد",
    unchanged_other: "{n} عميل مفيهوش جديد",
    invalid_one: "صف واحد من غير رقم صحيح",
    invalid_two: "صفين من غير رقم صحيح",
    invalid_few: "{n} صفوف من غير رقم صحيح",
    invalid_other: "{n} صف من غير رقم صحيح",
    rows_one: "صف واحد",
    rows_two: "صفين",
    rows_few: "{n} صفوف",
    rows_other: "{n} صف",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

const FIELDS: ContactImportField[] = ["phone", "fullName", "email", "tags", "consent"];

type Step = 0 | 1 | 2;
const STEPS: readonly Step[] = [0, 1, 2];
type StepState = "current" | "done" | "todo";

const PILL = "rounded-full px-5";
/** A pane of the page: solid on its own, a glass pane under the glass layer (`data-slot="card"`). */
const PANE = "rounded-[var(--radius-card)] bg-card p-4 text-card-foreground shadow-[var(--shadow-card)] ring-1 ring-line sm:p-5";

// The stepper wears the slots of the create-order stepper (glass/order-create.css), so the two read as one control.
const STEP_PILL =
  "relative inline-flex h-9 min-w-0 cursor-pointer items-center gap-1.5 rounded-full ps-1.5 pe-3 text-[13px] leading-none font-semibold select-none " +
  "before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] " +
  "transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100 " +
  "disabled:cursor-default disabled:active:scale-100";
const STEP_STATE: Record<StepState, string> = {
  current: "bg-primary text-primary-foreground forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]",
  done: "text-ink hover:bg-ink/6",
  todo: "text-ink-soft enabled:hover:bg-ink/6",
};
const BEAD_STATE: Record<StepState, string> = {
  current: "bg-primary-foreground text-primary",
  done: "bg-success-soft text-success",
  todo: "bg-paper-sunken text-ink-soft",
};

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ContactImportPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const phone = useIsPhone();
  const fileInputId = useId();
  // The template, fetched up front: loading, no-permission and error states for the page.
  const template = useAsync(() => contactImportTemplate(apiClient, workspaceId), [workspaceId]);

  const [step, setStep] = useState<Step>(0);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [mode, setMode] = useState<ContactImportMode>("update");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState<"check" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<ContactImportResult | null>(null);
  const [done, setDone] = useState<ContactImportResult | null>(null);
  // A new step or the final summary starts at its top (the button that led here sits low on a phone).
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (step > 0 || done) topRef.current?.scrollIntoView({ block: "start" });
  }, [step, done]);

  const tooLarge = fmt(t.tooLarge, { mb: MAX_MB });
  const fileErrors = { INVALID_FILE: t.invalidFile, FILE_TOO_LARGE: tooLarge };
  // The furthest step that can be opened: the last two need a check of what is on screen now.
  const reached: Step = checked ? 2 : 0;

  /** Anything that changes what would be imported makes the last check stale. */
  function changed() {
    setChecked(null);
    setError(null);
  }

  function pick(next: File | null) {
    changed();
    if (next && next.size > CONTACT_IMPORT_MAX_BYTES) {
      setFile(null);
      setFileKey((k) => k + 1);
      setError(tooLarge);
      return;
    }
    setFile(next);
  }

  async function run(dryRun: boolean) {
    if (!file) {
      setError(t.needFile);
      document.getElementById(fileInputId)?.focus();
      return;
    }
    setBusy(dryRun ? "check" : "import");
    setError(null);
    try {
      const result = await contactImport(apiClient, workspaceId, file, { mode, tags, dryRun });
      if (dryRun) {
        setChecked(result);
        setStep(1);
      } else {
        setDone(result);
      }
    } catch (err) {
      setError(errorMessage(err, fileErrors));
      // The file or the options have to change: back to where they are chosen.
      if (!dryRun) setChecked(null);
      setStep(0);
    } finally {
      setBusy(null);
    }
  }

  function restart() {
    setFile(null);
    setFileKey((k) => k + 1);
    setTags("");
    setMode("update");
    setChecked(null);
    setDone(null);
    setError(null);
    setStep(0);
  }

  const names: Record<Step, string> = { 0: t.stepFile, 1: t.stepColumns, 2: t.stepReview };
  const willImport = checked ? checked.created + checked.updated : 0;

  return (
    <div className="max-w-3xl">
      {/* A phone keeps the first screen for the steps and the file: the sentence is for wider screens. */}
      <PageHeader title={t.title} description={phone ? undefined : t.description} back={{ to: "/customers", label: t.back }} />

      <DataState
        loading={template.loading}
        error={template.error}
        onRetry={() => void template.refresh()}
        skeleton={
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <SkeletonBar className="h-9 w-24 rounded-full" />
              <SkeletonBar className="h-0.5 flex-1" />
              <SkeletonBar className="h-9 w-24 rounded-full" />
              <SkeletonBar className="h-0.5 flex-1" />
              <SkeletonBar className="h-9 w-24 rounded-full" />
            </div>
            <div className={PANE}>
              <SkeletonBar className="h-4 w-2/5" />
              <SkeletonBar className="mt-4 w-11/12" />
              <SkeletonBar className="mt-3 w-3/5" />
              <SkeletonBar className="mt-5 h-11 w-36 rounded-full" />
            </div>
          </div>
        }
      >
        <div ref={topRef} className="scroll-mt-24 space-y-4">
          {done ? (
            <section data-slot="card" className={cn(PANE, "space-y-4")}>
              <div className="flex items-start gap-3">
                <span data-slot="import-done-icon" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                  <IconSuccess className="size-6" weight="fill" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[17px] leading-6 font-semibold text-ink">{t.doneTitle}</h2>
                  <p className="mt-0.5 text-sm leading-6 text-ink-soft">{fmt(t.rowsDone, { rows: pluralOf(t, "rows", done.total) })}</p>
                  <p className="text-[15px] leading-6 font-medium text-ink">{summary(t, done, mode)}</p>
                </div>
              </div>
              <Tiles t={t} result={done} mode={mode} />
              <RowErrors t={t} result={done} />
              <div className="flex flex-wrap gap-2">
                <Button asChild className={cn(PILL, "min-h-11 max-sm:w-full")}>
                  <ViewLink to="/customers">{t.backToList}</ViewLink>
                </Button>
                <Button type="button" variant="outline" className={cn(PILL, "min-h-11 max-sm:w-full")} onClick={restart}>
                  {t.another}
                </Button>
              </div>
            </section>
          ) : (
            <>
              <nav aria-label={t.stepsLabel} data-slot="order-steps">
                <ol className="flex items-center">
                  {STEPS.map((at) => {
                    const current = at === step;
                    const state: StepState = current ? "current" : at < step ? "done" : "todo";
                    return (
                      <li key={at} className={cn("flex min-w-0 items-center", at > 0 && "flex-1")}>
                        {at > 0 && (
                          <span
                            aria-hidden
                            data-slot="order-step-line"
                            data-done={at <= step ? "" : undefined}
                            className={cn(
                              "mx-1 h-0.5 min-w-2 flex-1 rounded-full transition-[background-color] duration-[var(--dur-move)] ease-[var(--ease-out)] motion-reduce:transition-none",
                              at <= step ? "bg-success/60" : "bg-line"
                            )}
                          />
                        )}
                        <button
                          type="button"
                          data-slot="order-step"
                          data-state={state}
                          aria-current={current ? "step" : undefined}
                          aria-label={fmt(state === "done" ? t.stepDone : t.stepOf, { n: at + 1, total: STEPS.length, name: names[at] })}
                          disabled={at > reached || busy !== null}
                          onClick={() => setStep(at)}
                          className={cn(STEP_PILL, STEP_STATE[state])}
                        >
                          <span
                            data-slot="order-step-bead"
                            className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs leading-none font-semibold tabular-nums", BEAD_STATE[state])}
                          >
                            {state === "done" ? <IconCheck className="size-3.5" weight="bold" aria-hidden /> : fmt(t.stepNumber, { n: at + 1 })}
                          </span>
                          <span className="min-w-0 truncate">{names[at]}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>

              {error && (
                <Alert variant="danger" role="alert">
                  {error}
                </Alert>
              )}

              {step === 0 && (
                <>
                  <section data-slot="card" className={PANE}>
                    <h2 className="text-[15px] font-semibold text-ink">{t.fileTitle}</h2>
                    <p className="mt-1 text-[13px] leading-5 text-ink-soft">{fmt(t.fileHint, { mb: MAX_MB, rows: MAX_ROWS })}</p>
                    {/* The native picker's own words follow the browser's language; the visible control is ours. */}
                    <input
                      key={fileKey}
                      id={fileInputId}
                      type="file"
                      accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      disabled={busy !== null}
                      onChange={(e) => pick(e.target.files?.[0] ?? null)}
                      className="peer sr-only"
                    />
                    <label
                      htmlFor={fileInputId}
                      data-slot="import-file"
                      data-chosen={file ? "" : undefined}
                      className={cn(
                        "mt-4 flex min-h-20 cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-paper-sunken px-4 py-3",
                        "transition-[background-color,border-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:border-primary/50 motion-safe:active:scale-[0.99] motion-reduce:transition-none",
                        "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:pointer-events-none peer-disabled:opacity-50"
                      )}
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                        <IconSheet className="size-6" weight="duotone" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        {file ? (
                          <>
                            <bdi dir="ltr" className="block truncate text-start text-[15px] leading-6 font-medium text-ink">
                              {file.name}
                            </bdi>
                            <span className="block text-xs leading-5 text-ink-soft tabular-nums">
                              {fmt(t.fileSize, { size: formatCount(Math.max(1, Math.round(file.size / 1024))) })}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="block text-[15px] leading-6 font-semibold text-ink">{t.chooseFile}</span>
                            <span className="block text-xs leading-5 text-ink-soft">{t.noFile}</span>
                          </>
                        )}
                      </span>
                      {file && <span className="shrink-0 text-[13px] font-medium text-primary">{t.changeFile}</span>}
                    </label>
                    <button
                      type="button"
                      disabled={!template.data}
                      onClick={() => template.data && save(template.data, "contacts-template.csv")}
                      className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-50"
                    >
                      <IconDownload className="size-4" aria-hidden />
                      {t.template}
                    </button>
                  </section>

                  <section data-slot="card" className={cn(PANE, "space-y-4")}>
                    <div className="space-y-1.5">
                      <h2 className="text-[15px] font-semibold text-ink">{t.existingTitle}</h2>
                      <Segmented
                        label={t.existingTitle}
                        value={mode}
                        onChange={(next) => {
                          changed();
                          setMode(next);
                        }}
                        options={[
                          { value: "update", label: t.update },
                          { value: "skip", label: t.skip },
                        ]}
                      />
                      <p className="text-[13px] leading-5 text-ink-soft">{mode === "update" ? t.updateHint : t.skipHint}</p>
                    </div>
                    <TextField
                      label={t.tags}
                      hint={t.tagsHint}
                      dir="auto"
                      autoComplete="off"
                      value={tags}
                      maxLength={500}
                      disabled={busy !== null}
                      onChange={(e) => {
                        changed();
                        setTags(e.target.value);
                      }}
                      className="[&_input]:h-11"
                    />
                    <p data-slot="import-note" className="flex items-start gap-2 rounded-2xl bg-accent-soft px-4 py-3 text-sm leading-6 text-accent-dark">
                      <IconInfo className="mt-1 size-4 shrink-0" aria-hidden />
                      {t.consent}
                    </p>
                  </section>

                  <StepActions>
                    <Button type="button" className={cn(PILL, "min-h-11 gap-2 max-sm:w-full")} disabled={busy !== null} onClick={() => (checked ? setStep(1) : void run(true))}>
                      {busy === "check" ? <Spinner className="size-4" /> : <IconSheet className="size-4" weight="bold" aria-hidden />}
                      {busy === "check" ? t.checking : t.check}
                    </Button>
                  </StepActions>
                </>
              )}

              {step === 1 && checked && (
                <>
                  <section data-slot="card" className={PANE}>
                    <h2 className="text-[15px] font-semibold text-ink">{t.columnsTitle}</h2>
                    <p className="mt-1 text-[13px] leading-5 text-ink-soft">{t.columnsHint}</p>
                    <Columns t={t} result={checked} />
                  </section>
                  <StepActions>
                    <Button type="button" variant="outline" className={cn(PILL, "min-h-11 gap-2")} onClick={() => setStep(0)}>
                      <IconArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
                      {t.backStep}
                    </Button>
                    <Button type="button" className={cn(PILL, "min-h-11 gap-2 max-sm:flex-1")} onClick={() => setStep(2)}>
                      {t.next}
                      <IconArrowRight className="size-4 rtl:rotate-180" weight="bold" aria-hidden />
                    </Button>
                  </StepActions>
                </>
              )}

              {step === 2 && checked && (
                <>
                  <section data-slot="card" className={cn(PANE, "space-y-4")}>
                    <div>
                      <p className="text-sm leading-6 text-ink-soft">{fmt(t.rowsInFile, { rows: pluralOf(t, "rows", checked.total) })}</p>
                      <p className="text-[17px] leading-7 font-semibold text-ink">{summary(t, checked, mode)}</p>
                      <p className="text-[13px] leading-5 text-ink-soft">{t.checkNote}</p>
                    </div>
                    <Tiles t={t} result={checked} mode={mode} />
                    <RowErrors t={t} result={checked} />
                    {willImport === 0 && <p className="text-sm font-medium text-ink">{t.nothingToImport}</p>}
                  </section>
                  <StepActions>
                    <Button type="button" variant="outline" className={cn(PILL, "min-h-11 gap-2")} disabled={busy !== null} onClick={() => setStep(1)}>
                      <IconArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
                      {t.backStep}
                    </Button>
                    {willImport > 0 ? (
                      <Button type="button" className={cn(PILL, "min-h-11 gap-2 max-sm:flex-1")} disabled={busy !== null} onClick={() => void run(false)}>
                        {busy === "import" ? <Spinner className="size-4" /> : <IconUpload className="size-4" weight="bold" aria-hidden />}
                        {busy === "import" ? t.importing : t.import}
                      </Button>
                    ) : (
                      <Button type="button" className={cn(PILL, "min-h-11 max-sm:flex-1")} onClick={restart}>
                        {t.another}
                      </Button>
                    )}
                  </StepActions>
                </>
              )}
            </>
          )}
        </div>
      </DataState>
    </div>
  );
}

/** The buttons that close a step: the way back at the start, the way on at the end. */
function StepActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>;
}

/** "3 new, 1 updated, 2 skipped" — the parts the mode can produce, each with its plural. */
function summary(t: Strings, result: ContactImportResult, mode: ContactImportMode): string {
  const tense = result.dryRun ? "Dry" : "Done";
  const parts = [pluralOf(t, "created", result.created)];
  if (mode === "update" || result.updated > 0) parts.push(pluralOf(t, `updated${tense}`, result.updated));
  if (mode === "skip" || result.skipped > 0) parts.push(pluralOf(t, `skipped${tense}`, result.skipped));
  if (result.unchanged > 0) parts.push(pluralOf(t, "unchanged", result.unchanged));
  return parts.join(t.sep);
}

/** The same counts as figures: one well each, the rows that are left out in the danger colour. */
function Tiles({ t, result, mode }: { t: Strings; result: ContactImportResult; mode: ContactImportMode }) {
  const tiles: Array<{ key: string; label: string; value: number; tone?: "success" | "danger" }> = [{ key: "created", label: t.tileCreated, value: result.created, tone: "success" }];
  if (mode === "update" || result.updated > 0) tiles.push({ key: "updated", label: t.tileUpdated, value: result.updated });
  if (mode === "skip" || result.skipped > 0) tiles.push({ key: "skipped", label: t.tileSkipped, value: result.skipped });
  if (result.unchanged > 0) tiles.push({ key: "unchanged", label: t.tileUnchanged, value: result.unchanged });
  if (result.invalid > 0) tiles.push({ key: "invalid", label: t.tileInvalid, value: result.invalid, tone: "danger" });
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {tiles.map((tile) => (
        <div key={tile.key} data-slot="import-figure" data-tone={tile.tone} className="rounded-2xl bg-paper-sunken px-3 py-2.5">
          <dt className="truncate text-xs leading-5 text-ink-soft">{tile.label}</dt>
          <dd
            className={cn(
              "text-[22px] leading-8 font-semibold tabular-nums",
              tile.tone === "danger" ? "text-danger" : tile.tone === "success" && tile.value > 0 ? "text-success" : "text-ink"
            )}
          >
            {formatCount(tile.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Which column of the sheet was used for each field. */
function Columns({ t, result }: { t: Strings; result: ContactImportResult }) {
  return (
    <dl className="mt-3">
      {FIELDS.map((field) => {
        const column = result.columns?.[field] ?? null;
        return (
          <div key={field} className="flex min-h-12 items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
            <dt className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
              <span
                aria-hidden
                data-slot="import-match"
                data-found={column ? "" : undefined}
                className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", column ? "bg-success-soft text-success" : "bg-paper-sunken text-ink-soft")}
              >
                {column ? <IconCheck className="size-3.5" weight="bold" /> : <span className="h-0.5 w-2.5 rounded-full bg-current" />}
              </span>
              {t[`field_${field}`]}
            </dt>
            <dd className={cn("min-w-0 truncate text-sm", column ? "font-medium text-ink" : "text-ink-soft")}>{column ? <bdi dir="auto">{column}</bdi> : t.notFound}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/** The value the server quoted at the start of a row problem: "\"not-a-phone\" is not a phone number". */
function quotedValue(message: string): string | null {
  const match = /^"([\s\S]*?)"/.exec(message);
  return match ? match[1] : null;
}

function problemText(t: Strings, problem: ContactImportRowError) {
  const value = quotedValue(problem.message);
  const known =
    problem.field === "phone"
      ? t.problemPhone
      : problem.field === "email"
        ? t.problemEmail
        : problem.field === "marketing_consent"
          ? t.problemConsent
          : null;
  if (value === null || known === null) return <span dir="auto">{problem.message}</span>;
  return (
    <>
      <bdi dir="auto" className="font-medium text-ink">
        “{value}”
      </bdi>{" "}
      {known}
    </>
  );
}

/** The rows the server could not take as they are, each in words: which row, which field, what is wrong with it. */
function RowErrors({ t, result }: { t: Strings; result: ContactImportResult }) {
  if (!result.errors?.length) return null;
  const fieldLabel = (field: string) => (field === "phone" || field === "email" || field === "marketing_consent" ? t[`field_${field}`] : field);
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink">{t.errorsTitle}</h3>
      {/* A long list scrolls inside its own box, never the page sideways. */}
      <ul data-slot="import-errors" className="max-h-96 overflow-y-auto rounded-2xl ring-1 ring-line">
        {result.errors.map((problem, index) => (
          <li key={`${problem.row}-${problem.field}-${index}`} className="flex items-start gap-3 border-b border-line px-3 py-2.5 last:border-b-0">
            <span className="mt-0.5 shrink-0 rounded-full bg-paper-sunken px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-ink-soft tabular-nums">
              {fmt(t.rowN, { n: formatCount(problem.row) })}
            </span>
            <p className="min-w-0 text-sm leading-6 wrap-anywhere text-ink-soft">
              <span className="font-medium text-ink">{fieldLabel(problem.field)}</span>
              {t.sep}
              {problemText(t, problem)}
            </p>
          </li>
        ))}
      </ul>
      {result.moreErrors > 0 && <p className="mt-2 text-xs text-ink-soft">{pluralOf(t, "moreErrors", result.moreErrors)}</p>}
    </div>
  );
}
