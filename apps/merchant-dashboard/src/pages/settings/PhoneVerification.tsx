import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import { phoneVerificationConfirm, phoneVerificationRequest, type PhoneVerificationChannel } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { SettingsRow } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { PhoneChangeByCode, usePhoneChangeByCode } from "./EmailChangeByCode";

const STRINGS = {
  en: {
    phone: "Phone",
    why: "A verified number can get sign-in codes and alerts on WhatsApp.",
    none: "No phone number yet",
    verified: "Verified",
    unverified: "Not verified",
    verify: "Verify phone",
    change: "Change number",
    title: "Verify your phone",
    description: "We send a 6-digit code to this number. A verified number can receive sign-in codes on WhatsApp.",
    number: "Mobile number",
    numberHint: "With the country code, e.g. +20 10 1234 5678, or a local Egyptian number.",
    via: "Send the code by",
    whatsapp: "WhatsApp",
    sms: "SMS",
    send: "Send code",
    sending: "Sending…",
    sentWhatsapp: "We sent a code to {phone} on WhatsApp.",
    sentSms: "We sent a code to {phone} by SMS.",
    code: "Code",
    confirm: "Verify",
    confirming: "Checking…",
    resend: "Send a new code",
    back: "Use another number",
    cancel: "Cancel",
    done: "Your phone number is verified.",
  },
  ar: {
    phone: "الموبايل",
    why: "الرقم الموثّق بيوصله أكواد الدخول والتنبيهات على واتساب.",
    none: "لسه مفيش رقم",
    verified: "موثّق",
    unverified: "مش موثّق",
    verify: "وثّق الرقم",
    change: "غيّر الرقم",
    title: "وثّق رقم موبايلك",
    description: "هنبعت كود من 6 أرقام على الرقم ده. الرقم الموثّق بيوصله أكواد الدخول على واتساب.",
    number: "رقم الموبايل",
    numberHint: "بكود الدولة، مثل ‎+20 10 1234 5678‎، أو رقم مصري محلي.",
    via: "ابعت الكود على",
    whatsapp: "واتساب",
    sms: "رسالة نصية",
    send: "ابعت الكود",
    sending: "بنبعت…",
    sentWhatsapp: "بعتنا كود على {phone} على واتساب.",
    sentSms: "بعتنا كود على {phone} برسالة SMS.",
    code: "الكود",
    confirm: "وثّق",
    confirming: "بنتأكد…",
    resend: "ابعت كود جديد",
    back: "استخدم رقم تاني",
    cancel: "إلغاء",
    done: "رقم موبايلك اتوثّق.",
  },
} satisfies Messages;

/**
 * The phone row of "Your account" (SPEC §17.2 "Merchant phone number:
 * confirmation via OTP"): the number, whether it is verified, and a dialog
 * that sends a code by WhatsApp or SMS and checks it.
 */
export function PhoneVerification() {
  const t = useT(STRINGS);
  const { user, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);
  // While the server allows it, a verified number is changed with the password and an SMS code (handoff 332).
  const byCode = usePhoneChangeByCode();
  if (!user) return null;
  const verified = Boolean(user.phone && user.phoneVerifiedAt);

  return (
    <>
      <SettingsRow
        label={t.phone}
        hint={verified ? undefined : t.why}
        control={
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
            {user.phone ? (
              <bdi dir="ltr" className="text-sm font-medium text-ink tabular-nums">
                {user.phone}
              </bdi>
            ) : (
              <span className="text-sm text-ink-soft">{t.none}</span>
            )}
            {user.phone && (
              <StatusBadge value={verified ? "verified" : "unverified"} tone={verified ? "success" : "warning"} text={verified ? t.verified : t.unverified} />
            )}
            <Button variant="outline" className="min-h-11" onClick={() => setOpen(true)}>
              {verified ? t.change : t.verify}
            </Button>
          </div>
        }
      />
      {open && byCode && verified && <PhoneChangeByCode onClose={() => setOpen(false)} />}
      {open && !(byCode && verified) && (
        <PhoneDialog
          initialPhone={verified ? "" : user.phone ?? ""}
          onClose={() => setOpen(false)}
          onVerified={async () => {
            setOpen(false);
            await refreshUser();
          }}
        />
      )}
    </>
  );
}

function PhoneDialog({ initialPhone, onClose, onVerified }: { initialPhone: string; onClose: () => void; onVerified: () => Promise<void> }) {
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [phone, setPhone] = useState(initialPhone);
  const [channel, setChannel] = useState<PhoneVerificationChannel>("whatsapp");
  const [sentVia, setSentVia] = useState<PhoneVerificationChannel | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await phoneVerificationRequest(apiClient, { phone: phone.trim(), channel });
      setSentVia(res.sentVia ?? channel);
      setCode("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await phoneVerificationConfirm(apiClient, { phone: phone.trim(), code: code.trim() });
      toast.success(t.done);
      await onVerified();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={busy ? () => undefined : onClose} title={t.title} description={t.description}>
      {sentVia === null ? (
        <form onSubmit={send} className="space-y-4">
          <TextField
            label={t.number}
            hint={t.numberHint}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">{t.via}</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {(["whatsapp", "sms"] as const).map((kind) => (
                <label key={kind} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
                  <input type="radio" name="phone-code-channel" checked={channel === kind} onChange={() => setChannel(kind)} />
                  {kind === "whatsapp" ? t.whatsapp : t.sms}
                </label>
              ))}
            </div>
          </fieldset>
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={onClose} disabled={busy}>
              {t.cancel}
            </Button>
            <Button type="submit" className="min-h-11" disabled={busy || phone.trim().length < 6}>
              {busy ? t.sending : t.send}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={confirm} className="space-y-4">
          <p className="text-sm text-ink">{fmt(sentVia === "whatsapp" ? t.sentWhatsapp : t.sentSms, { phone: phone.trim() })}</p>
          <TextField
            label={t.code}
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-3 text-sm">
              <button type="button" className="min-h-11 cursor-pointer font-medium text-primary hover:underline" onClick={() => void send()} disabled={busy}>
                {t.resend}
              </button>
              <button type="button" className="min-h-11 cursor-pointer font-medium text-primary hover:underline" onClick={() => setSentVia(null)} disabled={busy}>
                {t.back}
              </button>
            </div>
            <Button type="submit" className="min-h-11" disabled={busy || code.length !== 6}>
              {busy ? t.confirming : t.confirm}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
