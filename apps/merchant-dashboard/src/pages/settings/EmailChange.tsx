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
    cancelChange: "Cancel this change",
    cancelled: "The email change was cancelled.",
    sent: "Check {email} for the confirmation link.",
    unchanged: "That is already your email.",
    taken: "Another account uses that email.",
    wrongPassword: "The password is not right.",
  },
  ar: {
    change: "تغيير البريد",
    newEmail: "البريد الجديد",
    password: "كلمة المرور",
    passwordHint: "للتأكد أنك صاحب الحساب.",
    send: "إرسال رابط التأكيد",
    sending: "جارٍ الإرسال…",
    cancel: "إلغاء",
    pending: "أرسلنا رابطًا إلى {email}. يتغيّر بريدك عند فتحه (صالح حتى {until}). حتى ذلك الحين تسجّل الدخول ببريدك الحالي.",
    cancelChange: "إلغاء هذا التغيير",
    cancelled: "تم إلغاء تغيير البريد.",
    sent: "افتح {email} لتجد رابط التأكيد.",
    unchanged: "هذا بريدك الحالي بالفعل.",
    taken: "هذا البريد مستخدم في حساب آخر.",
    wrongPassword: "كلمة المرور غير صحيحة.",
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

  return (
    <div className="sm:col-span-2">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="mt-0.5 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <bdi dir="ltr" className="break-all font-medium text-ink">
            {user.email}
          </bdi>
          {!open && (
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
              {t.change}
            </Button>
          )}
        </div>
        {pending && (
          <Alert variant="info">
            <p>{fmt(t.pending, { email: pending.newEmail, until: formatDate(pending.expiresAt) })}</p>
            <button type="button" disabled={busy} onClick={() => void cancelPending()} className="mt-1 cursor-pointer text-sm font-medium text-primary hover:underline">
              {t.cancelChange}
            </button>
          </Alert>
        )}
        {open && (
          <form onSubmit={submit} className="max-w-md space-y-3">
            {error && <Alert variant="danger">{error}</Alert>}
            <TextField label={t.newEmail} type="email" dir="ltr" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
            <TextField label={t.password} hint={t.passwordHint} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={200} />
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={busy || !email.trim()}>
                {busy ? t.sending : t.send}
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
                {t.cancel}
              </Button>
            </div>
          </form>
        )}
      </dd>
    </div>
  );
}
