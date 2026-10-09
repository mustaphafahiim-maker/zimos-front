import { useState, type FormEvent } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  ApiError,
  apiFieldProblems,
  teamChannelsCreate,
  teamChannelsUpdate,
  type TeamChannel,
  type TeamChannelCreate,
  type TeamChannelLocale,
  type TeamChannelProvider,
  type TeamChannelUpdate,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { NOTIFICATION_STRINGS } from "@/lib/notificationText";
import { useT } from "@/i18n/LocaleContext";
import { Field } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Segmented } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { TEAM_CHANNEL_STRINGS, alertTypeLabel, providerLabel, type TeamChannelStrings } from "./teamChannelStrings";

type FieldName = "name" | "types" | "botToken" | "chatId" | "webhookUrl";

interface Draft {
  provider: TeamChannelProvider;
  name: string;
  locale: TeamChannelLocale;
  types: string[];
  botToken: string;
  chatId: string;
  webhookUrl: string;
}

/** The server's field errors in the dashboard's words (the handoff's wording per field). */
function fieldCopy(t: TeamChannelStrings, provider: TeamChannelProvider, field: string): string | null {
  if (field === "botToken") return t.err_botToken;
  if (field === "chatId") return t.err_chatId;
  if (field === "webhookUrl") return provider === "slack" ? t.err_webhook_slack : t.err_webhook_discord;
  if (field === "types" || field.startsWith("types.")) return t.err_types;
  if (field === "name") return t.nameRequired;
  return null;
}

/**
 * «أضف قناة» / «تعديل القناة» (handoff 378): the provider (chosen once — a
 * saved channel keeps its own), a name, the language its messages are written
 * in, the alerts it gets, and the provider's secret with how to get it.
 *
 * In edit mode the secret fields start empty with the saved hint as their
 * placeholder: left empty they are not sent, so the saved secret stays. Only
 * what changed goes in the PATCH. Saving sends nothing to the channel.
 */
