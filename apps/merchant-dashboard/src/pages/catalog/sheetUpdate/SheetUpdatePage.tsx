import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { IconColumns, IconDownload, IconFileUp, IconSheet } from "@/components/icons";
import { Alert, Button, Spinner, cn } from "@store-builder/ui";
import {
  ApiError,
  CATALOG_SHEET_UPDATE_COLUMNS,
  CATALOG_SHEET_UPDATE_MAX_BYTES,
  CATALOG_SHEET_UPDATE_MAX_ROWS,
  catalogSheetUpdateApply,
  catalogSheetUpdateFileProblem,
  catalogSheetUpdateKey,
  catalogSheetUpdatePreview,
  catalogSheetUpdateStillApplying,
  catalogSheetUpdateTemplate,
  type CatalogSheetUpdatePreview,
  type CatalogSheetUpdateResult,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useErrorMessage } from "@/lib/errorMessages";
import { isPermissionError } from "@/lib/errors";
import { canManageProducts } from "@/lib/productAccess";
import { pluralOf } from "@/lib/plural";
import { fmt, useT } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { AccordionSection } from "@/components/Accordion";
import { SaveBar } from "@/components/SaveBar";
import { Section } from "@/components/Section";
import { ViewLink } from "@/components/ViewLink";
import { ChipRow, ListSkeleton, type ChipItem } from "@/components/list";
import { SheetChangesTable, SheetProblemsTable, SheetUnknownTable, type SheetProblemRow } from "./SheetRowTables";
import { sheetFileProblemText } from "./sheetProblemText";
import { SHEET_UPDATE_STRINGS, type SheetUpdateStrings } from "./sheetUpdateStrings";

type Stage =
  | { step: "idle" }
  | { step: "reading"; file: File }
  /** `key` is this upload's Idempotency-Key: sent with every apply of it, so a second press cannot apply it twice. */
  | { step: "preview"; file: File; key: string; preview: CatalogSheetUpdatePreview }
  | { step: "result"; file: File; result: CatalogSheetUpdateResult };

/** What a failed apply leaves the merchant to do: press again (the same key), or read the sheet again first. */
interface ApplyProblem {
  message: string;
  next: "retry" | "recheck";
}

const ACCEPT = ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const TEMPLATE_NAME = "stock-price-update-template.csv";
/** What DataState reads as "not part of your role", for a role known to lack products.manage. */
const ROLE_REFUSED = new ApiError("Forbidden", 403, "FORBIDDEN");

const PILL = "min-h-11 gap-2 rounded-full px-5";

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sizeText(t: SheetUpdateStrings, bytes: number): string {
  if (bytes < 1024 * 1024) return fmt(t.sizeKb, { n: Math.max(1, Math.round(bytes / 1024)) });
  return fmt(t.sizeMb, { n: Math.round((bytes / (1024 * 1024)) * 10) / 10 });
}

/**
 * Products → «تحديث جماعي من شيت» / Bulk update from a sheet (handoff 243, 295,
 * 297; products.manage). Download the template, upload a CSV or .xlsx, read
 * what it would change — every changed field as old → new, with the unknown
 * SKUs and the rows in error under their own chips — then apply, and read the
 * result. Nothing is saved before «طبّق».
 *
 * The first thing on the page is where the sheet goes; what its columns mean
 * is one fold under it, for the first time only.
 */
