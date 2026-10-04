import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import { waBotGet, waBotPreview, waBotSave, type WaBotDialect, type WaBotSettings } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { AppOffNotice } from "@/components/AppOffNotice";
import { DataState } from "@/components/DataState";
import { Field, TextField } from "@/components/Field";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "WhatsApp bot",
    description:
      "Answers your customers on WhatsApp from your products, prices, stock, policies and their own orders. It can take a cash-on-delivery order in the chat, confirming every detail first (tagged whatsapp-bot). It never gives discounts, and it hands the chat to your team when it can't help, when a customer asks for a person, or is upset.",
    back: "Inbox",
    enabled: "Let the bot answer customers",
    hours: "When it answers",
    always: "All the time",
    scheduled: "Only during working hours",
    from: "From",
    to: "To",
    days: "Days",
    day0: "Sun",
    day1: "Mon",
    day2: "Tue",
    day3: "Wed",
    day4: "Thu",
    day5: "Fri",
    day6: "Sat",
    timezone: "On your store's clock ({tz}).",
    dialect: "Tone and language",
    egyptian: "Egyptian Arabic",
    gulf: "Gulf Arabic",
    msa: "Modern Standard Arabic",
    english: "English",
    french: "French",
    extra: "What else it should know",
    extraHint: "Delivery times, working hours, sizes, anything customers often ask. It answers from this and your store's policies only.",
    save: "Save",
    saving: "Saving…",
    saved: "Bot settings saved.",
    usage: "Replies this month",
    usageOf: "{used} of {limit}",
    unlimited: "{used} (no limit on your plan)",
    tryTitle: "Try it",
    tryHint: "Write what a customer might send. Nothing is sent to anyone.",
    tryPlaceholder: "e.g. How much is the t-shirt?",
    ask: "Ask the bot",
    asking: "Thinking…",
    handoff: "It would hand this chat to your team:",
    readOnly: "Only the store owner or a manager can change the bot's settings.",
  },
  ar: {
    title: "بوت واتساب",
    description:
      "بيرد على عملائك على واتساب من منتجاتك وأسعارك والمخزون وسياساتك وطلباتهم. وبياخد طلب دفع عند الاستلام في الشات بعد ما يأكد كل التفاصيل (عليه وسم whatsapp-bot). مش بيدّي خصومات، وبيحوّل المحادثة لفريقك لما مايعرفش يساعد أو العميل يطلب حد أو يكون متضايق.",
    back: "صندوق الرسائل",
    enabled: "خلّي البوت يرد على العملاء",
    hours: "بيرد إمتى",
    always: "طول الوقت",
    scheduled: "في مواعيد العمل بس",
    from: "من",
    to: "إلى",
    days: "الأيام",
    day0: "الأحد",
    day1: "الإثنين",
    day2: "الثلاثاء",
    day3: "الأربعاء",
    day4: "الخميس",
    day5: "الجمعة",
    day6: "السبت",
    timezone: "بتوقيت متجرك ({tz}).",
    dialect: "الأسلوب واللغة",
    egyptian: "عامية مصرية",
    gulf: "لهجة خليجية",
    msa: "فصحى",
    english: "إنجليزي",
    french: "فرنساوي",
    extra: "معلومات إضافية يعرفها",
    extraHint: "مدة التوصيل، مواعيد العمل، المقاسات، أي حاجة العملاء بيسألوا عنها كتير. بيرد من دي ومن سياسات متجرك بس.",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ إعدادات البوت.",
    usage: "ردود الشهر ده",
    usageOf: "{used} من {limit}",
    unlimited: "{used} (من غير حد في باقتك)",
    tryTitle: "جرّبه",
    tryHint: "اكتب رسالة ممكن عميل يبعتها. مفيش حاجة هتتبعت لحد.",
    tryPlaceholder: "مثلًا: التيشيرت بكام؟",
    ask: "اسأل البوت",
    asking: "بيفكر…",
    handoff: "هيحوّل المحادثة دي لفريقك:",
    readOnly: "مالك المتجر أو المدير بس يقدر يغيّر إعدادات البوت.",
  },
} satisfies Messages;

const DIALECTS: WaBotDialect[] = ["egyptian", "gulf", "msa", "english", "french"];
const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const MANAGERS = new Set(["owner", "workspace_manager"]);

