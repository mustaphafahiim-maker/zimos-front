import { useId, useState, type FormEvent } from "react";
import { Alert, Button, Input, Label, cn } from "@store-builder/ui";
import type { AccountChangeRequest, AuthUser, VerificationChallenge, VerificationSent } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useLocale, useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { VerifyCodePanel } from "@/components/VerifyCodePanel";

const STRINGS = {
  en: {
    emailTitle: "Change your email",
    phoneTitle: "Change your mobile number",
    emailIntro: "We'll send a code to the new email. Your current email stays until you enter it.",
    phoneIntro: "We'll send a code by SMS to the new number. Your current number stays until you enter it.",
    newEmail: "New email",
    newPhone: "New mobile number",
    phoneHint: "An Egyptian mobile number, e.g. 01012345678",
    password: "Your current password",
    reauthIntro: "Your account signs in with Google. To confirm it's you, we'll send a code to your current email ({email}).",
    sendReauth: "Send me a code",
    reauthSent: "Code sent to {target}.",
    reauthCode: "The code from your current email",
    continue: "Send the code",
    sending: "Sending…",
    cancel: "Cancel",
    codeStep: "Enter the code we sent to {target}.",
    emailSignOut: "Once it's changed, you'll stay signed in here and be signed out everywhere else.",
    badPassword: "That password isn't right.",
    sameEmail: "This is already your email.",
    samePhone: "This is already your number.",
    invalidPhone: "Enter a valid mobile number.",
    emailTaken: "This email is already used by another account.",
    needCode: "Enter the code from your current email.",
    unavailable: "Codes can't be sent right now. Try again later.",
    restart: "Start again to get a new code.",
  },
  ar: {
    emailTitle: "تغيير بريدك الإلكتروني",
    phoneTitle: "تغيير رقم الموبايل",
    emailIntro: "سنرسل رمزًا إلى البريد الجديد. يبقى بريدك الحالي كما هو حتى تُدخل الرمز.",
    phoneIntro: "سنرسل رمزًا برسالة نصية إلى الرقم الجديد. يبقى رقمك الحالي كما هو حتى تُدخل الرمز.",
    newEmail: "البريد الإلكتروني الجديد",
    newPhone: "رقم الموبايل الجديد",
    phoneHint: "رقم موبايل مصري، مثل 01012345678",
    password: "كلمة المرور الحالية",
    reauthIntro: "يسجّل حسابك الدخول عبر Google. لنتأكد أنه أنت، سنرسل رمزًا إلى بريدك الحالي ({email}).",
    sendReauth: "أرسل لي رمزًا",
    reauthSent: "أُرسل الرمز إلى {target}.",
    reauthCode: "الرمز من بريدك الحالي",
    continue: "أرسل الرمز",
    sending: "جارٍ الإرسال…",
    cancel: "إلغاء",
    codeStep: "أدخل الرمز الذي أرسلناه إلى {target}.",
    emailSignOut: "بعد التغيير ستبقى مسجّلًا الدخول هنا وسيُسجَّل خروجك من الأجهزة الأخرى.",
    badPassword: "كلمة المرور غير صحيحة.",
    sameEmail: "هذا هو بريدك الحالي بالفعل.",
    samePhone: "هذا هو رقمك الحالي بالفعل.",
    invalidPhone: "أدخل رقم موبايل صحيحًا.",
    emailTaken: "هذا البريد مستخدم في حساب آخر.",
    needCode: "أدخل الرمز من بريدك الحالي.",
    unavailable: "لا يمكن إرسال الرموز الآن. حاول مرة أخرى لاحقًا.",
    restart: "ابدأ من جديد للحصول على رمز جديد.",
  },
} satisfies Messages;

type Kind = "email" | "phone";

/**
 * Changing the account's email or phone (auth/accountService): the new
 * address and proof that it's you (the current password, or a code to the
 * current email for an account made through Google), then the code sent to
 * the new address, in the same code panel as confirming an account.
 */
export function AccountChangeDialog({
  kind,
  open,
  email,
  hasPassword,
  onClose,
  onChanged,
}: {
  kind: Kind;
  open: boolean;
  email: string;
  hasPassword: boolean;
  onClose: () => void;
  onChanged: (user: AuthUser | null) => void | Promise<void>;
}) {
  const t = useT(STRINGS);
  return (
    <Modal open={open} onClose={onClose} title={kind === "email" ? t.emailTitle : t.phoneTitle}>
      {open && <Steps kind={kind} email={email} hasPassword={hasPassword} onClose={onClose} onChanged={onChanged} />}
    </Modal>
  );
}