export function SheetUpdatePage() {
  const t = useT(SHEET_UPDATE_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const errorMessage = useErrorMessage();
  const fileInput = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ step: "idle" });
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyProblem, setApplyProblem] = useState<ApplyProblem | null>(null);
  // A role known to lack products.manage is told so before it uploads anything; a custom role hears it from the API.
  const [refusedByApi, setRefused] = useState<unknown>(null);
  const refused = refusedByApi ?? (canManageProducts(currentWorkspace?.role) ? null : ROLE_REFUSED);

  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  const busy = stage.step === "reading" || applying;

  function reset() {
    setStage({ step: "idle" });
    setFileError(null);
    setApplyProblem(null);
  }

  /** Reads the sheet without saving anything. Each read starts a new upload, with its own key. */
  async function read(file: File) {
    setFileError(null);
    setApplyProblem(null);
    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      setStage({ step: "idle" });
      setFileError(t.file_type);
      return;
    }
    if (file.size > CATALOG_SHEET_UPDATE_MAX_BYTES) {
      setStage({ step: "idle" });
      setFileError(t.file_too_large);
      return;
    }
    setStage({ step: "reading", file });
    try {
      const preview = await catalogSheetUpdatePreview(apiClient, workspaceId, file);
      setStage({ step: "preview", file, key: catalogSheetUpdateKey(), preview });
    } catch (err) {
      setStage({ step: "idle" });
      if (isPermissionError(err)) {
        setRefused(err);
        return;
      }
      const problem = catalogSheetUpdateFileProblem(err);
      setFileError(problem ? sheetFileProblemText(t, problem) : errorMessage(err));
    }
  }

  async function apply() {
    if (stage.step !== "preview" || applying) return;
    setApplying(true);
    setApplyProblem(null);
    try {
      const result = await catalogSheetUpdateApply(apiClient, workspaceId, stage.file, stage.key);
      setStage({ step: "result", file: stage.file, result });
    } catch (err) {
      if (isPermissionError(err)) {
        setRefused(err);
      } else if (catalogSheetUpdateStillApplying(err)) {
        // The first press is still running on the server: the same key again answers its result.
        setApplyProblem({ message: t.stillApplying, next: "retry" });
      } else if (!(err instanceof ApiError) || err.status === 429) {
        // No answer at all (the update may or may not have run), or turned away before it ran: the same key again is safe either way.
        setApplyProblem({ message: errorMessage(err), next: "retry" });
      } else {
        // The server refused or failed this run. What is still different is in a fresh read of the sheet.
        const problem = catalogSheetUpdateFileProblem(err);
        setApplyProblem({ message: problem ? sheetFileProblemText(t, problem) : t.applyUnknown, next: "recheck" });
      }
    } finally {
      setApplying(false);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !busy) void read(file);
  }

  const chosen = stage.step === "idle" ? null : stage.file;
  const reading = stage.step === "reading";

  return (
    <div className="max-w-5xl">
      <PageHeader title={t.title} description={t.description} back={{ to: "/catalog", label: t.back }} />

      <DataState loading={false} error={refused}>
        <div className="space-y-4">
          <Section title={t.sheetTitle} description={t.sheetDescription}>
            <div className="space-y-3">
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  // Cleared so choosing the same file again (after fixing it) is still a change.
                  e.target.value = "";
                  if (file) void read(file);
                }}
              />

              <div
                data-slot="sheet-drop"
                data-dragging={dragging ? "" : undefined}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!busy) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                  "zimos-sheet-drop flex flex-col gap-3 rounded-[1.125rem] border border-dashed p-4 sm:flex-row sm:items-center",
                  dragging ? "border-primary bg-primary-soft" : "border-line-strong/50"
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-[0.875rem] bg-primary-soft text-primary" aria-hidden>
                    {reading ? <Spinner className="size-5" /> : <IconSheet className="size-6" weight="duotone" />}
                  </span>
                  {chosen ? (
                    <p className="min-w-0 text-sm font-medium text-ink" role={reading ? "status" : undefined}>
                      <span className="block truncate">
                        {reading ? fmt(t.reading, { name: chosen.name }) : <bdi>{chosen.name}</bdi>}
                      </span>
                      {!reading && (
                        <span className="block text-xs font-normal tabular-nums text-ink-soft">
                          <bdi>{sizeText(t, chosen.size)}</bdi>
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="min-w-0 text-sm text-ink">
                      <span className="block font-medium">{t.dropHint}</span>
                      <span className="block text-xs text-ink-soft">{fmt(t.limits, { rows: CATALOG_SHEET_UPDATE_MAX_ROWS })}</span>
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 max-sm:*:flex-1">
                  <Button type="button" variant="outline" className={PILL} onClick={() => save(catalogSheetUpdateTemplate(), TEMPLATE_NAME)}>
                    <IconDownload className="size-4" aria-hidden />
                    {t.template}
                  </Button>
                  <Button
                    type="button"
                    variant={chosen ? "outline" : "default"}
                    className={PILL}
                    disabled={busy}
                    onClick={() => fileInput.current?.click()}
                  >
                    <IconFileUp className="size-4" aria-hidden />
                    {chosen ? t.chooseAnother : t.chooseFile}
                  </Button>
                </div>
              </div>

              {fileError && <Alert variant="danger">{fileError}</Alert>}
            </div>
          </Section>

          {/* What each column means: read once, then folded away (the template already carries the names). */}
          {!chosen && (
            <AccordionSection
              title={t.columnsTitle}
              icon={IconColumns}
              summary={
                <bdi dir="ltr" className="font-mono text-xs">
                  {CATALOG_SHEET_UPDATE_COLUMNS.join(" · ")}
                </bdi>
              }
              persistKey="catalog:sheet-update:columns"
            >
              <dl className="grid gap-x-4 gap-y-2.5 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
                {CATALOG_SHEET_UPDATE_COLUMNS.map((column) => (
                  <div key={column} className="sm:contents">
                    <dt>
                      <bdi dir="ltr" className="font-mono text-[13px] font-semibold text-ink">
                        {column}
                      </bdi>
                    </dt>
                    <dd className="text-ink-soft">{t[`col_${column}`]}</dd>
                  </div>
                ))}
              </dl>
            </AccordionSection>
          )}

          {reading && (
            <div>
              <span className="sr-only">{t.readingRows}</span>
              <ListSkeleton rows={4} />
            </div>
          )}

          {stage.step === "preview" && (
            <PreviewSection
              // A new upload starts on its own tab and its own first page.
              key={stage.key}
              preview={stage.preview}
              currency={currency}
              applying={applying}
              problem={applyProblem}
              onApply={() => void apply()}
              onRecheck={() => void read(stage.file)}
              onDiscard={reset}
            />
          )}

          {stage.step === "result" && <ResultSection result={stage.result} onAnother={reset} />}
        </div>
      </DataState>
    </div>
  );
}

type PreviewTab = "changes" | "unknown" | "errors";

function PreviewSection({
  preview,
  currency,
  applying,
  problem,
  onApply,
  onRecheck,
  onDiscard,
}: {
  preview: CatalogSheetUpdatePreview;
  currency: string;
  applying: boolean;
  problem: ApplyProblem | null;
  onApply: () => void;
  onRecheck: () => void;
  onDiscard: () => void;
}) {
  const t = useT(SHEET_UPDATE_STRINGS);
  const { changes, unknown, errors } = preview;
  const [tab, setTab] = useState<PreviewTab>(() => (changes.length > 0 ? "changes" : errors.length > 0 ? "errors" : unknown.length > 0 ? "unknown" : "changes"));
  const tabs: ChipItem<PreviewTab>[] = [
    { value: "changes", label: t.tab_changes, count: changes.length, tone: "success" },
    { value: "unknown", label: t.tab_unknown, count: unknown.length, tone: "attention" },
    { value: "errors", label: t.tab_errors, count: errors.length, tone: "danger" },
  ];
  const ignored = preview.ignoredColumns ?? [];
  const [ignoredBefore, ignoredAfter = ""] = t.ignoredColumns.split("{list}");
  const recheck = problem?.next === "recheck";

  return (
    <Section title={t.previewTitle} description={fmt(t.summary, { rows: pluralOf(t, "rows", preview.rows) })}>
      <div className="space-y-4">
        {ignored.length > 0 && (
          <Alert>
            <p>
              {ignoredBefore}
              <bdi dir="ltr" className="font-mono text-[13px] font-semibold">
                {ignored.join(", ")}
              </bdi>
              {ignoredAfter}
            </p>
          </Alert>
        )}

        <ChipRow items={tabs} value={tab} onChange={setTab} label={t.tabsLabel} collapseEmpty={false} />

        {tab === "changes" &&
          (changes.length === 0 ? (
            <TabNote>{unknown.length + errors.length > 0 ? t.noChangesWithProblems : t.noChanges}</TabNote>
          ) : (
            <>
              {changes.some((change) => change.stockChange) && <p className="text-xs text-ink-soft">{t.stockChangeTiming}</p>}
              <SheetChangesTable changes={changes} currency={currency} />
            </>
          ))}
        {tab === "unknown" && (
          <RowsOrEmpty count={unknown.length} hint={t.unknownHint}>
            <SheetUnknownTable rows={unknown} />
          </RowsOrEmpty>
        )}
        {tab === "errors" && (
          <RowsOrEmpty count={errors.length} hint={t.errorsHint}>
            <SheetProblemsTable rows={errors} />
          </RowsOrEmpty>
        )}

        <SaveBar
          dirty={changes.length > 0}
          saving={applying}
          onSave={recheck ? onRecheck : onApply}
          saveLabel={recheck ? t.checkAgain : pluralOf(t, "apply", changes.length)}
          savingLabel={t.applying}
          onDiscard={onDiscard}
          discardLabel={t.chooseAnother}
          message={
            problem ? (
              <span role="alert" className="text-danger">
                {problem.message}
              </span>
            ) : (
              t.readyToApply
            )
          }
        />
      </div>
    </Section>
  );
}

/** One quiet line in place of a table: this tab has nothing, or nothing can be applied. */
function TabNote({ children }: { children: ReactNode }) {
  return <p className="rounded-[1.125rem] bg-paper-sunken/60 px-4 py-6 text-center text-sm text-ink-soft">{children}</p>;
}

/** A tab's hint and table, or a line saying the tab is empty. */
function RowsOrEmpty({ count, hint, children }: { count: number; hint: string; children: ReactNode }) {
  const t = useT(SHEET_UPDATE_STRINGS);
  if (count === 0) return <TabNote>{t.tabEmpty}</TabNote>;
  return (
    <>
      <p className="text-xs text-ink-soft">{hint}</p>
      {children}
    </>
  );
}

type ResultTab = "failed" | "unknown" | "errors";

function ResultSection({ result, onAnother }: { result: CatalogSheetUpdateResult; onAnother: () => void }) {
  const t = useT(SHEET_UPDATE_STRINGS);
  const failed: SheetProblemRow[] = result.failed;
  const { unknown, errors } = result;
  const skipped = failed.length + unknown.length + errors.length;
  const [tab, setTab] = useState<ResultTab>(() => (failed.length > 0 ? "failed" : errors.length > 0 ? "errors" : "unknown"));
  const tabs: ChipItem<ResultTab>[] = [
    ...(failed.length > 0 ? [{ value: "failed" as const, label: t.tab_failed, count: failed.length, tone: "danger" as const }] : []),
    { value: "unknown", label: t.tab_unknown, count: unknown.length, tone: "attention" },
    { value: "errors", label: t.tab_errors, count: errors.length, tone: "danger" },
  ];

  return (
    <Section title={t.resultTitle}>
      <div className="space-y-4">
        <Alert variant={result.applied > 0 ? "success" : "info"}>
          <p className="font-medium">{result.applied > 0 ? pluralOf(t, "applied", result.applied) : t.appliedNone}</p>
          {skipped > 0 && <p>{t.resultSkipped}</p>}
        </Alert>

        {skipped > 0 && (
          <>
            <ChipRow items={tabs} value={tab} onChange={setTab} label={t.tabsLabel} collapseEmpty={false} />
            {tab === "failed" && (
              <RowsOrEmpty count={failed.length} hint={t.failedHint}>
                <SheetProblemsTable rows={failed} />
              </RowsOrEmpty>
            )}
            {tab === "unknown" && (
              <RowsOrEmpty count={unknown.length} hint={t.unknownHint}>
                <SheetUnknownTable rows={unknown} />
              </RowsOrEmpty>
            )}
            {tab === "errors" && (
              <RowsOrEmpty count={errors.length} hint={t.errorsHint}>
                <SheetProblemsTable rows={errors} />
              </RowsOrEmpty>
            )}
          </>
        )}

        <div className="flex flex-wrap gap-2 max-sm:*:flex-1">
          <Button type="button" className={PILL} onClick={onAnother}>
            {t.another}
          </Button>
          <Button asChild variant="outline" className={PILL}>
            <ViewLink to="/catalog">{t.backToProducts}</ViewLink>
          </Button>
        </div>
      </div>
    </Section>
  );
}
