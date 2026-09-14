import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import { Info } from "lucide-react";
import type { CallCenterSettings } from "@/mock/types2";
import { mockApi } from "@/mock/api";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@store-builder/ui";
import { getErrorMessage } from "@/lib/errors";
import { useT, useCommon, fmt, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { Toggle } from "@store-builder/ui";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Call center settings",
    description: "How and when the team calls to confirm cash-on-delivery orders.",
    backLabel: "Call center",
    providerNone: "None (manual dialing)",
    fieldAccountSid: "Account SID",
    fieldAuthToken: "Auth token",
    fieldCallerId: "Caller ID number",
    fieldAccessKey: "Access key",
    fieldAccessSecret: "Access secret",
    fieldInstance: "Instance URL",
    fieldApiKey: "API key",
    errMaxAttempts: "Max attempts must be between 1 and 10.",
    errRetry: "Retry delay must be at least 5 minutes.",
    errFallback: "WhatsApp fallback attempt must be between 0 and max attempts.",
    errHours: "Working hours must end after they start.",
    toastSaved: "Call center settings saved.",
    flowTitle: "How confirmation flows",
    flowBody:
      "New COD order → WhatsApp message asks the customer to reply 1 → no reply within {minutes} min → order enters the call queue → up to {max} call attempts (retry every {minutes} min inside working hours) → {end} after the last attempt.",
    flowAutoCancelled: "auto-cancelled",
    flowFlagged: "flagged for review",
    secAttempts: "Attempts & retries",
    secAttemptsDesc: "How hard the team tries before giving up on an order.",
    maxAttempts: "Max attempts",
    maxAttemptsHint: "Calls before the order is closed.",
    retryAfter: "Retry after (minutes)",
    retryAfterHint: "Wait between attempts when no answer.",
    autoCancel: "Auto-cancel after max attempts",
    autoCancelDesc: "Off: the order is flagged for a manager instead of cancelled.",
    secHours: "Working hours",
    secHoursDesc: "Calls are only scheduled inside this window (Africa/Cairo).",
    from: "From",
    to: "To",
    secWhatsapp: "WhatsApp fallback",
    secWhatsappDesc: "Send a WhatsApp confirmation template when calls are not getting through.",
    whatsappAfter: "Send WhatsApp after attempt",
    whatsappAfterHint: "0 = send before the first call. Requires a connected WhatsApp number.",
    secVoip: "VoIP provider",
    secVoipDesc: "Connect a provider to click-to-call from the workstation and record calls.",
    provider: "Provider",
    credsNote: "Prototype: credentials are kept in this browser session only and are not sent anywhere.",
    recordCalls: "Record calls",
    recordCallsDesc: "Recordings appear in Call logs. Requires a VoIP provider.",
    reset: "Reset",
    saveSettings: "Save settings",
  },
  ar: {
    title: "إعدادات مركز الاتصال",
    description: "كيف ومتى يتصل الفريق لتأكيد طلبات الدفع عند الاستلام.",
    backLabel: "مركز الاتصال",
    providerNone: "بدون (اتصال يدوي)",
    fieldAccountSid: "معرّف الحساب (Account SID)",
    fieldAuthToken: "رمز المصادقة (Auth token)",
    fieldCallerId: "رقم المتصل الظاهر",
    fieldAccessKey: "مفتاح الوصول",
    fieldAccessSecret: "كلمة سر الوصول",
    fieldInstance: "رابط الحساب (Instance URL)",
    fieldApiKey: "مفتاح API",
    errMaxAttempts: "يجب أن يكون الحد الأقصى للمحاولات بين 1 و10.",
    errRetry: "يجب ألا تقل مدة إعادة المحاولة عن 5 دقائق.",
    errFallback: "يجب أن تكون محاولة إرسال WhatsApp بين 0 والحد الأقصى للمحاولات.",
    errHours: "يجب أن ينتهي وقت العمل بعد بدايته.",
    toastSaved: "تم حفظ إعدادات مركز الاتصال.",
    flowTitle: "كيف تتم عملية التأكيد",
    flowBody:
      "طلب جديد بالدفع عند الاستلام ← رسالة WhatsApp تطلب من العميل الرد بـ 1 ← لا يوجد رد خلال {minutes} دقيقة ← يدخل الطلب قائمة الاتصال ← حتى {max} محاولات اتصال (إعادة المحاولة كل {minutes} دقيقة خلال ساعات العمل) ← بعد آخر محاولة {end}.",
    flowAutoCancelled: "يُلغى الطلب تلقائيًا",
    flowFlagged: "يُعلَّم الطلب للمراجعة",
    secAttempts: "المحاولات وإعادة الاتصال",
    secAttemptsDesc: "عدد المحاولات التي يبذلها الفريق قبل إغلاق الطلب.",
    maxAttempts: "الحد الأقصى للمحاولات",
    maxAttemptsHint: "عدد المكالمات قبل إغلاق الطلب.",
    retryAfter: "إعادة المحاولة بعد (دقائق)",
    retryAfterHint: "مدة الانتظار بين المحاولات عند عدم الرد.",
    autoCancel: "إلغاء تلقائي بعد الحد الأقصى للمحاولات",
    autoCancelDesc: "عند الإيقاف: يُعلَّم الطلب لمراجعة المدير بدلًا من إلغائه.",
    secHours: "ساعات العمل",
    secHoursDesc: "تُجدول المكالمات داخل هذه الفترة فقط (Africa/Cairo).",
    from: "من",
    to: "إلى",
    secWhatsapp: "بديل WhatsApp",
    secWhatsappDesc: "أرسل قالب تأكيد عبر WhatsApp عندما لا تنجح المكالمات.",
    whatsappAfter: "إرسال WhatsApp بعد المحاولة رقم",
    whatsappAfterHint: "0 = الإرسال قبل أول مكالمة. يتطلب رقم WhatsApp متصلًا.",
    secVoip: "مزوّد خدمة VoIP",
    secVoipDesc: "اربط مزوّدًا للاتصال بنقرة واحدة من شاشة العمل وتسجيل المكالمات.",
    provider: "المزوّد",
    credsNote: "نسخة تجريبية: تُحفظ بيانات الاعتماد في جلسة المتصفح هذه فقط ولا تُرسل إلى أي مكان.",
    recordCalls: "تسجيل المكالمات",
    recordCallsDesc: "تظهر التسجيلات في سجل المكالمات. يتطلب مزوّد خدمة VoIP.",
    reset: "إعادة تعيين",
    saveSettings: "حفظ الإعدادات",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];
