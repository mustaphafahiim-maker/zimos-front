import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import {
  URL_REDIRECT_FROM_MAX,
  URL_REDIRECT_TO_MAX,
  urlRedirectCreate,
  urlRedirectRefusalOf,
  urlRedirectUpdate,
  type UrlRedirect,
  type UrlRedirectStatus,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT } from "@/i18n/LocaleContext";
import { Field } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { REDIRECT_STRINGS, REFUSAL_KEY, STATUS_KEY, fromPathProblem, toPathProblem } from "./redirectStrings";

interface Draft {
  fromPath: string;
  toPath: string;
  statusCode: UrlRedirectStatus;
}

const EMPTY: Draft = { fromPath: "", toPath: "", statusCode: 301 };
const STATUSES: readonly UrlRedirectStatus[] = [301, 302];

type Errors = Partial<Record<"fromPath" | "toPath", string>>;

/**
 * Adds or edits one redirect (POST / PUT /redirects): the old address, where
 * it goes, and whether the move is for good (301) or for a while (302). The
 * two addresses are checked as typed; what only the server can know — the
 * path already redirects, the target leads back to it — comes back on its
 * field in the API's words.
 */
export function RedirectDialog({
  open,
  redirect,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** The redirect being edited; null to add one. */
  redirect: UrlRedirect | null;
  onClose: () => void;
  onSaved: (redirect: UrlRedirect, created: boolean) => void;
}) {
  const t = useT(REDIRECT_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const typeName = useId();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(redirect ? { fromPath: redirect.fromPath, toPath: redirect.toPath, statusCode: redirect.statusCode } : EMPTY);
    setErrors({});
    setFailure(null);
  }, [open, redirect]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key === "fromPath" || key === "toPath") setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const fromPath = draft.fromPath.trim();
    const toPath = draft.toPath.trim();
    const fromProblem = fromPathProblem(fromPath);
    const toProblem = toPathProblem(toPath);
    const found: Errors = {
      ...(fromProblem ? { fromPath: t[fromProblem] } : {}),
      ...(toProblem ? { toPath: t[toProblem] } : {}),
    };
    // The same address on both sides, before the server has to say so.
    if (!found.fromPath && !found.toPath && fromPath.replace(/\/+$/, "") === toPath.replace(/\/+$/, "")) found.toPath = t.refused_self;
    setErrors(found);
    if (found.fromPath || found.toPath) {
      document.querySelector<HTMLElement>(`#${CSS.escape(formId)} [data-field="${found.fromPath ? "fromPath" : "toPath"}"] input`)?.focus();
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      const body = { fromPath, toPath, statusCode: draft.statusCode };
      const saved = redirect ? await urlRedirectUpdate(apiClient, workspaceId, redirect.id, body) : await urlRedirectCreate(apiClient, workspaceId, body);
      onSaved(saved, !redirect);
    } catch (err) {
      const refusal = urlRedirectRefusalOf(err);
      if (refusal) {
        setErrors({ [refusal.field]: t[REFUSAL_KEY[refusal.reason]] });
        document.querySelector<HTMLElement>(`#${CSS.escape(formId)} [data-field="${refusal.field}"] input`)?.focus();
      } else {
        setFailure(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={redirect ? t.editTitle : t.newTitle}
      description={t.dialogHint}
      footer={
        <>
          <Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="min-h-11" disabled={saving}>
            {saving ? t.saving : redirect ? t.save : t.create}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <div data-field="fromPath">
          <Field label={t.fromLabel} hint={t.fromHint} error={errors.fromPath} required>
            {(props) => (
              <Input
                {...props}
                dir="ltr"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={URL_REDIRECT_FROM_MAX}
                placeholder="/old-page"
                value={draft.fromPath}
                onChange={(e) => set("fromPath", e.target.value)}
                disabled={saving}
                className={cn("min-h-11 font-mono text-start", errors.fromPath && "border-danger focus-visible:ring-danger/30")}
              />
            )}
          </Field>
        </div>
        <div data-field="toPath">
          <Field label={t.toLabel} hint={t.toHint} error={errors.toPath} required>
            {(props) => (
              <Input
                {...props}
                dir="ltr"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={URL_REDIRECT_TO_MAX}
                placeholder="/new-page"
                value={draft.toPath}
                onChange={(e) => set("toPath", e.target.value)}
                disabled={saving}
                className={cn("min-h-11 font-mono text-start", errors.toPath && "border-danger focus-visible:ring-danger/30")}
              />
            )}
          </Field>
        </div>

        <fieldset className="space-y-2" disabled={saving}>
          <legend className="mb-1.5 text-sm font-medium text-ink">{t.typeLabel}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {STATUSES.map((status) => {
              const checked = draft.statusCode === status;
              return (
                <label
                  key={status}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-start gap-2.5 rounded-[var(--radius)] border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary",
                    checked ? "border-primary bg-primary-soft/60" : "border-line hover:border-line-strong"
                  )}
                >
                  <input
                    type="radio"
                    name={typeName}
                    className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
                    checked={checked}
                    onChange={() => set("statusCode", status)}
                  />
                  <span className="min-w-0">
                    <span className={cn("block text-sm font-medium", checked ? "text-primary-dark" : "text-ink")}>{t[STATUS_KEY[status]]}</span>
                    <span className="mt-0.5 block text-xs text-ink-soft">{status === 301 ? t.permanentHint : t.temporaryHint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}
