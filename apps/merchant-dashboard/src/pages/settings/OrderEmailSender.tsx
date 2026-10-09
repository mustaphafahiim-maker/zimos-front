import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Input } from "@store-builder/ui";
import { orderEmailsSenderGet, orderEmailsSenderSet } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { isPermissionError } from "@/lib/errors";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { SaveBar } from "@/components/SaveBar";
import { SettingsGroup, SettingsRow } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { useReportDirty } from "@/lib/useUnsavedGuard";

const STRINGS = {
  en: {
    title: "Who the emails are from",
    fromName: "Sender name",
    fromNameHint: "What customers see as the sender. Empty: “{store}”.",
    replyTo: "Reply-To email",
    replyToHint: "Where a customer's reply goes. Empty: replies are not delivered to you.",
    save: "Save sender",
    saving: "Saving…",
    saved: "Sender saved.",
  },
  ar: {
    title: "الإيميل بيوصل باسم مين",
    fromName: "اسم المرسل",
    fromNameHint: "الاسم اللي العميل بيشوفه. فاضي: «{store}».",
    replyTo: "إيميل الرد (Reply-To)",
    replyToHint: "رد العميل بيوصل هنا. فاضي: الردود مش هتوصلك.",
    save: "احفظ المرسل",
    saving: "بنحفظ…",
    saved: "المرسل اتحفظ.",
  },
} satisfies Messages;

/**
 * The order emails' sender name and Reply-To (SPEC §14.5; backend
 * notifications/orderEmailSender.js). Emails still leave from the platform's
 * address; these decide the name customers see and where their replies go.
 */
export function OrderEmailSender() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const current = useAsync(() => orderEmailsSenderGet(apiClient, workspaceId), [workspaceId]);
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = useId();

  const savedName = current.data?.sender.fromName ?? "";
  const savedReplyTo = current.data?.sender.replyTo ?? "";
  const dirty = Boolean(current.data) && (fromName.trim() !== savedName || replyTo.trim() !== savedReplyTo);
  useReportDirty(dirty);

  useEffect(() => {
    if (!current.data) return;
    setFromName(current.data.sender.fromName ?? "");
    setReplyTo(current.data.sender.replyTo ?? "");
  }, [current.data]);

  if (current.error && isPermissionError(current.error)) return null;
  if (!current.data) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await orderEmailsSenderSet(apiClient, workspaceId, { fromName: fromName.trim() || null, replyTo: replyTo.trim() || null });
      current.setData(next);
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-[var(--bento-gap)]">
      <SettingsGroup title={t.title}>
        <SettingsRow
          label={t.fromName}
          hint={fmt(t.fromNameHint, { store: current.data.storeName })}
          htmlFor={`${ids}-name`}
          control={
            <Input
              id={`${ids}-name`}
              value={fromName}
              maxLength={70}
              onChange={(e) => setFromName(e.target.value)}
              className="h-11 w-full text-base sm:text-sm"
            />
          }
        />
        <SettingsRow
          label={t.replyTo}
          hint={t.replyToHint}
          htmlFor={`${ids}-reply`}
          control={
            <Input
              id={`${ids}-reply`}
              type="email"
              dir="ltr"
              value={replyTo}
              maxLength={255}
              onChange={(e) => setReplyTo(e.target.value)}
              className="h-11 w-full text-base sm:text-sm"
            />
          }
        />
      </SettingsGroup>
      {error && <Alert variant="danger">{error}</Alert>}
      <SaveBar
        dirty={dirty}
        saving={busy}
        saveLabel={t.save}
        savingLabel={t.saving}
        onDiscard={() => {
          setFromName(savedName);
          setReplyTo(savedReplyTo);
          setError(null);
        }}
      />
    </form>
  );
}