export function TeamChannelDialog({
  channel,
  providers,
  types,
  onClose,
  onSaved,
}: {
  /** The channel being edited; null adds a new one. */
  channel: TeamChannel | null;
  providers: TeamChannelProvider[];
  /** The alert types this person may route. */
  types: string[];
  onClose: () => void;
  onSaved: (channel: TeamChannel, created: boolean) => void;
}) {
  const t = useT(TEAM_CHANNEL_STRINGS);
  const nt = useT(NOTIFICATION_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const editing = channel !== null;

  const [draft, setDraft] = useState<Draft>(() => ({
    provider: channel?.provider ?? providers[0] ?? "telegram",
    name: channel?.name ?? "",
    locale: channel?.locale ?? "ar",
    types: channel?.types ?? (types.includes("order.new") ? ["order.new"] : []),
    botToken: "",
    chatId: "",
    webhookUrl: "",
  }));
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (key in errors) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  // A channel may hold a type this person can't route (or one retired since): it stays listed, so it is not dropped on save.
  const offered = [...types, ...draft.types.filter((type) => !types.includes(type))];
  const telegram = draft.provider === "telegram";

  function toggleType(type: string, on: boolean) {
    set("types", on ? [...draft.types, type] : draft.types.filter((existing) => existing !== type));
  }

  function check(): Partial<Record<FieldName, string>> {
    const found: Partial<Record<FieldName, string>> = {};
    if (!draft.name.trim()) found.name = t.nameRequired;
    if (draft.types.length === 0) found.types = t.typesRequired;
    if (!editing) {
      if (telegram && !draft.botToken.trim()) found.botToken = t.err_botToken;
      if (telegram && !draft.chatId.trim()) found.chatId = t.err_chatId;
      if (!telegram && !draft.webhookUrl.trim()) found.webhookUrl = fieldCopy(t, draft.provider, "webhookUrl") ?? "";
    }
    return found;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const found = check();
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const name = draft.name.trim();
      if (channel) {
        const patch: TeamChannelUpdate = {};
        if (name !== channel.name) patch.name = name;
        if (draft.locale !== channel.locale) patch.locale = draft.locale;
        if (draft.types.length !== channel.types.length || draft.types.some((type) => !channel.types.includes(type))) patch.types = draft.types;
        if (telegram && draft.botToken.trim()) patch.botToken = draft.botToken.trim();
        if (telegram && draft.chatId.trim()) patch.chatId = draft.chatId.trim();
        if (!telegram && draft.webhookUrl.trim()) patch.webhookUrl = draft.webhookUrl.trim();
        // Nothing changed: nothing to send.
        onSaved(Object.keys(patch).length > 0 ? await teamChannelsUpdate(apiClient, workspaceId, channel.id, patch) : channel, false);
      } else {
        const common = { name, locale: draft.locale, types: draft.types };
        const body: TeamChannelCreate =
          draft.provider === "telegram"
            ? { ...common, provider: "telegram", botToken: draft.botToken.trim(), chatId: draft.chatId.trim() }
            : { ...common, provider: draft.provider, webhookUrl: draft.webhookUrl.trim() };
        onSaved(await teamChannelsCreate(apiClient, workspaceId, body), true);
      }
    } catch (err) {
      const problems = apiFieldProblems(err);
      const mapped: Partial<Record<FieldName, string>> = {};
      for (const problem of problems) {
        const head = problem.field.split(".")[0] as FieldName;
        const copy = fieldCopy(t, draft.provider, problem.field);
        if (copy && !mapped[head]) mapped[head] = copy;
      }
      if (Object.keys(mapped).length > 0) setErrors(mapped);
      else if (err instanceof ApiError && err.code === "TEAM_CHANNEL_TYPE_FORBIDDEN") setFailure(t.err_forbidden);
      else if (err instanceof ApiError && err.code === "TEAM_CHANNEL_LIMIT") setFailure(t.limit);
      else setFailure(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const help = (t as Record<string, string>)[`help_${draft.provider}`];
  const secretPlaceholder = editing ? (channel?.hint ?? undefined) : undefined;

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? t.editTitle : t.addTitle}
      className="sm:max-w-xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            {t.cancel}
          </Button>
          <Button type="submit" form="team-channel-form" disabled={saving} aria-busy={saving}>
            {saving ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <form id="team-channel-form" className="space-y-4" onSubmit={(event) => void submit(event)} noValidate>
        {failure && (
          <Alert variant="danger">
            {failure}
          </Alert>
        )}

        {!editing && providers.length > 1 && (
          <Segmented
            className="w-full"
            label={t.providerLabel}
            value={draft.provider}
            onChange={(provider) => {
              set("provider", provider);
              setErrors({});
            }}
            options={providers.map((provider) => ({ value: provider, label: providerLabel(t, provider) }))}
          />
        )}

        <Field label={t.name} required error={errors.name}>
          {({ id, ...aria }) => (
            <Input id={id} {...aria} dir="auto" maxLength={100} placeholder={t.namePlaceholder} value={draft.name} onChange={(e) => set("name", e.target.value)} />
          )}
        </Field>

        <Field label={t.language}>
          {({ id }) => (
            <Select id={id} className="h-11" value={draft.locale} onChange={(e) => set("locale", e.target.value as TeamChannelLocale)}>
              <option value="ar">{t.lang_ar}</option>
              <option value="en">{t.lang_en}</option>
            </Select>
          )}
        </Field>

        <fieldset>
          <legend className="text-sm font-medium text-ink">{t.types}</legend>
          <ul className="mt-2 grid gap-x-3 sm:grid-cols-2">
            {offered.map((type) => (
              <li key={type}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius)] px-1 text-sm text-ink hover:bg-paper-sunken">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 cursor-pointer accent-primary"
                    checked={draft.types.includes(type)}
                    onChange={(e) => toggleType(type, e.target.checked)}
                  />
                  <span className="min-w-0">{alertTypeLabel(t, nt, type)}</span>
                </label>
              </li>
            ))}
          </ul>
          {errors.types && (
            <p role="alert" className="mt-1 text-xs font-medium text-danger">
              {errors.types}
            </p>
          )}
        </fieldset>

        {telegram ? (
          <>
            <Field label={t.botToken} required={!editing} error={errors.botToken} hint={editing ? t.keep : undefined}>
              {({ id, ...aria }) => (
                <Input
                  id={id}
                  {...aria}
                  type="password"
                  dir="ltr"
                  autoComplete="off"
                  maxLength={100}
                  placeholder={editing ? "••••••••" : undefined}
                  value={draft.botToken}
                  onChange={(e) => set("botToken", e.target.value)}
                />
              )}
            </Field>
            <Field label={t.chatId} required={!editing} error={errors.chatId} hint={editing ? t.keep : undefined}>
              {({ id, ...aria }) => (
                <Input
                  id={id}
                  {...aria}
                  dir="ltr"
                  autoComplete="off"
                  maxLength={40}
                  placeholder={secretPlaceholder ?? "-1001234567890"}
                  value={draft.chatId}
                  onChange={(e) => set("chatId", e.target.value)}
                />
              )}
            </Field>
          </>
        ) : (
          <Field label={t.webhookUrl} required={!editing} error={errors.webhookUrl} hint={editing ? t.keep : undefined}>
            {({ id, ...aria }) => (
              <Input
                id={id}
                {...aria}
                type="url"
                dir="ltr"
                autoComplete="off"
                maxLength={500}
                placeholder={secretPlaceholder}
                value={draft.webhookUrl}
                onChange={(e) => set("webhookUrl", e.target.value)}
              />
            )}
          </Field>
        )}

        {help && <p className="rounded-[var(--radius)] bg-paper-sunken px-3 py-2.5 text-[13px] leading-6 text-ink-soft">{help}</p>}
      </form>
    </Modal>
  );
}
