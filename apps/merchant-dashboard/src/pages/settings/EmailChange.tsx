import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  emailChangeCancel,
  emailChangeGet,
  emailChangeRequest,
  isApiErrorCode,
  type EmailChangePending,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { SettingsRow } from "@/components/settings";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    change: "Change email",
    newEmail: "New email",
    password: "Your password",
    passwordHint: "To make sure it's you.",
    send: "Send confirmation link",
    sending: "Sending…",
    cancel: "Cancel",
    pending: "We sent a link to {email}. Your email changes when you open it (valid until {until}). Until then you sign in with your current email.",
    cancelChange: "Cancel the change",
    cancelled: "The email change was cancelled.",
    sent: "Check {email} for the confirmation link.",
    unchanged: "That is already your email.",
    taken: "Another account uses that email.",
    wrongPassword: "The password is not right.",
  },
  ar: {
    change: "غيّر الإيميل",
    newEmail: "الإيميل الجديد",
    password: "كلمة السر",
    passwordHint: "عشان نتأكد إنه إنت.",
    send: "ابعت لينك التأكيد",
    sending: "بنبعت…",
    cancel: "إلغاء",
    pending: "بعتنا لينك على {email}. إيميلك هيتغيّر لما تفتحه (شغّال لحد {until}). لحد ساعتها بتدخل بإيميلك الحالي.",
    cancelChange: "الغي التغيير",
    cancelled: "تغيير الإيميل اتلغى.",
    sent: "افتح {email} هتلاقي لينك التأكيد.",
    unchanged: "ده إيميلك الحالي أصلًا.",
    taken: "الإيميل ده مستخدم في حساب تاني.",
    wrongPassword: "كلمة السر مش صح.",
  },
} satisfies Messages;

/**
 * The sign-in email in "Your account" (SPEC §17.3 "owner email"): the current
 * one, and changing it — confirmed from a link sent to the new address
 * (backend auth/emailChange.js; the link opens EmailChangeConfirmPage).
 */
export function EmailChange({ label }: { label: string }) {
  const t = useT(STRINGS);
  const { user } = useAuth();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [pending, setPending] = useState<EmailChangePending | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    emailChangeGet(apiClient)
      .then((res) => live && setPending(res.pending))
      .catch(() => {
        /* the section still shows the current email */
      });
    return () => {
      live = false;
    };
  }, []);

  if (!user) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await emailChangeRequest(apiClient, email.trim(), password || undefined);
      setPending(res.pending);
      setOpen(false);
      setPassword("");
      toast.success(fmt(t.sent, { email: email.trim() }));
    } catch (err) {
      setError(
        isApiErrorCode(err, "EMAIL_UNCHANGED")
          ? t.unchanged
          : isApiErrorCode(err, "EMAIL_TAKEN")
            ? t.taken
            : isApiErrorCode(err, "INVALID_PASSWORD")
              ? t.wrongPassword
              : errorMessage(err)
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancelPending() {
    setBusy(true);
    try {
      await emailChangeCancel(apiClient);
      setPending(null);
      toast.success(t.cancelled);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setOpen(false);
    setError(null);
    setPassword("");
  }

  return (
    <>
      <SettingsRow
        label={label}
        hint={pending ? fmt(t.pending, { email: pending.newEmail, until: formatDate(pending.expiresAt) }) : undefined}
        control={
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
            <bdi dir="ltr" className="min-w-0 text-sm font-medium break-all text-ink">
              {user.email}
            </bdi>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(true)}>
              {t.change}
            </Button>
            {pending && (
              <Button type="button" variant="ghost" className="min-h-11" disabled={busy} onClick={() => void cancelPending()}>
                {t.cancelChange}
              </Button>
            )}
          </div>
        }
      />
      <Modal open={open} onClose={busy ? () => undefined : close} title={t.change}>
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <TextField label={t.newEmail} type="email" dir="ltr" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
          <TextField label={t.password} hint={t.passwordHint} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={200} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={close}>
              {t.cancel}
            </Button>
            <Button type="submit" className="min-h-11" disabled={busy || !email.trim()}>
              {busy ? t.sending : t.send}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
