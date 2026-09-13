import { useMemo, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Input, Label, cn } from "@store-builder/ui";
import { Bot, ExternalLink, MessageCircle, Pencil, Plus, Send, Trash2 } from "lucide-react";
import type { WaBotRule, WaBotSettings } from "@/mock/types2";
import { mockApi } from "@/mock/api";
import { uid } from "@/mock/store";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import { useT, useCommon, useLocale, fmt, type Locale, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Toggle } from "@/components/Toggle";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "WhatsApp bot",
    description: "Auto-confirm COD orders, answer tracking questions and hand off to a human when needed.",
    backInbox: "Inbox",
    toastSaved: "Bot settings saved.",
    toastDisconnected: "WhatsApp number disconnected.",
    toastConnected: "WhatsApp Business connected.",
    connected: "Connected",
    notConnected: "Not connected",
    noNumber: "No number linked · Meta Cloud API",
    disconnect: "Disconnect",
    connectCta: "Connect WhatsApp Business",
    behaviour: "Behaviour",
    autoConfirm: "Auto confirmation",
    autoConfirmDesc: "After every new order, send the “reply 1 to confirm / 2 to cancel” message and act on the reply.",
    trackingReplies: "Tracking replies",
    trackingRepliesDesc: "Answer “where is my order?” with the carrier and tracking number.",
    handoffKeyword: "Handoff keyword",
    handoffKeywordHint: "When the customer writes this word, the bot stops and the chat goes to an agent.",
    outsideHours: "Outside-hours reply",
    outsideHoursHint: "Sent once when a customer writes outside 10:00–22:00.",
    rules: "Rules",
    rulesHint: "Checked top to bottom: exact replies first, then keywords, then the catch-all.",
    addRule: "Add rule",
    colRule: "Rule",
    colMatch: "Match",
    colAction: "Action",
    colResponse: "Response",
    colHits: "Hits",
    colOn: "On",
    editRule: "Edit rule",
    deleteRule: "Delete rule",
    noRules: "No rules yet — the bot will stay silent.",
    saveChanges: "Save changes",
    connectDesc: "ZIMOS uses the official Meta Cloud API — no phone plugged into a laptop, no bans.",
    step1Title: "Create a Meta Business account",
    step1Desc: "Or pick an existing one. Your store's Facebook page must belong to it.",
    step2Title: "Add a WhatsApp number",
    step2Desc: "A number not currently registered on the WhatsApp app. A new SIM works; landlines with SMS work too.",
    step3Title: "Approve the message templates",
    step3Desc: "ZIMOS submits the confirmation, tracking and review templates for you. Approval usually takes under an hour.",
    pricingNote: "Conversation pricing is billed by Meta directly (~0.5 EGP per confirmation conversation in Egypt). ZIMOS adds no markup.",
    continueFacebook: "Continue with Facebook",
    deleteTitle: "Delete “{name}”?",
    deleteTitleFallback: "Delete rule?",
    deleteDesc: "The bot will stop responding to messages this rule matched. Remember to save afterwards.",
    errName: "Give the rule a name.",
    errKeyword: "Enter the keyword to look for.",
    errResponse: "Write the bot's reply.",
    name: "Name",
    whenCustomerSends: "When the customer sends",
    optReply1: "Exactly “1”",
    optReply2: "Exactly “2”",
    optKeyword: "A message containing a keyword",
    optAny: "Anything else",
    keyword: "Keyword",
    then: "Then",
    reply: "Reply",
    saveRule: "Save rule",
    simulator: "Simulator",
    simSubtitle: "Bot · test mode",
    ruleLabel: "rule: {name}",
    handoffRuleName: "Handoff keyword",
    noRuleMatched: "(no rule matched — the bot stays silent and the chat opens for an agent)",
    customerSends: "Customer sends…",
    send: "Send",
    simHint: "Try “1”, “2”, “فين طلبي” or “{kw}”. Uses your unsaved rules.",
  },
  ar: {
    title: "بوت WhatsApp",
    description: "تأكيد تلقائي لطلبات الدفع عند الاستلام، والرد على أسئلة تتبع الشحنة، وتحويل المحادثة لموظف عند الحاجة.",
    backInbox: "صندوق الوارد",
    toastSaved: "تم حفظ إعدادات البوت.",
    toastDisconnected: "تم فصل رقم WhatsApp.",
    toastConnected: "تم ربط WhatsApp Business.",
    connected: "متصل",
    notConnected: "غير متصل",
    noNumber: "لا يوجد رقم مربوط · Meta Cloud API",
    disconnect: "فصل",
    connectCta: "ربط WhatsApp Business",
    behaviour: "السلوك",
    autoConfirm: "التأكيد التلقائي",
    autoConfirmDesc: "بعد كل طلب جديد، تُرسل رسالة «رد بـ 1 للتأكيد / 2 للإلغاء» ويُنفَّذ الإجراء حسب رد العميل.",
    trackingReplies: "ردود التتبع",
    trackingRepliesDesc: "الرد على «فين طلبي؟» باسم شركة الشحن ورقم التتبع.",
    handoffKeyword: "كلمة التحويل لموظف",
    handoffKeywordHint: "عندما يكتب العميل هذه الكلمة، يتوقف البوت وتُحوَّل المحادثة إلى موظف.",
    outsideHours: "الرد خارج ساعات العمل",
    outsideHoursHint: "يُرسل مرة واحدة عندما يراسلك العميل خارج الفترة من 10:00 إلى 22:00.",
    rules: "القواعد",
    rulesHint: "تُفحص من الأعلى إلى الأسفل: الردود المطابقة تمامًا أولًا، ثم الكلمات المفتاحية، ثم القاعدة العامة.",
    addRule: "إضافة قاعدة",
    colRule: "القاعدة",
    colMatch: "شرط المطابقة",
    colAction: "الإجراء",
    colResponse: "الرد",
    colHits: "مرات التنفيذ",
    colOn: "مفعّلة",
    editRule: "تعديل القاعدة",
    deleteRule: "حذف القاعدة",
    noRules: "لا توجد قواعد بعد — لن يرد البوت على أي رسالة.",
    saveChanges: "حفظ التغييرات",
    connectDesc: "يستخدم ZIMOS واجهة Meta Cloud API الرسمية — بدون هاتف متصل بجهاز كمبيوتر، وبدون خطر الحظر.",
    step1Title: "أنشئ حساب Meta Business",
    step1Desc: "أو اختر حسابًا موجودًا. يجب أن تكون صفحة متجرك على Facebook تابعة له.",
    step2Title: "أضف رقم WhatsApp",
    step2Desc: "رقم غير مسجّل حاليًا على تطبيق WhatsApp. يمكن استخدام شريحة جديدة، أو خط أرضي يستقبل رسائل SMS.",
    step3Title: "اعتماد قوالب الرسائل",
    step3Desc: "يرسل ZIMOS قوالب التأكيد والتتبع وطلب التقييم للمراجعة نيابةً عنك. الاعتماد يستغرق عادةً أقل من ساعة.",
    pricingNote: "تحاسبك Meta مباشرةً على المحادثات (حوالي 0.5 جنيه لكل محادثة تأكيد في مصر). لا يضيف ZIMOS أي رسوم إضافية.",
    continueFacebook: "المتابعة عبر Facebook",
    deleteTitle: "حذف «{name}»؟",
    deleteTitleFallback: "حذف القاعدة؟",
    deleteDesc: "سيتوقف البوت عن الرد على الرسائل التي كانت تطابق هذه القاعدة. لا تنسَ الحفظ بعد ذلك.",
    errName: "أدخل اسمًا للقاعدة.",
    errKeyword: "أدخل الكلمة المفتاحية المطلوب البحث عنها.",
    errResponse: "اكتب رد البوت.",
    name: "الاسم",
    whenCustomerSends: "عندما يرسل العميل",
    optReply1: "«1» بالضبط",
    optReply2: "«2» بالضبط",
    optKeyword: "رسالة تحتوي على كلمة مفتاحية",
    optAny: "أي رسالة أخرى",
    keyword: "الكلمة المفتاحية",
    then: "ثم",
    reply: "الرد",
    saveRule: "حفظ القاعدة",
    simulator: "المحاكي",
    simSubtitle: "البوت · وضع التجربة",
    ruleLabel: "القاعدة: {name}",
    handoffRuleName: "كلمة التحويل لموظف",
    noRuleMatched: "(لا توجد قاعدة مطابقة — لن يرد البوت وستُفتح المحادثة لموظف)",
    customerSends: "رسالة العميل…",
    send: "إرسال",
    simHint: "جرّب «1» أو «2» أو «فين طلبي» أو «{kw}». يستخدم القواعد غير المحفوظة.",
  },
} satisfies Messages;

