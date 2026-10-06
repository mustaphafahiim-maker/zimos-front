import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Download, FileSpreadsheet, Info, Upload } from "lucide-react";
import { Alert, Button, buttonVariants, cn, Spinner } from "@store-builder/ui";
import {
  CONTACT_IMPORT_MAX_BYTES,
  contactImport,
  contactImportTemplate,
  type ContactImportField,
  type ContactImportMode,
  type ContactImportResult,
  type ContactImportRowError,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { pluralOf } from "@/lib/plural";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { Section } from "@/components/Section";
import { TextField } from "@/components/Field";

/**
 * Contacts → Import (frontend-handoff 187): a CSV or Excel sheet is checked
 * first (dryRun: the same counts, nothing saved), then imported with the
 * same file. The template is fetched on arrival — it doubles as the check
 * that this teammate may import contacts (customers.manage), so a missing
 * permission shows before any file is chosen.
 */

const STRINGS = {
  en: {
    title: "Import contacts",
    description: "Add your customers from a CSV or Excel sheet. Check the file first, then import it.",
    back: "Contacts",
    stepFile: "1. Choose the file",
    stepFileHint:
      "CSV or Excel (.xlsx), up to 5 MB and 5000 rows. The first row names the columns: phone (required), and name, email, tags and marketing consent if you have them — in English or Arabic.",
    template: "Download the template",
    chooseFile: "Choose a file",
    changeFile: "Choose another file",
    noFile: "No file chosen yet",
    fileSize: "{size} KB",
    stepOptions: "2. Contacts already in your store",
    update: "Update existing contacts",
    updateHint:
      "Their name, email and marketing consent come from the sheet, and the sheet's tags are added to theirs.",
    skip: "Skip existing contacts",
    skipHint: "A phone number already in your store is left exactly as it is.",
    tags: "Add these tags to everyone",
    tagsHint: "Optional. Separate them with commas, e.g. imported-oct.",
    consent: "Only mark marketing consent yes for people who agreed to receive your offers.",
    check: "Check file",
    checking: "Checking the file…",
    import: "Import",
    importing: "Importing…",
    checkTitle: "File check — nothing is saved yet",
    doneTitle: "Done — your contacts are in",
    rowsInFile: "The file has {rows}. If you import it:",
    rowsDone: "From {rows} in the file:",
    nothingToImport: "Nothing new to import from this file.",
    columnsTitle: "Columns we matched",
    notFound: "Not in the file",
    errorsTitle: "Rows to look at",
    moreErrors_one: "…and 1 more not shown.",
    moreErrors_other: "…and {n} more not shown.",
    colRow: "Row",
    rowN: "Row {n}",
    colField: "Field",
    colProblem: "Problem",
    field_phone: "Phone",
    field_fullName: "Name",
    field_email: "Email",
    field_tags: "Tags",
    field_consent: "Marketing consent",
    field_marketing_consent: "Marketing consent",
    problemPhone: "is not a phone number — this row is not imported.",
    problemEmail: "is not an email — the row is imported without it.",
    problemConsent: "— write yes or no; consent is left as it was.",
    backToList: "Back to contacts",
    another: "Import another file",
    tooLarge: "The file is larger than 5 MB. Split it into smaller files and import them one by one.",
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
    stepFile: "١. اختار الملف",
    stepFileHint:
      "CSV أو Excel (.xlsx)، لحد ٥ ميجا و٥٠٠٠ صف. أول صف فيه أسامي الأعمدة: الموبايل (لازم)، والاسم والإيميل والتاجات وموافقة التسويق لو عندك — بالعربي أو بالإنجليزي.",
    template: "نزّل النموذج",
    chooseFile: "اختار ملف",
    changeFile: "اختار ملف تاني",
    noFile: "لسه مختارتش ملف",
    fileSize: "{size} كيلوبايت",
    stepOptions: "٢. العملاء اللي موجودين عندك",
    update: "حدّث العملاء الموجودين",
    updateHint: "الاسم والإيميل وموافقة التسويق بيتاخدوا من الشيت، وتاجات الشيت بتتضاف على تاجاتهم.",
    skip: "سيب العملاء الموجودين زي ما هم",
    skipHint: "أي رقم موجود عندك في المتجر مش هيتغير فيه حاجة.",
    tags: "ضيف التاجات دي للكل",
    tagsHint: "اختياري. افصل بينها بفاصلة، زي: imported-oct",
    consent: 'علّم موافقة التسويق بـ"نعم" بس للناس اللي وافقوا يستقبلوا عروضك.',
    check: "راجع الملف",
    checking: "بنراجع الملف…",
    import: "استورد",
    importing: "بنستورد…",
    checkTitle: "مراجعة الملف — لسه محدش اتحفظ",
    doneTitle: "خلصنا — عملاءك اتضافوا",
    rowsInFile: "الملف فيه {rows}. لو استوردته:",
    rowsDone: "من {rows} في الملف:",
    nothingToImport: "مفيش حاجة جديدة تتضاف من الملف ده.",
    columnsTitle: "الأعمدة اللي لقيناها",
    notFound: "مش موجود في الملف",
    errorsTitle: "صفوف محتاجة تبص عليها",
    moreErrors_one: "…وكمان واحدة مش ظاهرة.",
    moreErrors_two: "…وكمان اتنين مش ظاهرين.",
    moreErrors_few: "…وكمان {n} مش ظاهرين.",
    moreErrors_other: "…وكمان {n} مش ظاهرين.",
    colRow: "الصف",
    rowN: "صف {n}",
    colField: "الخانة",
    colProblem: "المشكلة",
    field_phone: "الموبايل",
    field_fullName: "الاسم",
    field_email: "الإيميل",
    field_tags: "التاجات",
    field_consent: "موافقة التسويق",
    field_marketing_consent: "موافقة التسويق",
    problemPhone: "مش رقم موبايل صحيح — الصف ده مش بيتضاف.",
    problemEmail: "مش إيميل صحيح — الصف بيتضاف من غيره.",
    problemConsent: "— اكتب نعم أو لا؛ الموافقة بتفضل زي ما هي.",
    backToList: "ارجع لقايمة العملاء",
    another: "استورد ملف تاني",
    tooLarge: "الملف أكبر من ٥ ميجا. قسّمه لملفات أصغر واستوردهم واحد ورا التاني.",
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
const MODES: ContactImportMode[] = ["update", "skip"];

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
  // The template, fetched up front: loading, no-permission and error states for the page.
  const template = useAsync(() => contactImportTemplate(apiClient, workspaceId), [workspaceId]);

  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [mode, setMode] = useState<ContactImportMode>("update");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState<"check" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<ContactImportResult | null>(null);
  const [done, setDone] = useState<ContactImportResult | null>(null);
  // A new check or the final summary is brought into view (the button sits low on a phone).
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (checked || done) resultRef.current?.scrollIntoView({ block: "start" });
  }, [checked, done]);

  const fileErrors = { INVALID_FILE: t.invalidFile, FILE_TOO_LARGE: t.tooLarge };

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
      setError(t.tooLarge);
      return;
    }
    setFile(next);
  }

  async function run(dryRun: boolean) {
    if (!file) return;
    setBusy(dryRun ? "check" : "import");
    setError(null);
    try {
      const result = await contactImport(apiClient, workspaceId, file, { mode, tags, dryRun });
      if (dryRun) setChecked(result);
      else setDone(result);
    } catch (err) {
      setError(errorMessage(err, fileErrors));
      if (!dryRun) setChecked(null);
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
  }

  const templateButton = (
    <Button
      type="button"
      variant="outline"
      className="min-h-11"
      disabled={!template.data}
      onClick={() => template.data && save(template.data, "contacts-template.csv")}
    >
      <Download className="size-4" aria-hidden />
      {t.template}
    </Button>
  );

  return (
    <div className="max-w-3xl">
      <PageHeader title={t.title} description={t.description} back={{ to: "/customers", label: t.back }} />

      <DataState loading={template.loading} error={template.error} onRetry={() => void template.refresh()}>
        {done ? (
          <div ref={resultRef} className="scroll-mt-24">
            <Section title={t.doneTitle}>
              <div className="space-y-4">
                <Alert variant="success">
                  <p className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                    {fmt(t.rowsDone, { rows: pluralOf(t, "rows", done.total) })}
                  </p>
                  <p className="text-ink">{summary(t, done, mode)}</p>
                </Alert>
                {done.invalid > 0 && (
                  <p className="text-sm font-medium text-danger">{pluralOf(t, "invalid", done.invalid)}</p>
                )}
                <RowErrors t={t} result={done} />
                <div className="flex flex-wrap gap-2">
                  <Link to="/customers" className={cn(buttonVariants(), "min-h-11")}>
                    {t.backToList}
                  </Link>
                  <Button type="button" variant="outline" className="min-h-11" onClick={restart}>
                    {t.another}
                  </Button>
                </div>
              </div>
            </Section>
          </div>
        ) : (
          <div className="space-y-4">
            <Section title={t.stepFile} description={t.stepFileHint} actions={templateButton}>
              {/* The native picker's own words follow the browser's language; the visible control is ours. */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <input
                  key={fileKey}
                  id="contact-import-file"
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={busy !== null}
                  onChange={(e) => pick(e.target.files?.[0] ?? null)}
                  className="peer sr-only"
                />
                <label
                  htmlFor="contact-import-file"
                  className={cn(
                    buttonVariants({ variant: file ? "outline" : "default" }),
                    "min-h-11 cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-disabled:pointer-events-none peer-disabled:opacity-50"
                  )}
                >
                  <FileSpreadsheet className="size-4" aria-hidden />
                  {file ? t.changeFile : t.chooseFile}
                </label>
                {file ? (
                  <span className="flex min-w-0 items-center gap-1.5 text-ink">
                    <bdi dir="ltr" className="truncate font-medium">
                      {file.name}
                    </bdi>
                    <span className="shrink-0 text-xs text-ink-soft tabular-nums">
                      {fmt(t.fileSize, { size: formatCount(Math.max(1, Math.round(file.size / 1024))) })}
                    </span>
                  </span>
                ) : (
                  <span className="text-ink-soft">{t.noFile}</span>
                )}
              </div>
            </Section>

            <Section title={t.stepOptions}>
              <div className="space-y-4">
                <fieldset className="space-y-1">
                  <legend className="sr-only">{t.stepOptions}</legend>
                  {MODES.map((m) => (
                    <label
                      key={m}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius)] px-3 py-2.5 ring-1",
                        mode === m ? "bg-primary-soft ring-primary/40" : "ring-line hover:bg-paper-sunken"
                      )}
                    >
                      <input
                        type="radio"
                        name="contact-import-mode"
                        className="mt-0.5 size-4 shrink-0 accent-primary"
                        checked={mode === m}
                        disabled={busy !== null}
                        onChange={() => {
                          changed();
                          setMode(m);
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">{t[m]}</span>
                        <span className="block text-xs text-ink-soft">
                          {m === "update" ? t.updateHint : t.skipHint}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <TextField
                  label={t.tags}
                  hint={t.tagsHint}
                  value={tags}
                  maxLength={500}
                  disabled={busy !== null}
                  onChange={(e) => {
                    changed();
                    setTags(e.target.value);
                  }}
                />
                <p className="flex items-start gap-2 rounded-[var(--radius)] bg-accent-soft px-3 py-2.5 text-sm text-accent-dark">
                  <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {t.consent}
                </p>
              </div>
            </Section>

            {error && <Alert variant="danger">{error}</Alert>}

            {checked ? (
              <div ref={resultRef} className="scroll-mt-24">
                <Section title={t.checkTitle}>
                  <div className="space-y-4">
                    <div className="space-y-1 text-sm">
                      <p className="text-ink-soft">{fmt(t.rowsInFile, { rows: pluralOf(t, "rows", checked.total) })}</p>
                      <p className="text-[15px] font-medium text-ink">{summary(t, checked, mode)}</p>
                      {checked.invalid > 0 && (
                        <p className="font-medium text-danger">{pluralOf(t, "invalid", checked.invalid)}</p>
                      )}
                    </div>
                    <Columns t={t} result={checked} />
                    <RowErrors t={t} result={checked} />
                    {checked.created + checked.updated > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          className="min-h-11"
                          disabled={busy !== null}
                          onClick={() => void run(false)}
                        >
                          {busy === "import" ? (
                            <Spinner className="size-4" />
                          ) : (
                            <Upload className="size-4" aria-hidden />
                          )}
                          {busy === "import" ? t.importing : t.import}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-ink-soft">{t.nothingToImport}</p>
                    )}
                  </div>
                </Section>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="min-h-11"
                  disabled={!file || busy !== null}
                  onClick={() => void run(true)}
                >
                  {busy === "check" ? (
                    <Spinner className="size-4" />
                  ) : (
                    <FileSpreadsheet className="size-4" aria-hidden />
                  )}
                  {busy === "check" ? t.checking : t.check}
                </Button>
              </div>
            )}
          </div>
        )}
      </DataState>
    </div>
  );
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

/** Which column of the sheet was used for each field. */
function Columns({ t, result }: { t: Strings; result: ContactImportResult }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink">{t.columnsTitle}</h3>
      <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
        {FIELDS.map((field) => {
          const column = result.columns?.[field] ?? null;
          return (
            <div
              key={field}
              className="flex items-center justify-between gap-3 rounded-[var(--radius)] bg-paper-sunken px-3 py-2"
            >
              <dt className="text-ink-soft">{t[`field_${field}`]}</dt>
              <dd className={column ? "font-medium text-ink" : "text-ink-soft"}>
                {column ? <bdi dir="auto">{column}</bdi> : t.notFound}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
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

/** The errors table: row, field, problem. */
function RowErrors({ t, result }: { t: Strings; result: ContactImportResult }) {
  if (!result.errors?.length) return null;
  const fieldLabel = (field: string) =>
    field === "phone" || field === "email" || field === "marketing_consent" ? t[`field_${field}`] : field;
  const columns: Column<ContactImportRowError>[] = [
    {
      key: "row",
      header: t.colRow,
      cell: (e) => <span className="tabular-nums">{fmt(t.rowN, { n: formatCount(e.row) })}</span>,
      className: "w-20",
    },
    {
      key: "field",
      header: t.colField,
      cell: (e) => fieldLabel(e.field),
      className: "w-40",
    },
    { key: "problem", header: t.colProblem, cell: (e) => problemText(t, e) },
  ];
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink">{t.errorsTitle}</h3>
      <div className="max-h-96 overflow-y-auto rounded-[var(--radius)] ring-1 ring-line">
        <DataTable
          columns={columns}
          rows={result.errors}
          rowKey={(e, i) => `${e.row}-${e.field}-${i}`}
          minWidth="32rem"
        />
      </div>
      {result.moreErrors > 0 && (
        <p className="mt-2 text-xs text-ink-soft">{pluralOf(t, "moreErrors", result.moreErrors)}</p>
      )}
    </div>
  );
}
