import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  accountEmailChangeConfirm,
  accountEmailChangeRequest,
  accountErrorCode,
  accountPhoneChangeConfirm,
  accountPhoneChangeRequest,
  accountReauthCode,
  apiErrorDetails,
  type AccountCodeSent,
  type AccountProof,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { CodeEntry, ltrText, useSecondsUntil } from "./CodeEntry";

const STRINGS = {
  en: {
    emailTitle: "Change email",
    phoneTitle: "Change number",
    newEmail: "New email",
    newPhone: "New number",
    password: "Current password",
    reauthSend: "Send a code to my current email",
    reauthSending: "Sending…",
    reauthSent: "We sent a code to {target}.",
    reauthCode: "The code sent to your current email",
    sendEmail: "Send a code to the new email",
    sendPhone: "Send a code to the new number",
    sending: "Sending…",
    cancel: "Cancel",
    emailSent: "We sent a 6-digit code to {target}",
    phoneSent: "We texted a code to {target}",
    code: "Code",
    confirm: "Confirm",
    confirming: "Checking…",
    resend: "Send it again",
    resendWait: "You can ask for a new code in {s} s",
    back: "Change the details",
    again: "Ask for a new code to your current email, then send again.",
    SAME_EMAIL: "This is already your email",
    SAME_PHONE: "This is already your number",
    INVALID_PHONE: "Enter a valid mobile number",
    PHONE_COUNTRY_NOT_SUPPORTED: "We can't send codes to this country",
    INVALID_PASSWORD: "The password isn't right",
    REAUTH_CODE_REQUIRED: "Ask for a code to your current email and enter it",
    INVALID_CODE: "Wrong code — {attemptsLeft} tries left",
    codeDead: "This code is no longer valid — ask for a new one",
    EMAIL_TAKEN: "This email is used by another account",
    RESEND_TOO_SOON: "Wait a moment before asking for another code",
    tooMany: "Too many requests — try again later",
    EMAIL_UNAVAILABLE: "We can't send email codes right now — try again shortly",
    SMS_UNAVAILABLE: "We can't send text messages right now — try again shortly",
  },
  ar: {
    emailTitle: "تغيير البريد",
    phoneTitle: "تغيير الرقم",
    newEmail: "البريد الجديد",
    newPhone: "الرقم الجديد",
    password: "كلمة المرور الحالية",
    reauthSend: "ابعتلي رمز على بريدي الحالي",
    reauthSending: "بنبعت…",
    reauthSent: "بعتنا رمز على {target}.",
    reauthCode: "الرمز اللي وصلك على بريدك الحالي",
    sendEmail: "ابعت رمز للبريد الجديد",
    sendPhone: "ابعت رمز للرقم الجديد",
    sending: "بنبعت…",
    cancel: "إلغاء",
    emailSent: "بعتنا رمز من 6 أرقام على {target}",
    phoneSent: "بعتنا رمز في رسالة على {target}",
    code: "الرمز",
    confirm: "تأكيد",
    confirming: "بنتأكد…",
    resend: "ابعت الرمز تاني",
    resendWait: "تقدر تطلب رمز جديد بعد {s} ثانية",
    back: "غيّر البيانات",
    again: "اطلب رمز جديد على بريدك الحالي، وبعدين ابعت تاني.",
    SAME_EMAIL: "ده بريدك الحالي بالفعل",
    SAME_PHONE: "ده رقمك الحالي بالفعل",
    INVALID_PHONE: "اكتب رقم موبايل صحيح",
    PHONE_COUNTRY_NOT_SUPPORTED: "مش بنبعت رموز للدولة دي",
    INVALID_PASSWORD: "كلمة المرور مش صحيحة",
    REAUTH_CODE_REQUIRED: "اطلب رمز على بريدك الحالي واكتبه",
    INVALID_CODE: "الرمز غلط — باقي {attemptsLeft} محاولات",
    codeDead: "الرمز ده مبقاش صالح — اطلب رمز جديد",
    EMAIL_TAKEN: "البريد ده مستخدم في حساب تاني",
    RESEND_TOO_SOON: "استنى شوية قبل ما تطلب رمز جديد",
    tooMany: "طلبات كتير — جرّب بعد شوية",
    EMAIL_UNAVAILABLE: "مش قادرين نبعت رموز على البريد دلوقتي — جرّب كمان شوية",
    SMS_UNAVAILABLE: "مش قادرين نبعت رسائل دلوقتي — جرّب كمان شوية",
  },
} satisfies Messages;

