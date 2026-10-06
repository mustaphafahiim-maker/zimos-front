import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import { orderEmailsSenderGet, orderEmailsSenderSet } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { isPermissionError } from "@/lib/errors";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Sender",
    fromName: "Sender name",
    fromNameHint: "What customers see as the sender. Empty: “{store}”.",
    replyTo: "Reply-To email",
    replyToHint: "Where a customer's reply goes. Empty: replies are not delivered to you.",
    save: "Save sender",
    saving: "Saving…",
    saved: "Sender saved.",
  },
  ar: {
    title: "المُرسِل",
    fromName: "اسم المُرسِل",
    fromNameHint: "ما يراه العميل كاسم المُرسِل. فارغ: «{store}».",
    replyTo: "بريد الرد (Reply-To)",
    replyToHint: "حيث يصل رد العميل. فارغ: لن تصلك الردود.",
    save: "حفظ المُرسِل",
    saving: "بنحفظ…",
    saved: "تم حفظ المُرسِل.",
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
      await orderEmailsSenderSet(apiClient, workspaceId, { fromName: fromName.trim() || null, replyTo: replyTo.trim() || null });
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-[var(--radius-card)] bg-paper p-4">
      <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label={t.fromName} hint={fmt(t.fromNameHint, { store: current.data.storeName })} value={fromName} maxLength={70} onChange={(e) => setFromName(e.target.value)} />
        <TextField label={t.replyTo} hint={t.replyToHint} type="email" dir="ltr" value={replyTo} maxLength={255} onChange={(e) => setReplyTo(e.target.value)} />
      </div>
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? t.saving : t.save}
      </Button>
    </form>
  );
}
