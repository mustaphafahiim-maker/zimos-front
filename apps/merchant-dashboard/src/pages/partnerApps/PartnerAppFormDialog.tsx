import { useId, useMemo, useState, type FormEvent } from "react";
import { IconClose, IconPlus } from "@/components/icons";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  apiFieldProblems,
  partnerAppsCreate,
  partnerAppsUpdate,
  type PartnerApp,
  type PartnerAppPayload,
  type PartnerAppWithSecret,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { CopyButton } from "@/components/CopyButton";
import { StatusBadge } from "@/components/StatusBadge";
import { DEVELOPERS_PATH, GUIDE_ANCHOR, PARTNER_APP_LIMIT, PARTNER_APP_STRINGS, type PartnerAppText } from "./partnerAppStrings";
import { SCOPE_STRINGS, scopeLabel, scopeResource } from "./scopeStrings";

const MAX_REDIRECTS = 10;

/** The server's rule for a callback: https, or http on this machine while developing; no #fragment. */
function redirectAllowed(uri: string): boolean {
  if (uri.includes("#")) return false;
  try {
    const url = new URL(uri);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  } catch {
    return false;
  }
}

function isHttps(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

type FieldErrors = Partial<Record<"name" | "description" | "iconUrl" | "appUrl" | "uninstallUrl" | "redirectUris" | "scopes", string>>;

/**
 * Create or edit one of the developer's apps: name, description, icon, the
 * page shown inside the dashboard, the callback URLs, the uninstall URL (item
 * 267) and the permissions it may ask a store for. A new app answers with its
 * Client Secret, handed to `onCreated` to be shown once.
 */
export function PartnerAppFormDialog({
  app,
  scopes: allScopes,
  onClose,
  onCreated,
  onSaved,
}: {
  /** The app being edited; null for a new one. */
  app: PartnerApp | null;
  /** Every scope an app may ask for, as the server lists them. */
  scopes: string[];
  onClose: () => void;
  onCreated: (app: PartnerAppWithSecret) => void;
  onSaved: (app: PartnerApp) => void;
}) {
  const t = useT(PARTNER_APP_STRINGS);
  const scopeText = useT(SCOPE_STRINGS) as Record<string, string>;
  const errorMessage = useErrorMessage();
  const baseId = useId();

  const [name, setName] = useState(app?.name ?? "");
  const [description, setDescription] = useState(app?.description ?? "");
  const [iconUrl, setIconUrl] = useState(app?.iconUrl ?? "");
  const [appUrl, setAppUrl] = useState(app?.appUrl ?? "");
  const [uninstallUrl, setUninstallUrl] = useState(app?.uninstallUrl ?? "");
  const [redirects, setRedirects] = useState<string[]>(app && app.redirectUris.length > 0 ? app.redirectUris : [""]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(app?.scopes ?? []));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [redirectErrors, setRedirectErrors] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The scopes by what they are about, in the server's order; one the app holds but the server no longer lists stays tickable.
  const groups = useMemo(() => {
    const known = [...new Set([...allScopes, ...(app?.scopes ?? [])])];
    const byResource = new Map<string, string[]>();
    for (const scope of known) {
      const resource = scopeResource(scope);
      byResource.set(resource, [...(byResource.get(resource) ?? []), scope]);
    }
    return [...byResource.entries()];
  }, [allScopes, app]);

  function check(): PartnerAppPayload | null {
    const found: FieldErrors = {};
    const rowErrors: Record<number, string> = {};
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) found.name = t.nameError;
    if (iconUrl.trim() && !isHttps(iconUrl.trim())) found.iconUrl = t.httpsOnly;
    if (appUrl.trim() && !isHttps(appUrl.trim())) found.appUrl = t.httpsOnly;
    if (uninstallUrl.trim() && !isHttps(uninstallUrl.trim())) found.uninstallUrl = t.httpsOnly;

    const seen = new Set<string>();
    const uris: string[] = [];
    redirects.forEach((raw, index) => {
      const uri = raw.trim();
      if (!uri) return;
      if (!redirectAllowed(uri)) rowErrors[index] = t.redirectInvalid;
      else if (seen.has(uri)) rowErrors[index] = t.redirectDuplicate;
      seen.add(uri);
      uris.push(uri);
    });
    if (uris.length === 0) found.redirectUris = t.redirectRequired;
    if (picked.size === 0) found.scopes = t.permissionsRequired;

    setErrors(found);
    setRedirectErrors(rowErrors);
    if (Object.keys(found).length > 0 || Object.keys(rowErrors).length > 0) return null;
    return {
      name: trimmedName,
      description: description.trim() || null,
      iconUrl: iconUrl.trim() || null,
      appUrl: appUrl.trim() || null,
      uninstallUrl: uninstallUrl.trim() || null,
      redirectUris: uris,
      scopes: [...picked],
    };
  }

  /** What the server refused, put under the field it is about. */
  function fromServer(err: unknown): boolean {
    const found: FieldErrors = {};
    for (const problem of apiFieldProblems(err)) {
      const field = problem.field.split(".")[0];
      if (field === "redirectUris") found.redirectUris = t.redirectInvalid;
      else if (field === "scopes") found.scopes = t.permissionsRequired;
      else if (field === "name") found.name = t.nameError;
      // The uninstall address is checked like a webhook's: its refusals come on `url`.
      else if (field === "uninstallUrl" || field === "url") found.uninstallUrl = /public/i.test(problem.message) ? t.publicOnly : t.httpsOnly;
      else if (field === "iconUrl" || field === "appUrl") found[field] = t.httpsOnly;
    }
    setErrors(found);
    return Object.keys(found).length > 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const payload = check();
    if (!payload) return;
    setBusy(true);
    try {
      if (app) onSaved(await partnerAppsUpdate(apiClient, app.id, payload));
      else onCreated(await partnerAppsCreate(apiClient, payload));
    } catch (err) {
      if (!fromServer(err)) setFormError(errorMessage(err, { PARTNER_APP_LIMIT: fmt(t.limitNote, { max: PARTNER_APP_LIMIT }) }));
    } finally {
      setBusy(false);
    }
  }

  function toggle(scope: string, on: boolean) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(scope);
      else next.delete(scope);
      return next;
    });
    if (errors.scopes) setErrors((prev) => ({ ...prev, scopes: undefined }));
  }

  const resourceName = (resource: string) => (t as Record<string, string>)[`resource_${resource}`] ?? resource;

  return (
    <Modal open onClose={onClose} title={app ? fmt(t.editTitle, { name: app.name }) : t.createTitle} className="max-w-2xl">
      <form onSubmit={submit} noValidate className="space-y-5">
        <TextField
          label={t.name}
          hint={t.nameHint}
          error={errors.name}
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Field label={t.appDescription} hint={t.appDescriptionHint} error={errors.description}>
          {({ id, ...aria }) => (
            <Textarea id={id} {...aria} rows={2} maxLength={500} dir="auto" value={description} onChange={(e) => setDescription(e.target.value)} />
          )}
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label={t.iconUrl}
            hint={t.iconUrlHint}
            error={errors.iconUrl}
            type="url"
            dir="ltr"
            inputMode="url"
            placeholder="https://"
            maxLength={500}
            value={iconUrl}
            onChange={(e) => setIconUrl(e.target.value)}
          />
          <TextField
            label={t.appUrl}
            hint={t.appUrlHint}
            error={errors.appUrl}
            type="url"
            dir="ltr"
            inputMode="url"
            placeholder="https://"
            maxLength={500}
            value={appUrl}
            onChange={(e) => setAppUrl(e.target.value)}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">
            {t.redirectUris}
            <span className="text-danger"> *</span>
          </legend>
          <p className="text-xs text-ink-soft">{t.redirectUrisHint}</p>
          {redirects.map((uri, index) => {
            const rowId = `${baseId}-redirect-${index}`;
            const rowError = redirectErrors[index];
            return (
              <div key={index}>
                <div className="flex items-center gap-2">
                  <label htmlFor={rowId} className="sr-only">
                    {fmt(t.redirectUriLabel, { n: index + 1 })}
                  </label>
                  <Input
                    id={rowId}
                    type="url"
                    dir="ltr"
                    inputMode="url"
                    placeholder="https://example.com/zimos/callback"
                    maxLength={500}
                    aria-invalid={rowError ? true : undefined}
                    value={uri}
                    onChange={(e) => {
                      const value = e.target.value;
                      setRedirects((prev) => prev.map((item, i) => (i === index ? value : item)));
                      if (rowError) setRedirectErrors((prev) => ({ ...prev, [index]: "" }));
                      if (errors.redirectUris) setErrors((prev) => ({ ...prev, redirectUris: undefined }));
                    }}
                  />
                  {redirects.length > 1 && (
                    <button
                      type="button"
                      aria-label={fmt(t.removeRedirect, { n: index + 1 })}
                      title={fmt(t.removeRedirect, { n: index + 1 })}
                      onClick={() => {
                        setRedirects((prev) => prev.filter((_, i) => i !== index));
                        setRedirectErrors({});
                      }}
                      className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-soft hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <IconClose className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
                {rowError && <p className="mt-1 text-xs font-medium text-danger">{rowError}</p>}
              </div>
            );
          })}
          {errors.redirectUris && <p className="text-xs font-medium text-danger">{errors.redirectUris}</p>}
          {redirects.length < MAX_REDIRECTS && (
            <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => setRedirects((prev) => [...prev, ""])}>
              <IconPlus className="size-4" aria-hidden />
              {t.addRedirect}
            </Button>
          )}
        </fieldset>

        <div>
          <TextField
            label={t.uninstallUrl}
            hint={t.uninstallUrlHint}
            error={errors.uninstallUrl}
            type="url"
            dir="ltr"
            inputMode="url"
            placeholder="https://"
            maxLength={500}
            value={uninstallUrl}
            onChange={(e) => setUninstallUrl(e.target.value)}
          />
          {/* The guide sits on the page behind this dialog: a new tab keeps what was typed here. */}
          <a
            href={`${DEVELOPERS_PATH}#${GUIDE_ANCHOR}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex min-h-9 items-center text-xs font-medium text-primary hover:underline"
          >
            {t.uninstallGuide}
          </a>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-ink">
            {t.permissions}
            <span className="text-danger"> *</span>
          </legend>
          <p className="text-xs text-ink-soft">{t.permissionsHint}</p>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {groups.map(([resource, scopes]) => (
              <div key={resource}>
                <p className="mb-1 text-xs font-semibold text-ink-soft">{resourceName(resource)}</p>
                {scopes.map((scope) => (
                  <label key={scope} className="flex min-h-11 cursor-pointer items-start gap-2 py-1.5 text-sm text-ink">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                      checked={picked.has(scope)}
                      onChange={(e) => toggle(scope, e.target.checked)}
                    />
                    <span className="min-w-0">
                      <span className="block">{scopeLabel(scopeText, scope)}</span>
                      <code dir="ltr" className="block font-mono text-xs text-ink-soft">
                        {scope}
                      </code>
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </div>
          {errors.scopes && <p className="text-xs font-medium text-danger">{errors.scopes}</p>}
        </fieldset>

        {formError && <Alert variant="danger">{formError}</Alert>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" className="min-h-11" disabled={busy}>
            {app ? (busy ? t.saving : t.save) : busy ? t.creating : t.create}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** One key in a box with its copy button. */
function KeyBox({ label, value, copyLabel, badge }: { label: string; value: string; copyLabel: string; badge?: string }) {
  return (
    <div>
      <p className="mb-1 flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
        {label}
        {badge && <StatusBadge value="once" tone="warning" text={badge} />}
      </p>
      <div className="flex items-center gap-2 rounded-md border border-line bg-paper p-2">
        <code dir="ltr" className="min-w-0 flex-1 select-all break-all font-mono text-xs text-ink">
          {value}
        </code>
        <CopyButton value={value} label={copyLabel} labelClassName="sr-only sm:not-sr-only" className="min-h-11 shrink-0" />
      </div>
    </div>
  );
}

/** The Client ID and the Client Secret of a new app, or the new secret after a rotation: the only time the secret is shown. */
export function PartnerAppSecretDialog({ app, rotated, onClose }: { app: PartnerAppWithSecret; rotated: boolean; onClose: () => void }) {
  const t: PartnerAppText = useT(PARTNER_APP_STRINGS);
  return (
    <Modal
      open
      onClose={onClose}
      title={rotated ? t.rotatedTitle : t.createdTitle}
      footer={
        <Button className="min-h-11" onClick={onClose}>
          {t.done}
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">{t.secretBody}</p>
        <KeyBox label={t.clientId} value={app.clientId} copyLabel={t.copyClientId} />
        <KeyBox label={t.clientSecret} value={app.clientSecret} copyLabel={t.copySecret} badge={t.shownOnce} />
      </div>
    </Modal>
  );
}