const MATCH_LABEL: Record<Locale, Record<WaBotRule["match"], string>> = {
  en: { reply_1: "Reply 1", reply_2: "Reply 2", keyword: "Keyword", any: "Any message" },
  ar: { reply_1: "الرد 1", reply_2: "الرد 2", keyword: "كلمة مفتاحية", any: "أي رسالة" },
};

const MATCH_TONE: Record<WaBotRule["match"], string> = {
  reply_1: "bg-success-soft text-success",
  reply_2: "bg-danger-soft text-danger",
  keyword: "bg-primary-soft text-primary-dark",
  any: "bg-paper text-ink-soft border border-line",
};

const ACTION_LABEL: Record<Locale, Record<WaBotRule["action"], string>> = {
  en: {
    confirm_order: "Confirm order",
    cancel_order: "Cancel order",
    send_tracking: "Send tracking",
    handoff_agent: "Hand off to agent",
    send_text: "Send text",
  },
  ar: {
    confirm_order: "تأكيد الطلب",
    cancel_order: "إلغاء الطلب",
    send_tracking: "إرسال رقم التتبع",
    handoff_agent: "تحويل لموظف",
    send_text: "إرسال نص",
  },
};

const ACTION_KEYS: WaBotRule["action"][] = ["confirm_order", "cancel_order", "send_tracking", "handoff_agent", "send_text"];