type Provider = CallCenterSettings["voipProvider"];
type FieldLabelKey = "fieldAccountSid" | "fieldAuthToken" | "fieldCallerId" | "fieldAccessKey" | "fieldAccessSecret" | "fieldInstance" | "fieldApiKey";

const PROVIDERS: Provider[] = ["none", "twilio", "maqsam", "ziwo"];

function providerLabel(p: Provider, t: Strings): string {
  switch (p) {
    case "none":
      return t.providerNone;
    case "twilio":
      return "Twilio";
    case "maqsam":
      return "Maqsam";
    case "ziwo":
      return "Ziwo";
  }
}

const PROVIDER_FIELDS: Record<Exclude<Provider, "none">, Array<{ key: string; labelKey: FieldLabelKey; secret: boolean }>> = {
  twilio: [
    { key: "accountSid", labelKey: "fieldAccountSid", secret: false },
    { key: "authToken", labelKey: "fieldAuthToken", secret: true },
    { key: "callerId", labelKey: "fieldCallerId", secret: false },
  ],
  maqsam: [
    { key: "accessKey", labelKey: "fieldAccessKey", secret: false },
    { key: "accessSecret", labelKey: "fieldAccessSecret", secret: true },
  ],
  ziwo: [
    { key: "instance", labelKey: "fieldInstance", secret: false },
    { key: "apiKey", labelKey: "fieldApiKey", secret: true },
  ],
};

export function CallCenterSettingsPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const settings = useAsync(() => mockApi.getCallCenterSettings(workspaceId), [workspaceId]);
  return (
    <div className="min-w-0 max-w-3xl">
      <PageHeader title={t.title} description={t.description} back={{ to: "/call-center", label: t.backLabel }} />
      <DataState loading={settings.loading} error={settings.error} onRetry={() => settings.refresh()}>
        {settings.data && <SettingsForm key={workspaceId} initial={settings.data} onSaved={(s) => settings.setData(s)} />}
      </DataState>
    </div>
  );
}