/** Inbox → Bot: the customer service bot's settings (SPEC §19.3) and a "Try it" box. */
export function WaBotPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const canManage = MANAGERS.has(currentWorkspace?.role ?? "");
  const state = useAsync(() => waBotGet(apiClient, workspaceId), [workspaceId]);
  const [draft, setDraft] = useState<WaBotSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<{ action: "reply" | "handoff"; text: string } | null>(null);

  useEffect(() => {
    if (state.data) setDraft(state.data.bot);
  }, [state.data]);

  const set = (patch: Partial<WaBotSettings>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      state.setData(await waBotSave(apiClient, workspaceId, draft));
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function ask(e: FormEvent) {
    e.preventDefault();
    setAsking(true);
    setAnswer(null);
    try {
      setAnswer(await waBotPreview(apiClient, workspaceId, question.trim()));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setAsking(false);
    }
  }

  const usage = state.data?.usage;
  return (
    <div className="max-w-3xl">
      <PageHeader title={t.title} description={t.description} back={{ to: "/inbox", label: t.back }} />
      <AppOffNotice app="whatsapp" />
      <DataState loading={state.loading && !draft} error={state.error} onRetry={() => void state.refresh()}>
        {draft && (
          <div className="space-y-5">
            {!canManage && <Alert>{t.readOnly}</Alert>}
            <form onSubmit={save}>
              <Section title={t.title}>
                <fieldset disabled={!canManage} className="space-y-4">
                  <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink">
                    <input type="checkbox" checked={draft.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
                    {t.enabled}
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t.hours}>
                      {({ id }) => (
                        <Select id={id} value={draft.alwaysOn ? "always" : "scheduled"} onChange={(e) => set({ alwaysOn: e.target.value === "always" })}>
                          <option value="always">{t.always}</option>
                          <option value="scheduled">{t.scheduled}</option>
                        </Select>
                      )}
                    </Field>
                    <Field label={t.dialect}>
                      {({ id }) => (
                        <Select id={id} value={draft.dialect} onChange={(e) => set({ dialect: e.target.value as WaBotDialect })}>
                          {DIALECTS.map((d) => (
                            <option key={d} value={d}>
                              {t[d]}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  </div>
                  {!draft.alwaysOn && (
                    <div className="space-y-3 rounded-lg border border-line p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <TextField label={t.from} type="time" dir="ltr" value={draft.from} onChange={(e) => set({ from: e.target.value })} />
                        <TextField label={t.to} type="time" dir="ltr" value={draft.to} onChange={(e) => set({ to: e.target.value })} />
                      </div>
                      <fieldset>
                        <legend className="mb-1.5 text-sm font-medium text-ink">{t.days}</legend>
                        <div className="flex flex-wrap gap-3">
                          {DAYS.map((d) => (
                            <label key={d} className="flex min-h-11 items-center gap-1.5 text-sm text-ink">
                              <input
                                type="checkbox"
                                checked={draft.days.includes(d)}
                                onChange={(e) => set({ days: e.target.checked ? [...draft.days, d].sort() : draft.days.filter((x) => x !== d) })}
                              />
                              {t[`day${d}`]}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <p className="text-xs text-ink-soft">{fmt(t.timezone, { tz: state.data?.timezone ?? "UTC" })}</p>
                    </div>
                  )}
                  <Field label={t.extra} hint={t.extraHint}>
                    {({ id }) => <Textarea id={id} rows={5} maxLength={2000} value={draft.extraInfo} onChange={(e) => set({ extraInfo: e.target.value })} />}
                  </Field>
                  {error && <Alert variant="danger">{error}</Alert>}
                  {canManage && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-ink-soft">
                        {t.usage}:{" "}
                        <span className="font-medium text-ink">
                          {usage?.limit != null
                            ? fmt(t.usageOf, { used: usage.repliesThisMonth, limit: usage.limit })
                            : fmt(t.unlimited, { used: usage?.repliesThisMonth ?? 0 })}
                        </span>
                      </p>
                      <Button type="submit" className="min-h-11" disabled={busy}>
                        {busy ? t.saving : t.save}
                      </Button>
                    </div>
                  )}
                </fieldset>
              </Section>
            </form>

            <Section title={t.tryTitle} description={t.tryHint}>
              <form onSubmit={ask} className="flex flex-wrap items-end gap-2">
                <TextField
                  label={t.tryTitle}
                  className="min-w-64 flex-1"
                  placeholder={t.tryPlaceholder}
                  maxLength={1000}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                <Button type="submit" className="min-h-11" disabled={asking || !question.trim()}>
                  {asking ? t.asking : t.ask}
                </Button>
              </form>
              {answer && (
                <div className="mt-3 rounded-xl bg-primary-soft px-3 py-2 text-sm text-ink">
                  {answer.action === "handoff" && <p className="mb-1 text-xs font-medium text-ink-soft">{t.handoff}</p>}
                  <p className="whitespace-pre-wrap" dir="auto">
                    {answer.text}
                  </p>
                </div>
              )}
            </Section>
          </div>
        )}
      </DataState>
    </div>
  );
}