function Steps({
  kind,
  email,
  hasPassword,
  onClose,
  onChanged,
}: {
  kind: Kind;
  email: string;
  hasPassword: boolean;
  onClose: () => void;
  onChanged: (user: AuthUser | null) => void | Promise<void>;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const errorMessage = useErrorMessage();
  const valueId = useId();
  const proofId = useId();
  const [value, setValue] = useState("");
  const [password, setPassword] = useState("");
  const [reauthCode, setReauthCode] = useState("");
  const [reauthInfo, setReauthInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState<"reauth" | "request" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<VerificationSent | null>(null);

  const proof = (): AccountChangeRequest => (hasPassword ? { currentPassword: password } : { reauthCode: reauthCode.trim() });
  const request = (): Promise<VerificationSent> =>
    kind === "email"
      ? apiClient.requestEmailChange({ newEmail: value.trim(), ...proof(), locale })
      : apiClient.requestPhoneChange({ newPhone: value.trim(), ...proof(), locale });
  const overrides = {
    INVALID_PASSWORD: t.badPassword,
    SAME_EMAIL: t.sameEmail,
    SAME_PHONE: t.samePhone,
    INVALID_PHONE: t.invalidPhone,
    REAUTH_CODE_REQUIRED: t.needCode,
    EMAIL_TAKEN: t.emailTaken,
    EMAIL_UNAVAILABLE: t.unavailable,
    SMS_UNAVAILABLE: t.unavailable,
  };

  async function sendReauth() {
    setBusy("reauth");
    setError(null);
    try {
      const reauth = await apiClient.sendReauthCode(locale);
      setReauthInfo(fmt(t.reauthSent, { target: reauth.target }));
    } catch (err) {
      setError(errorMessage(err, overrides));
    } finally {
      setBusy(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy("request");
    setError(null);
    try {
      setSent(await request());
    } catch (err) {
      setError(errorMessage(err, overrides));
    } finally {
      setBusy(null);
    }
  }

  if (sent) {
    const challenge: VerificationChallenge = {
      verificationRequired: true,
      verificationToken: "",
      channels: [sent.channel],
      targets: sent.channel === "sms" ? { email: "", sms: sent.target } : { email: sent.target },
      codeSent: true,
      channel: sent.channel,
      expiresAt: sent.expiresAt,
      resendAvailableAt: sent.resendAvailableAt,
    };
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">{fmt(t.codeStep, { target: sent.target })}</p>
        {kind === "email" && <p className="text-xs text-ink-soft">{t.emailSignOut}</p>}
        <VerifyCodePanel
          compact
          challenge={challenge}
          custom={{
            // A password account asks again with it; one made through Google
            // has used its code up, so it starts again for a new one.
            send: () => {
              if (hasPassword) return request();
              setSent(null);
              setReauthCode("");
              setReauthInfo(null);
              setError(t.restart);
              return new Promise<VerificationSent>(() => undefined);
            },
            confirm: (code) => (kind === "email" ? apiClient.confirmEmailChange(code) : apiClient.confirmPhoneChange(code)),
          }}
          onVerified={async (user) => {
            await onChanged(user);
            onClose();
          }}
        />
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
      <p className="text-sm text-ink-soft">{kind === "email" ? t.emailIntro : t.phoneIntro}</p>
      <div className="space-y-1.5">
        <Label htmlFor={valueId}>{kind === "email" ? t.newEmail : t.newPhone}</Label>
        <Input
          id={valueId}
          type={kind === "email" ? "email" : "tel"}
          inputMode={kind === "email" ? "email" : "tel"}
          autoComplete={kind === "email" ? "email" : "tel"}
          dir="ltr"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-h-11"
          required
        />
        {kind === "phone" && <p className="text-xs text-ink-soft">{t.phoneHint}</p>}
      </div>

      {hasPassword ? (
        <div className="space-y-1.5">
          <Label htmlFor={proofId}>{t.password}</Label>
          <Input
            id={proofId}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-11"
            required
          />
        </div>
      ) : (
        <div className="space-y-2 rounded-[10px] border border-line bg-paper px-4 py-3">
          <p className="text-sm text-ink-soft">{fmt(t.reauthIntro, { email: `⁦${email}⁩` })}</p>
          <Button type="button" variant="outline" onClick={() => void sendReauth()} disabled={busy !== null} className="min-h-10">
            {busy === "reauth" ? t.sending : t.sendReauth}
          </Button>
          {reauthInfo && <p className="text-xs text-ink-soft">{reauthInfo}</p>}
          <div className="space-y-1.5">
            <Label htmlFor={proofId}>{t.reauthCode}</Label>
            <Input
              id={proofId}
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={6}
              value={reauthCode}
              onChange={(e) => setReauthCode(e.target.value.replace(/\D/g, ""))}
              className={cn("min-h-11 font-mono tracking-[0.3em]")}
            />
          </div>
        </div>
      )}

      {error && <Alert variant="danger">{error}</Alert>}
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy !== null} className="min-h-11">
          {t.cancel}
        </Button>
        <Button type="submit" disabled={busy !== null || !value.trim() || (hasPassword ? !password : reauthCode.length !== 6)} className="min-h-11">
          {busy === "request" ? t.sending : t.continue}
        </Button>
      </div>
    </form>
  );
}