function SettingsForm({ initial, onSaved }: { initial: CallCenterSettings; onSaved: (s: CallCenterSettings) => void }) {
  const t = useT(STRINGS);
  const c = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [form, setForm] = useState<CallCenterSettings>(initial);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);

  function patch(p: Partial<CallCenterSettings>) {
    setForm((f) => ({ ...f, ...p }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.maxAttempts < 1 || form.maxAttempts > 10) return setError(t.errMaxAttempts);
    if (form.retryAfterMinutes < 5) return setError(t.errRetry);
    if (form.whatsappFallbackAfterAttempt < 0 || form.whatsappFallbackAfterAttempt > form.maxAttempts) return setError(t.errFallback);
    if (form.workingHours.from >= form.workingHours.to) return setError(t.errHours);
    setError(null);
    setSaving(true);
    try {
      await mockApi.saveCallCenterSettings(workspaceId, form);
      onSaved(form);
      toast.success(t.toastSaved);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const providerFields = form.voipProvider === "none" ? [] : PROVIDER_FIELDS[form.voipProvider];

  return (
    <form onSubmit={submit} className="space-y-6">
      <Alert variant="info" className="border-primary/30 bg-primary-soft/40">
        <Info />
        <div>
          <p className="font-medium text-ink">{t.flowTitle}</p>
          <p className="text-sm text-ink-soft">
            {fmt(t.flowBody, {
              minutes: form.retryAfterMinutes,
              max: form.maxAttempts,
              end: form.autoCancelAfterAttempts ? t.flowAutoCancelled : t.flowFlagged,
            })}
          </p>
        </div>
      </Alert>

      {error && <Alert variant="danger">{error}</Alert>}

      <Section title={t.secAttempts} description={t.secAttemptsDesc}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t.maxAttempts} type="number" min={1} max={10} value={form.maxAttempts} onChange={(e) => patch({ maxAttempts: Number(e.target.value) })} hint={t.maxAttemptsHint} />
          <TextField label={t.retryAfter} type="number" min={5} step={5} value={form.retryAfterMinutes} onChange={(e) => patch({ retryAfterMinutes: Number(e.target.value) })} hint={t.retryAfterHint} />
        </div>
        <Toggle checked={form.autoCancelAfterAttempts} onChange={(v) => patch({ autoCancelAfterAttempts: v })} label={t.autoCancel} description={t.autoCancelDesc} className="mt-4" />
      </Section>

      <Section title={t.secHours} description={t.secHoursDesc}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.from}>{({ id }) => <Input id={id} type="time" dir="ltr" value={form.workingHours.from} onChange={(e) => patch({ workingHours: { ...form.workingHours, from: e.target.value } })} />}</Field>
          <Field label={t.to}>{({ id }) => <Input id={id} type="time" dir="ltr" value={form.workingHours.to} onChange={(e) => patch({ workingHours: { ...form.workingHours, to: e.target.value } })} />}</Field>
        </div>
      </Section>

      <Section title={t.secWhatsapp} description={t.secWhatsappDesc}>
        <TextField
          label={t.whatsappAfter}
          type="number"
          min={0}
          max={form.maxAttempts}
          value={form.whatsappFallbackAfterAttempt}
          onChange={(e) => patch({ whatsappFallbackAfterAttempt: Number(e.target.value) })}
          hint={t.whatsappAfterHint}
          className="sm:max-w-xs"
        />
      </Section>

      <Section title={t.secVoip} description={t.secVoipDesc}>
        <Field label={t.provider} className="sm:max-w-xs">
          {({ id }) => (
            <Select id={id} value={form.voipProvider} onChange={(e) => patch({ voipProvider: e.target.value as Provider })}>
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {providerLabel(p, t)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {providerFields.length > 0 && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {providerFields.map((f) => (
              <TextField
                key={`${form.voipProvider}-${f.key}`}
                label={t[f.labelKey]}
                type={f.secret ? "password" : "text"}
                autoComplete="off"
                dir="ltr"
                value={creds[`${form.voipProvider}.${f.key}`] ?? ""}
                onChange={(e) => setCreds((prev) => ({ ...prev, [`${form.voipProvider}.${f.key}`]: e.target.value }))}
                className="font-mono"
              />
            ))}
            <p className="text-xs text-ink-soft sm:col-span-2">{t.credsNote}</p>
          </div>
        )}
        <Toggle
          checked={form.recordCalls}
          onChange={(v) => patch({ recordCalls: v })}
          label={t.recordCalls}
          description={t.recordCallsDesc}
          disabled={form.voipProvider === "none"}
          className="mt-4"
        />
      </Section>

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" disabled={!dirty || saving} onClick={() => setForm(initial)}>
          {t.reset}
        </Button>
        <Button type="submit" disabled={!dirty || saving}>
          {saving ? c.saving : t.saveSettings}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-paper-raised p-5">
      <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
      {description && <p className="mb-4 mt-0.5 text-xs text-ink-soft">{description}</p>}
      {children}
    </section>
  );
}