const ACTION_TONE: Record<WaBotRule["action"], string> = {
  confirm_order: "bg-success-soft text-success",
  cancel_order: "bg-danger-soft text-danger",
  send_tracking: "bg-primary-soft text-primary-dark",
  handoff_agent: "bg-accent-soft text-accent-dark",
  send_text: "bg-paper text-ink-soft border border-line",
};

const VARIABLES = ["{{customer.firstName}}", "{{order.number}}", "{{order.total}}", "{{shipment.carrier}}", "{{shipment.tracking}}"];

function sampleValues(): Record<string, string> {
  return {
    "customer.firstName": "أحمد",
    "order.number": "#10482",
    "order.total": formatMoney(129900),
    "shipment.carrier": "Bosta",
    "shipment.tracking": "zg8F2K1",
  };
}

function substitute(body: string): string {
  const sample = sampleValues();
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => sample[key] ?? `{{${key}}}`);
}

/** The same matching order the backend would use: exact replies, then keywords, then the catch-all. */
export function matchRule(rules: WaBotRule[], text: string): WaBotRule | null {
  const t = text.trim();
  const enabled = rules.filter((r) => r.enabled);
  if (t === "1") {
    const r = enabled.find((x) => x.match === "reply_1");
    if (r) return r;
  }
  if (t === "2") {
    const r = enabled.find((x) => x.match === "reply_2");
    if (r) return r;
  }
  const kw = enabled.find((x) => x.match === "keyword" && x.keyword && t.toLowerCase().includes(x.keyword.toLowerCase()));
  if (kw) return kw;
  return enabled.find((x) => x.match === "any") ?? null;
}

export function WaBotPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const settings = useAsync(() => mockApi.getWaBot(workspaceId), [workspaceId]);

  return (
    <div className="max-w-6xl">
      <PageHeader title={t.title} description={t.description} back={{ to: "/inbox", label: t.backInbox }} />
      <DataState loading={settings.loading} error={settings.error} onRetry={() => settings.refresh()}>
        {settings.data && <BotEditor key={workspaceId} initial={settings.data} onSaved={(s) => settings.setData(s)} />}
      </DataState>
    </div>
  );
}