type Problem = { where: "value" | "proof" | "form"; message: string };

/**
 * Changing the sign-in email or the mobile number with codes (handoff 332),
 * in two steps: the new value with the proof that it is the owner asking (the
 * password, or for an account made through Google a code sent to its current
 * email), then the 6-digit code sent to the new address or number.
 *
 * A wrong password answers 422, never 401: the dashboard stays signed in.
 */
export function CodeChangeDialog({
  kind,
  hasPassword,
  onClose,
  onChanged,
}: {
  kind: "email" | "phone";
  hasPassword: boolean;
  onClose: () => void;
  /** The change went through (for the email, the new tokens are already kept). */
  onChanged: () => void | Promise<void>;
}) {
  const t = useT(STRINGS);
  const labels = t as Record<string, string>;
  const { locale } = useLocale();
  const errorMessage = useErrorMessage();
  const [value, setValue] = useState("");
  const [password, setPassword] = useState("");
  const [reauth, setReauth] = useState("");
  const [reauthSent, setReauthSent] = useState<AccountCodeSent | null>(null);
  const [sent, setSent] = useState<AccountCodeSent | null>(null);
  const [busy, setBusy] = useState<"reauth" | "send" | "confirm" | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const reauthWait = useSecondsUntil(reauthSent?.resendAvailableAt);

  function describe(err: unknown): Problem {
    const code = accountErrorCode(err) ?? "";
    switch (code) {
      case "SAME_EMAIL":
      case "SAME_PHONE":
      case "INVALID_PHONE":
      case "PHONE_COUNTRY_NOT_SUPPORTED":
      case "EMAIL_TAKEN":
        return { where: "value", message: labels[code] };
      case "INVALID_PASSWORD":
      case "REAUTH_CODE_REQUIRED":
        return { where: "proof", message: labels[code] };
      case "INVALID_CODE":
        return { where: "form", message: fmt(t.INVALID_CODE, { attemptsLeft: apiErrorDetails<{ attemptsLeft?: number }>(err)?.attemptsLeft ?? 0 }) };
      case "CODE_EXPIRED":
      case "NO_ACTIVE_CODE":
      case "TOO_MANY_ATTEMPTS":
        return { where: "form", message: t.codeDead };
      case "VERIFICATION_LIMIT_REACHED":
      case "RATE_LIMITED":
        return { where: "form", message: t.tooMany };
      case "RESEND_TOO_SOON":
      case "EMAIL_UNAVAILABLE":
      case "SMS_UNAVAILABLE":
        return { where: "form", message: labels[code] };
      default:
        return { where: "form", message: errorMessage(err) };
    }
  }

  async function askReauth() {
    setBusy("reauth");
    setProblem(null);
    try {
      setReauthSent(await accountReauthCode(apiClient, locale));
      setReauth("");
    } catch (err) {
      setProblem(describe(err));
    } finally {
      setBusy(null);
    }
  }

  /** Step 1's request; "send it again" repeats it with the proof still in hand. */
  async function request(): Promise<Problem | null> {
    const proof: AccountProof = hasPassword ? { currentPassword: password } : { reauthCode: reauth };
    setBusy("send");
    setProblem(null);
    try {
      const answer =
        kind === "email"
          ? await accountEmailChangeRequest(apiClient, { newEmail: value.trim(), locale, ...proof })
          : await accountPhoneChangeRequest(apiClient, { newPhone: value.trim(), locale, ...proof });
      setSent(answer);
      return null;
    } catch (err) {
      let next = describe(err);
      // A wrong code to the current email is said under that field, on step 1.
      if (!hasPassword && next.where === "form" && /CODE|ATTEMPTS/.test(accountErrorCode(err) ?? "")) next = { ...next, where: "proof" };
      setProblem(next);
      return next;
    } finally {
      setBusy(null);
    }
  }

  async function resend() {
    // The code to the current email works once: an account without a password asks for a new one first.
    if (!hasPassword) {
      setSent(null);
      setReauth("");
      setReauthSent(null);
      setProblem({ where: "proof", message: t.again });
      return;
    }
    const failed = await request();
    // Whatever was wrong with step 1 is fixed on step 1.
    if (failed && failed.where !== "form") setSent(null);
  }

  async function confirm(code: string) {
    setBusy("confirm");
    setProblem(null);
    try {
      if (kind === "email") await accountEmailChangeConfirm(apiClient, code);
      else await accountPhoneChangeConfirm(apiClient, code);
      await onChanged();
    } catch (err) {
      const next = describe(err);
      // The address was taken meanwhile: back to step 1 to choose another.
      if (next.where === "value") setSent(null);
      setProblem(next);
      setBusy(null);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    void request();
  }

  const proofReady = hasPassword ? password !== "" : reauth.length === 6;
  const at = (where: Problem["where"]) => (problem?.where === where ? problem.message : undefined);

  return (
    <Modal open onClose={busy ? () => undefined : onClose} title={kind === "email" ? t.emailTitle : t.phoneTitle}>
      {sent === null ? (
        <form onSubmit={submit} noValidate className="space-y-4">
          {at("form") && <Alert variant="danger">{at("form")}</Alert>}
          {kind === "email" ? (
            <TextField label={t.newEmail} type="email" dir="ltr" required autoComplete="email" maxLength={255} value={value} error={at("value")} onChange={(e) => setValue(e.target.value)} />
          ) : (
            <TextField label={t.newPhone} type="tel" inputMode="tel" dir="ltr" required autoComplete="tel" maxLength={32} value={value} error={at("value")} onChange={(e) => setValue(e.target.value)} />
          )}
          {hasPassword ? (
            <TextField label={t.password} type="password" required autoComplete="current-password" maxLength={200} value={password} error={at("proof")} onChange={(e) => setPassword(e.target.value)} />
          ) : (
            <div className="space-y-3">
              <div>
                <Button type="button" variant="outline" className="min-h-11" disabled={busy !== null || reauthWait > 0} onClick={() => void askReauth()}>
                  {busy === "reauth" ? t.reauthSending : t.reauthSend}
                </Button>
                {reauthSent && (
                  <p className="mt-1.5 text-[13px] leading-5 text-ink-soft tabular-nums">
                    {fmt(t.reauthSent, { target: ltrText(reauthSent.target ?? "") })}
                    {reauthWait > 0 && <span className="block">{fmt(t.resendWait, { s: reauthWait })}</span>}
                  </p>
                )}
              </div>
              <TextField
                label={t.reauthCode}
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                maxLength={6}
                required
                value={reauth}
                error={at("proof")}
                onChange={(e) => setReauth(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" className="min-h-11" disabled={busy !== null} onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit" className="min-h-11" disabled={busy !== null || value.trim() === "" || !proofReady}>
              {busy === "send" ? t.sending : kind === "email" ? t.sendEmail : t.sendPhone}
            </Button>
          </div>
        </form>
      ) : (
        <CodeEntry
          intro={fmt(kind === "email" ? t.emailSent : t.phoneSent, { target: ltrText(sent.target ?? value.trim()) })}
          label={t.code}
          confirmLabel={t.confirm}
          busyLabel={t.confirming}
          resendLabel={t.resend}
          resendWaitLabel={t.resendWait}
          resendAvailableAt={sent.resendAvailableAt}
          error={at("form") ?? null}
          busy={busy !== null}
          onConfirm={(code) => void confirm(code)}
          onResend={() => void resend()}
          extra={
            <button type="button" className="min-h-11 cursor-pointer text-sm font-medium text-primary hover:underline" disabled={busy !== null} onClick={() => setSent(null)}>
              {t.back}
            </button>
          }
        />
      )}
    </Modal>
  );
}
