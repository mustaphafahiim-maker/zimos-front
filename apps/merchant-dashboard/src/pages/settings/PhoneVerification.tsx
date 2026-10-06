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
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    phone: "Phone",
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
    phone: "الهاتف",
    none: "لا يوجد رقم هاتف بعد",
    verified: "موثّق",
    unverified: "غير موثّق",
    verify: "توثيق الهاتف",
    change: "تغيير الرقم",
    title: "توثيق رقم هاتفك",
    description: "نرسل كودًا من 6 أرقام إلى هذا الرقم. الرقم الموثّق يمكنه استقبال أكواد الدخول على واتساب.",
    number: "رقم الموبايل",
    numberHint: "بكود الدولة، مثل ‎+20 10 1234 5678‎، أو رقم مصري محلي.",
    via: "إرسال الكود عبر",
    whatsapp: "واتساب",
    sms: "رسالة نصية",
    send: "إرسال الكود",
    sending: "بنبعت…",
    sentWhatsapp: "أرسلنا كودًا إلى {phone} على واتساب.",
    sentSms: "أرسلنا كودًا إلى {phone} برسالة نصية.",
    code: "الكود",
    confirm: "توثيق",
    confirming: "بنتأكد…",
    resend: "إرسال كود جديد",
    back: "استخدام رقم آخر",
    cancel: "إلغاء",
    done: "تم توثيق رقم هاتفك.",
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
  if (!user) return null;
  const verified = Boolean(user.phone && user.phoneVerifiedAt);

  return (
    <div className="sm:col-span-2">
      <dt className="text-ink-soft">{t.phone}</dt>
      <dd className="mt-0.5 flex flex-wrap items-center gap-2">
        {user.phone ? (
          <bdi dir="ltr" className="font-medium text-ink">
            {user.phone}
          </bdi>
        ) : (
          <span className="text-ink-soft">{t.none}</span>
        )}
        {user.phone && (
          <StatusBadge value={verified ? "verified" : "unverified"} tone={verified ? "success" : "warning"} text={verified ? t.verified : t.unverified} />
        )}
        <Button size="sm" variant="outline" className="min-h-11" onClick={() => setOpen(true)}>
          {verified ? t.change : t.verify}
        </Button>
      </dd>
      {open && (
        <PhoneDialog
          initialPhone={verified ? "" : user.phone ?? ""}
          onClose={() => setOpen(false)}
          onVerified={async () => {
            setOpen(false);
            await refreshUser();
          }}
        />
      )}
    </div>
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
              <button type="button" className="text-primary hover:underline" onClick={() => void send()} disabled={busy}>
                {t.resend}
              </button>
              <button type="button" className="text-primary hover:underline" onClick={() => setSentVia(null)} disabled={busy}>
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
