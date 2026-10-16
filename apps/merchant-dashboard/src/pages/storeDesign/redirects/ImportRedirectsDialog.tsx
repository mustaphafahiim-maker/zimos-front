import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { IconFileUp, IconSuccess } from "@/components/icons";
import { Alert, Button } from "@store-builder/ui";
import { URL_REDIRECT_IMPORT_MAX_LINES, urlRedirectsImport, type UrlRedirectImportResult } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { pluralOf } from "@/lib/plural";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { Field } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Textarea } from "@/components/Textarea";
import { REDIRECT_STRINGS, importLineKey } from "./redirectStrings";

const EXAMPLE = "from,to,code\n/old-page,/new-page\n/summer-sale,/products?collection=sale,302";

/** The API reports at most this many problem lines. */
const MAX_PROBLEMS = 100;

interface Row {
  /** The line's number in what the merchant pasted or picked (blank lines counted). */
  line: number;
  text: string;
}

interface Problem {
  line: number;
  text: string;
  message: string;
}

/** The lines that say something, each with its own number in the original text. */
function rowsOf(text: string): Row[] {
  return text
    .split(/\r?\n/)
    .map((raw, i) => ({ line: i + 1, text: raw.trim() }))
    .filter((row) => row.text !== "");
}

/** The second cell of a CSV line as the API reads it. */
const targetOf = (line: string) => (line.split(",")[1] ?? "").trim().replace(/^"|"$/g, "");

/**
 * «استيراد CSV» (POST /redirects/import): the merchant picks a file or pastes
 * its lines — "from,to[,301|302]" — and gets back how many were added and
 * updated, and each line that was left out with the reason. Lines are
 * numbered as in their own file: the API numbers only the non-empty ones, so
 * its numbers are mapped back here. An http:// target is stopped before
 * sending: the API would keep only its path.
 */
export function ImportRedirectsDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const t = useT(REDIRECT_STRINGS);
  const { locale, intlLocale } = useLocale();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<Problem[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ answer: UrlRedirectImportResult; problems: Problem[] } | null>(null);

  function reset() {
    setText("");
    setFileName(null);
    setFailure(null);
    setBlocked([]);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  useEffect(() => {
    if (open) reset();
  }, [open]);

  const rows = rowsOf(text);
  const number = (n: number) => new Intl.NumberFormat(intlLocale).format(n);

  async function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFailure(null);
    setBlocked([]);
    try {
      // A byte-order mark from Excel would stick to the first address.
      setText((await file.text()).replace(/^﻿/, ""));
      setFileName(file.name);
    } catch {
      setFileName(null);
      setFailure(t.importUnreadable);
    }
  }

  /** The API's sentence for a line, in the dashboard's words where it has them. */
  function lineMessage(message: string): string {
    const key = importLineKey(message);
    if (key) return t[key];
    return locale === "ar" ? t.line_generic : message;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFailure(null);
    setBlocked([]);
    if (rows.length === 0) {
      setFailure(t.importEmpty);
      return;
    }
    // The API takes the limit plus a header line.
    if (rows.length > URL_REDIRECT_IMPORT_MAX_LINES + 1) {
      setFailure(fmt(t.importTooMany, { max: URL_REDIRECT_IMPORT_MAX_LINES }));
      return;
    }
    const plainHttp = rows.filter((row) => /^http:\/\//i.test(targetOf(row.text)));
    if (plainHttp.length > 0) {
      setBlocked(plainHttp.slice(0, MAX_PROBLEMS).map((row) => ({ ...row, message: t.httpsOnly })));
      return;
    }
    setBusy(true);
    try {
      const answer = await urlRedirectsImport(apiClient, workspaceId, rows.map((row) => row.text).join("\n"));
      const problems = answer.errors.map((problem) => {
        const row = rows[problem.line - 1];
        return { line: row?.line ?? problem.line, text: row?.text ?? "", message: lineMessage(problem.message) };
      });
      setResult({ answer, problems });
      if (answer.created + answer.updated > 0) onImported();
    } catch (err) {
      setFailure(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const problemList = (problems: Problem[]) => (
    <ul className="max-h-56 space-y-2 overflow-y-auto rounded-[var(--radius)] bg-paper-sunken p-3 text-sm">
      {problems.map((problem) => (
        <li key={problem.line}>
          <p className="font-medium text-ink">{fmt(t.importLine, { line: number(problem.line), message: problem.message })}</p>
          {problem.text && (
            <bdi dir="ltr" className="block font-mono text-xs break-all text-ink-soft">
              {problem.text}
            </bdi>
          )}
        </li>
      ))}
    </ul>
  );

  if (result) {
    const { answer, problems } = result;
    const imported = answer.created + answer.updated;
    return (
      // Its own dialog (the key): the form before it was typed in, and this one has nothing to lose on Escape.
      <Modal
        key="result"
        open={open}
        onClose={onClose}
        title={t.importTitle}
        footer={
          <>
            <Button type="button" variant="outline" className="min-h-11" onClick={reset}>
              {t.importAgain}
            </Button>
            <Button type="button" className="min-h-11" onClick={onClose}>
              {t.done}
            </Button>
          </>
        }
      >
        <div className="space-y-4" aria-live="polite">
          <p className="flex items-start gap-2 text-sm font-medium text-ink">
            {imported > 0 && <IconSuccess className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />}
            {imported > 0 ? fmt(t.importDone, { created: answer.created, updated: answer.updated }) : t.importNothing}
          </p>
          {problems.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-danger">{t.importErrorsTitle}</p>
              {problemList(problems)}
              {problems.length >= MAX_PROBLEMS && <p className="text-xs text-ink-soft">{t.importMore}</p>}
            </div>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      key="form"
      open={open}
      onClose={onClose}
      title={t.importTitle}
      description={t.importHint}
      footer={
        <>
          <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="min-h-11" disabled={busy}>
            {busy ? t.importing : t.importSubmit}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <div className="rounded-[var(--radius)] bg-paper-sunken p-3">
          <p className="text-xs font-medium text-ink-soft">{t.importExample}</p>
          <pre dir="ltr" className="mt-1 overflow-x-auto text-start font-mono text-xs leading-relaxed text-ink">
            {EXAMPLE}
          </pre>
          <p className="mt-2 text-xs text-ink-soft">{fmt(t.importRules, { max: URL_REDIRECT_IMPORT_MAX_LINES })}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void pickFile(e)} />
          <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => fileRef.current?.click()}>
            <IconFileUp className="size-4" aria-hidden />
            {t.chooseFile}
          </Button>
          {fileName && (
            <p className="min-w-0 text-xs text-ink-soft" aria-live="polite">
              <bdi>{fmt(t.fileChosen, { name: fileName, lines: pluralOf(t, "lines", rows.length) })}</bdi>
            </p>
          )}
        </div>

        <Field label={t.pasteLabel}>
          {(props) => (
            <Textarea
              {...props}
              rows={7}
              dir="ltr"
              spellCheck={false}
              wrap="off"
              placeholder={"/old-page,/new-page"}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setFileName(null);
                setBlocked([]);
                setFailure(null);
              }}
              disabled={busy}
              className="text-start font-mono text-xs"
            />
          )}
        </Field>

        {blocked.length > 0 && (
          <div className="space-y-2" role="alert">
            <p className="text-sm font-semibold text-danger">{t.importFixFirst}</p>
            {problemList(blocked)}
          </div>
        )}
        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}