function BotEditor({ initial, onSaved }: { initial: WaBotSettings; onSaved: (s: WaBotSettings) => void }) {
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale, intlLocale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [draft, setDraft] = useState<WaBotSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [editing, setEditing] = useState<{ rule: WaBotRule | null } | null>(null);
  const [deleting, setDeleting] = useState<WaBotRule | null>(null);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initial), [draft, initial]);

  function set<K extends keyof WaBotSettings>(key: K, value: WaBotSettings[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function upsertRule(rule: WaBotRule) {
    setDraft((d) => ({ ...d, rules: d.rules.some((r) => r.id === rule.id) ? d.rules.map((r) => (r.id === rule.id ? rule : r)) : [...d.rules, rule] }));
  }

  async function save() {
    setSaving(true);
    try {
      await mockApi.saveWaBot(workspaceId, draft);
      onSaved(draft);
      toast.success(t.toastSaved);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    const next = { ...draft, connected: false };
    setDraft(next);
    await mockApi.saveWaBot(workspaceId, next);
    onSaved(next);
    toast.success(t.toastDisconnected);
  }

  async function connect() {
    const next = { ...draft, connected: true };
    setDraft(next);
    await mockApi.saveWaBot(workspaceId, next);
    onSaved(next);
    setConnectOpen(false);
    toast.success(t.toastConnected);
  }

  const steps: Array<[string, string]> = [
    [t.step1Title, t.step1Desc],
    [t.step2Title, t.step2Desc],
    [t.step3Title, t.step3Desc],
  ];

  return (
    <div className="space-y-6">
      {/* Connection */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-paper-raised p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <MessageCircle className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-ink" dir="auto">
                {draft.businessName}
              </p>
              {draft.connected ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                  <span className="size-1.5 rounded-full bg-success" /> {t.connected}
                </span>
              ) : (
                <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">{t.notConnected}</span>
              )}
            </div>
            {draft.connected ? (
              <p className="font-mono text-xs text-ink-soft">
                <bdi dir="ltr">{draft.phoneNumber}</bdi>
              </p>
            ) : (
              <p className="text-xs text-ink-soft">{t.noNumber}</p>
            )}
          </div>
        </div>
        {draft.connected ? (
          <Button variant="outline" size="sm" onClick={disconnect}>
            {t.disconnect}
          </Button>
        ) : (
          <Button size="sm" onClick={() => setConnectOpen(true)}>
            {t.connectCta}
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {/* Master toggles */}
          <div className="rounded-2xl border border-line bg-paper-raised">
            <div className="border-b border-line px-4 py-3">
              <p className="text-sm font-medium text-ink">{t.behaviour}</p>
            </div>
            <div className="space-y-4 p-4">
              <Toggle label={t.autoConfirm} description={t.autoConfirmDesc} checked={draft.confirmationEnabled} onChange={(v) => set("confirmationEnabled", v)} />
              <Toggle label={t.trackingReplies} description={t.trackingRepliesDesc} checked={draft.trackingRepliesEnabled} onChange={(v) => set("trackingRepliesEnabled", v)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label={t.handoffKeyword} hint={t.handoffKeywordHint} value={draft.handoffKeyword} onChange={(e) => set("handoffKeyword", e.target.value)} dir="auto" />
              </div>
              <Field label={t.outsideHours} hint={t.outsideHoursHint}>
                {({ id }) => <Textarea id={id} rows={2} dir="auto" value={draft.outsideHoursReply} onChange={(e) => set("outsideHoursReply", e.target.value)} />}
              </Field>
            </div>
          </div>

          {/* Rules */}
          <div className="rounded-2xl border border-line bg-paper-raised">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{t.rules}</p>
                <p className="text-xs text-ink-soft">{t.rulesHint}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditing({ rule: null })}>
                <Plus /> {t.addRule}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-line text-start text-xs uppercase tracking-wide text-ink-soft">
                    <th className="px-4 py-2.5 text-start font-medium">{t.colRule}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t.colMatch}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t.colAction}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t.colResponse}</th>
                    <th className="px-4 py-2.5 text-end font-medium">{t.colHits}</th>
                    <th className="px-4 py-2.5 text-start font-medium">{t.colOn}</th>
                    <th className="px-4 py-2.5 font-medium">
                      <span className="sr-only">{c.actions}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {draft.rules.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0 hover:bg-paper">
                      <td className="px-4 py-2.5 text-start font-medium text-ink" dir="auto">
                        {r.name}
                      </td>
                      <td className="px-4 py-2.5 text-start">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", MATCH_TONE[r.match])}>{MATCH_LABEL[locale][r.match]}</span>
                        {r.match === "keyword" && r.keyword && (
                          <span className="ms-1 font-mono text-xs text-ink" dir="auto">
                            “{r.keyword}”
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-start">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", ACTION_TONE[r.action])}>{ACTION_LABEL[locale][r.action]}</span>
                      </td>
                      <td className="max-w-[260px] truncate px-4 py-2.5 text-start text-ink-soft" dir="auto" title={r.responseText}>
                        {r.responseText}
                      </td>
                      <td className="px-4 py-2.5 text-end tabular-nums text-ink-soft">{r.hits.toLocaleString(intlLocale)}</td>
                      <td className="px-4 py-2.5">
                        <Toggle checked={r.enabled} onChange={(v) => upsertRule({ ...r, enabled: v })} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-end">
                        <Button size="icon-sm" variant="ghost" aria-label={t.editRule} title={t.editRule} onClick={() => setEditing({ rule: r })}>
                          <Pencil />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label={t.deleteRule} title={t.deleteRule} className="text-danger hover:bg-danger-soft" onClick={() => setDeleting(r)}>
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {draft.rules.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-soft">
                        {t.noRules}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving || !dirty}>
              {saving ? c.saving : t.saveChanges}
            </Button>
          </div>
        </div>

        <Simulator rules={draft.rules} handoffKeyword={draft.handoffKeyword} />
      </div>

      {/* Connect modal */}
      <Modal open={connectOpen} onClose={() => setConnectOpen(false)} title={t.connectCta} description={t.connectDesc}>
        <ol className="space-y-3">
          {steps.map(([title, desc], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-medium tabular-nums text-primary-dark">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{title}</p>
                <p className="text-xs text-ink-soft">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
        <Alert variant="info" className="mt-4 text-xs">
          {t.pricingNote}
        </Alert>
        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={() => setConnectOpen(false)}>
            {c.cancel}
          </Button>
          <Button onClick={connect}>
            <ExternalLink className="rtl:-scale-x-100" /> {t.continueFacebook}
          </Button>
        </div>
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.rule ? t.editRule : t.addRule} className="max-w-2xl">
        {editing && (
          <RuleForm
            key={editing.rule?.id ?? "new"}
            existing={editing.rule}
            onCancel={() => setEditing(null)}
            onSave={(rule) => {
              upsertRule(rule);
              setEditing(null);
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? fmt(t.deleteTitle, { name: deleting.name }) : t.deleteTitleFallback}
        description={t.deleteDesc}
        confirmLabel={t.deleteRule}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) setDraft((d) => ({ ...d, rules: d.rules.filter((r) => r.id !== deleting.id) }));
          setDeleting(null);
        }}
      />
    </div>
  );
}

// --------------------------------------------------------------- Rule form --

function RuleForm({ existing, onSave, onCancel }: { existing: WaBotRule | null; onSave: (r: WaBotRule) => void; onCancel: () => void }) {
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const [name, setName] = useState(existing?.name ?? "");
  const [match, setMatch] = useState<WaBotRule["match"]>(existing?.match ?? "keyword");
  const [keyword, setKeyword] = useState(existing?.keyword ?? "");
  const [action, setAction] = useState<WaBotRule["action"]>(existing?.action ?? "send_text");
  const [responseText, setResponseText] = useState(existing?.responseText ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  function insertVariable(v: string) {
    const el = bodyRef.current;
    const start = el?.selectionStart ?? responseText.length;
    const end = el?.selectionEnd ?? responseText.length;
    const next = responseText.slice(0, start) + v + responseText.slice(end);
    setResponseText(next);
    if (el) {
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + v.length, start + v.length);
      });
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = t.errName;
    if (match === "keyword" && !keyword.trim()) errs.keyword = t.errKeyword;
    if (!responseText.trim()) errs.response = t.errResponse;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave({
      id: existing?.id ?? uid(),
      name: name.trim(),
      match,
      keyword: match === "keyword" ? keyword.trim() : null,
      action,
      responseText,
      enabled: existing?.enabled ?? true,
      hits: existing?.hits ?? 0,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField label={t.name} required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="فين طلبي" dir="auto" autoFocus />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.whenCustomerSends} required>
          {({ id }) => (
            <Select id={id} value={match} onChange={(e) => setMatch(e.target.value as WaBotRule["match"])}>
              <option value="reply_1">{t.optReply1}</option>
              <option value="reply_2">{t.optReply2}</option>
              <option value="keyword">{t.optKeyword}</option>
              <option value="any">{t.optAny}</option>
            </Select>
          )}
        </Field>
        {match === "keyword" && <TextField label={t.keyword} required value={keyword} onChange={(e) => setKeyword(e.target.value)} error={errors.keyword} placeholder="فين" dir="auto" />}
      </div>
      <Field label={t.then}>
        {({ id }) => (
          <Select id={id} value={action} onChange={(e) => setAction(e.target.value as WaBotRule["action"])}>
            {ACTION_KEYS.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABEL[locale][a]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="space-y-1.5">
        <Label>
          {t.reply} <span className="text-danger">*</span>
        </Label>
        <div className="flex flex-wrap gap-1" dir="ltr">
          {VARIABLES.map((v) => (
            <button key={v} type="button" onClick={() => insertVariable(v)} className="rounded-full border border-line bg-paper-raised px-2 py-0.5 font-mono text-[11px] text-ink-soft transition-colors hover:border-primary/40 hover:text-primary">
              {v}
            </button>
          ))}
        </div>
        <Textarea ref={bodyRef} rows={3} dir="auto" value={responseText} onChange={(e) => setResponseText(e.target.value)} className={cn(errors.response && "border-danger")} placeholder="طلبك مع {{shipment.carrier}} 🚚" />
        {errors.response && <p className="text-xs font-medium text-danger">{errors.response}</p>}
      </div>
      <div className="flex flex-wrap justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>
          {c.cancel}
        </Button>
        <Button type="submit">{existing ? t.saveRule : t.addRule}</Button>
      </div>
    </form>
  );
}

// --------------------------------------------------------------- Simulator --

interface SimMessage {
  id: string;
  direction: "in" | "out";
  body: string;
  ruleName: string | null;
}

function Simulator({ rules, handoffKeyword }: { rules: WaBotRule[]; handoffKeyword: string }) {
  const t = useT(STRINGS);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<SimMessage[]>(() => [{ id: "welcome", direction: "out", body: substitute("أهلاً {{customer.firstName}} 👋 وصلنا طلبك رقم {{order.number}}. رد بـ 1 لتأكيد الطلب أو 2 للإلغاء."), ruleName: null }]);

  function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const next: SimMessage[] = [{ id: uid(), direction: "in", body: text, ruleName: null }];
    const handoff = handoffKeyword.trim() && text.toLowerCase().includes(handoffKeyword.trim().toLowerCase());
    const rule = matchRule(rules, text);
    if (rule) next.push({ id: uid(), direction: "out", body: substitute(rule.responseText), ruleName: rule.name });
    else if (handoff) next.push({ id: uid(), direction: "out", body: "ثواني وهيرد عليك حد من الفريق 🙏", ruleName: t.handoffRuleName });
    else next.push({ id: uid(), direction: "out", body: t.noRuleMatched, ruleName: null });
    setMessages((m) => [...m, ...next]);
    setInput("");
  }

  return (
    <div className="min-w-0 space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{t.simulator}</p>
      <div className="mx-auto w-full max-w-[300px] rounded-[2rem] border-[6px] border-ink/80 bg-ink/80 p-1 shadow-xl">
        <div className="flex h-[460px] flex-col overflow-hidden rounded-[1.6rem] bg-zimos-ice">
          <div className="flex items-center gap-2 bg-primary px-3 py-2 text-white">
            <div className="flex size-7 items-center justify-center rounded-full bg-white/30">
              <Bot className="size-4" />
            </div>
            <div className="leading-tight">
              <p className="text-xs font-semibold">EgyStore</p>
              <p className="text-[10px] opacity-80">{t.simSubtitle}</p>
            </div>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.direction === "out" ? "justify-start" : "justify-end")}>
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl px-2.5 py-1.5 text-[12px] leading-snug shadow-sm",
                    m.direction === "out" ? "rounded-ss-sm bg-paper-raised text-ink" : "rounded-ee-sm bg-primary text-white",
                  )}
                >
                  {m.ruleName && (
                    <p className="mb-0.5 text-[9px] font-medium uppercase tracking-wide text-ink-muted" dir="auto">
                      {fmt(t.ruleLabel, { name: m.ruleName })}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words" dir="auto">
                    {m.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={send} className="flex items-center gap-2 border-t border-line bg-paper-raised/80 px-2 py-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t.customerSends} dir="auto" className="h-8 min-w-0 flex-1 rounded-full bg-paper text-xs" />
            <button type="submit" aria-label={t.send} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90">
              <Send className="size-4 rtl:-scale-x-100" />
            </button>
          </form>
        </div>
      </div>
      <p className="text-xs text-ink-soft">{fmt(t.simHint, { kw: handoffKeyword || "موظف" })}</p>
    </div>
  );
}
