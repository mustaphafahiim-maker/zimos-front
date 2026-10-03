import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  formatMoney,
  segmentsList,
  whatsappCampaignsAct,
  whatsappCampaignsCreate,
  whatsappCampaignsDelete,
  whatsappCampaignsGet,
  whatsappCampaignsList,
  whatsappCampaignsPreviewAudience,
  type WhatsappCampaignAudience,
  type WhatsappCampaignAudiencePreview,
  type WhatsappCampaignDto,
  type WhatsappCampaignStatus,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { KpiCard } from "@/components/KpiCard";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";

/**
 * WhatsApp campaigns (SPEC §14.4): send one approved marketing template to
 * the contacts who agreed to marketing, at a daily pace, and see what came of
 * it. Only consenting contacts are ever messaged — the screen says how many
 * of the chosen audience that is before anything is sent.
 */

const STRINGS = {
  en: {
    title: "WhatsApp campaigns",
    description: "Send an approved marketing template to the contacts who agreed to hear from you.",
    newCampaign: "New campaign",
    notConnected: "WhatsApp isn't connected, so campaigns can't be sent.",
    connect: "Connect WhatsApp",
    emptyTitle: "No campaigns yet",
    emptyBody: "Create one to reach your consenting contacts with an offer or an announcement.",
    colName: "Campaign",
    colStatus: "Status",
    colProgress: "Progress",
    colCreated: "Created",
    progress: "{sent} sent of {total}",
    notStarted: "Not started",
    st_draft: "Draft",
    st_scheduled: "Scheduled",
    st_sending: "Sending",
    st_paused: "Paused",
    st_completed: "Completed",
    st_cancelled: "Cancelled",
    createTitle: "New campaign",
    name: "Campaign name",
    audience: "Audience",
    audAll: "Every contact who agreed to marketing",
    audSegment: "A segment",
    audList: "A list of numbers",
    segment: "Segment",
    noSegments: "No segments yet — create one under Contacts.",
    list: "Names and numbers",
    listHint: "One per line: name, number. Or load a CSV file with those two columns.",
    loadCsv: "Load CSV",
    reach: "{reachable} of {total} agreed to marketing and will be messaged; {excluded} will not.",
    reachNone: "Nobody in this audience has agreed to marketing messages.",
    consentNote: "Only contacts who agreed to marketing are messaged. Anyone who replies STOP is removed automatically.",
    template: "Template name",
    templateHint: "A marketing template approved in your Meta account: lowercase letters, numbers and underscores.",
    language: "Language",
    params: "Template variables",
    paramsHint: "One per line, in order. You can use {{customer_name}}, {{store_name}} and {{coupon_code}}.",
    coupon: "Coupon code",
    couponHint: "Optional. Fills {{coupon_code}}.",
    dailyCap: "Messages per day",
    dailyCapHint: "Sending slowly protects your number's quality rating.",
    schedule: "Send at",
    scheduleHint: "Leave empty to send when you press Start.",
    save: "Save as draft",
    saving: "Saving…",
    cancel: "Cancel",
    created: "Campaign saved as a draft. Open it to start sending.",
    detailTitle: "Campaign",
    start: "Start sending",
    pause: "Pause",
    resume: "Resume",
    cancelCampaign: "Cancel campaign",
    delete: "Delete",
    started: "The campaign is on its way.",
    scheduledToast: "The campaign is scheduled.",
    paused: "Campaign paused.",
    resumed: "Campaign resumed.",
    cancelled: "Campaign cancelled.",
    deleted: "Campaign deleted.",
    startTitle: "Start this campaign?",
    startBody: "The recipients are fixed now, from the contacts who agreed to marketing, and messages start going out.",
    deleteTitle: "Delete this campaign?",
    deleteBody: "“{name}” and its report are removed.",
    working: "Working…",
    pausedBecause: "Paused: {reason}",
    pausedManual: "Paused by a teammate.",
    excluded: "{n} people in the audience were left out: they have not agreed to marketing, are blocked, or are not contacts.",
    kSent: "Sent",
    kDelivered: "Delivered",
    kRead: "Read",
    kReplies: "Replies",
    kUnsub: "Opted out",
    kOrders: "Orders",
    kRevenue: "Revenue",
    kFailed: "Failed",
    kPending: "Waiting",
    ordersHint: "Orders from recipients within {days} days of their message.",
    failures: "Latest failures",
    templateLine: "Template: {name} ({language})",
    scheduledFor: "Scheduled for {date}",
  },
  ar: {
    title: "حملات واتساب",
    description: "أرسل قالبًا تسويقيًا معتمدًا لجهات الاتصال التي وافقت على استقبال رسائلك.",
    newCampaign: "حملة جديدة",
    notConnected: "واتساب غير مربوط، لذلك لا يمكن إرسال الحملات.",
    connect: "ربط واتساب",
    emptyTitle: "لا توجد حملات بعد",
    emptyBody: "أنشئ حملة لتصل إلى جهات الاتصال الموافقة بعرض أو إعلان.",
    colName: "الحملة",
    colStatus: "الحالة",
    colProgress: "التقدم",
    colCreated: "تاريخ الإنشاء",
    progress: "أُرسل {sent} من {total}",
    notStarted: "لم تبدأ",
    st_draft: "مسودة",
    st_scheduled: "مجدولة",
    st_sending: "قيد الإرسال",
    st_paused: "متوقفة",
    st_completed: "مكتملة",
    st_cancelled: "ملغاة",
    createTitle: "حملة جديدة",
    name: "اسم الحملة",
    audience: "الجمهور",
    audAll: "كل من وافق على الرسائل التسويقية",
    audSegment: "شريحة",
    audList: "قائمة أرقام",
    segment: "الشريحة",
    noSegments: "لا توجد شرائح بعد — أنشئ واحدة من جهات الاتصال.",
    list: "الأسماء والأرقام",
    listHint: "سطر لكل شخص: الاسم، الرقم. أو حمّل ملف CSV بهذين العمودين.",
    loadCsv: "تحميل CSV",
    reach: "{reachable} من {total} وافقوا على الرسائل التسويقية وسيصلهم؛ {excluded} لن يصلهم.",
    reachNone: "لا أحد في هذا الجمهور وافق على الرسائل التسويقية.",
    consentNote: "الرسائل تصل فقط لمن وافق على التسويق. ومن يرد بكلمة STOP يُحذف تلقائيًا.",
    template: "اسم القالب",
    templateHint: "قالب تسويقي معتمد في حسابك على Meta: حروف إنجليزية صغيرة وأرقام وشرطة سفلية.",
    language: "اللغة",
    params: "متغيرات القالب",
    paramsHint: "سطر لكل متغير بالترتيب. يمكنك استخدام {{customer_name}} و{{store_name}} و{{coupon_code}}.",
    coupon: "كود الخصم",
    couponHint: "اختياري. يملأ {{coupon_code}}.",
    dailyCap: "عدد الرسائل في اليوم",
    dailyCapHint: "الإرسال ببطء يحمي تقييم جودة رقمك.",
    schedule: "وقت الإرسال",
    scheduleHint: "اتركه فارغًا للإرسال عند الضغط على بدء.",
    save: "حفظ كمسودة",
    saving: "جارٍ الحفظ…",
    cancel: "إلغاء",
    created: "تم حفظ الحملة كمسودة. افتحها لبدء الإرسال.",
    detailTitle: "الحملة",
    start: "بدء الإرسال",
    pause: "إيقاف مؤقت",
    resume: "استكمال",
    cancelCampaign: "إلغاء الحملة",
    delete: "حذف",
    started: "بدأ إرسال الحملة.",
    scheduledToast: "تمت جدولة الحملة.",
    paused: "تم إيقاف الحملة مؤقتًا.",
    resumed: "تم استكمال الحملة.",
    cancelled: "تم إلغاء الحملة.",
    deleted: "تم حذف الحملة.",
    startTitle: "بدء هذه الحملة؟",
    startBody: "تُثبَّت قائمة المستلمين الآن من جهات الاتصال الموافقة على التسويق، ويبدأ الإرسال.",
    deleteTitle: "حذف هذه الحملة؟",
    deleteBody: "ستُحذف «{name}» وتقريرها.",
    working: "جارٍ التنفيذ…",
    pausedBecause: "متوقفة: {reason}",
    pausedManual: "أوقفها أحد أعضاء الفريق.",
    excluded: "تم استبعاد {n} من الجمهور: لم يوافقوا على التسويق، أو محظورون، أو ليسوا جهات اتصال.",
    kSent: "أُرسلت",
    kDelivered: "وصلت",
    kRead: "قُرئت",
    kReplies: "ردود",
    kUnsub: "ألغوا الاشتراك",
    kOrders: "طلبات",
    kRevenue: "الإيراد",
    kFailed: "فشلت",
    kPending: "في الانتظار",
    ordersHint: "طلبات المستلمين خلال {days} أيام من وصول رسالتهم.",
    failures: "آخر الإخفاقات",
    templateLine: "القالب: {name} ({language})",
    scheduledFor: "مجدولة في {date}",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;
type Row = Awaited<ReturnType<typeof whatsappCampaignsList>>[number];

const STATUS_TONE: Record<WhatsappCampaignStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  scheduled: "info",
  sending: "info",
  paused: "warning",
  completed: "success",
  cancelled: "neutral",
};
const statusText = (t: T, s: WhatsappCampaignStatus) => (t as Record<string, string>)[`st_${s}`] ?? s;

/** "name, number" lines (or a two-column CSV) → rows. Lines without a usable number are dropped. */
function parseList(text: string): Array<{ name: string | null; phone: string }> {
  const rows: Array<{ name: string | null; phone: string }> = [];
  for (const line of text.split(/\r?\n/)) {
    const parts = line.split(/[,;\t،]/).map((p) => p.trim().replace(/^"|"$/g, ""));
    const phone = parts.find((p) => p.replace(/\D/g, "").length >= 8 && /^[+\d\s()-]+$/.test(p));
    if (!phone) continue;
    const name = parts.find((p) => p && p !== phone) ?? null;
    rows.push({ name, phone });
  }
  return rows.slice(0, 5000);
}

export function CampaignsPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const integration = useAsync(() => apiClient.getWhatsappIntegration(workspaceId), [workspaceId]);
  const campaigns = useAsync(() => whatsappCampaignsList(apiClient, workspaceId), [workspaceId]);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // A campaign that is sending moves by itself: keep the list fresh while one is.
  const live = (campaigns.data ?? []).some((c) => c.status === "sending");
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => void campaigns.refresh({ silent: true }), 5000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: t.colName,
      cell: (c) => (
        <div>
          <div className="font-medium text-ink" dir="auto">
            {c.name}
          </div>
          <div dir="ltr" className="font-mono text-xs text-ink-soft text-start">
            {c.template.name}
          </div>
        </div>
      ),
    },
    { key: "status", header: t.colStatus, cell: (c) => <StatusBadge value={c.status} tone={STATUS_TONE[c.status]} text={statusText(t, c.status)} /> },
    {
      key: "progress",
      header: t.colProgress,
      cell: (c) => {
        const r = c.report.recipients;
        const total = r.pending + r.sent + r.failed + r.skipped;
        return <span className="text-ink-soft">{total === 0 ? t.notStarted : fmt(t.progress, { sent: r.sent, total })}</span>;
      },
    },
    { key: "created", header: t.colCreated, align: "end", cell: (c) => <span className="text-ink-soft">{formatDateTime(c.createdAt)}</span> },
  ];

  return (
    <div className="min-w-0 max-w-5xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            {t.newCampaign}
          </Button>
        }
      />

      {integration.data && !integration.data.connected && (
        <Alert variant="default" className="mb-6 border-accent/40 bg-accent-soft text-accent-dark dark:text-accent">
          <p>
            {t.notConnected}{" "}
            <Link to="/settings#whatsapp" className="font-medium underline">
              {t.connect}
            </Link>
          </p>
        </Alert>
      )}

      <DataState loading={campaigns.loading && !campaigns.data} error={campaigns.error} onRetry={() => campaigns.refresh()}>
        {(campaigns.data ?? []).length === 0 ? (
          <EmptyState icon={<Megaphone />} title={t.emptyTitle} description={t.emptyBody} action={<Button onClick={() => setCreating(true)}>{t.newCampaign}</Button>} />
        ) : (
          <DataTable columns={columns} rows={campaigns.data ?? []} rowKey={(c) => c.id} onRowClick={(c) => setOpenId(c.id)} minWidth="40rem" />
        )}
      </DataState>

      {creating && (
        <CreateDialog
          t={t}
          onClose={() => setCreating(false)}
          onCreated={(campaign) => {
            setCreating(false);
            void campaigns.refresh({ silent: true });
            setOpenId(campaign.id);
          }}
        />
      )}
      {openId && (
        <CampaignDialog
          key={openId}
          t={t}
          campaignId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => void campaigns.refresh({ silent: true })}
          onDeleted={() => {
            setOpenId(null);
            void campaigns.refresh({ silent: true });
          }}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------- create --

function CreateDialog({ t, onClose, onCreated }: { t: T; onClose: () => void; onCreated: (campaign: WhatsappCampaignDto) => void }) {
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const segments = useAsync(() => segmentsList(apiClient, workspaceId).catch(() => []), [workspaceId]);
  const [name, setName] = useState("");
  const [type, setType] = useState<"all" | "segment" | "list">("all");
  const [segmentId, setSegmentId] = useState("");
  const [listText, setListText] = useState("");
  const [template, setTemplate] = useState("");
  const [language, setLanguage] = useState("ar");
  const [params, setParams] = useState("{{customer_name}}");
  const [coupon, setCoupon] = useState("");
  const [dailyCap, setDailyCap] = useState("250");
  const [scheduledAt, setScheduledAt] = useState("");
  const [reach, setReach] = useState<WhatsappCampaignAudiencePreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rows = type === "list" ? parseList(listText) : [];
  const audience: WhatsappCampaignAudience | null =
    type === "all" ? { type: "all" } : type === "segment" ? (segmentId ? { type: "segment", segmentId } : null) : rows.length ? { type: "list", rows } : null;
  const audienceKey = JSON.stringify(audience);

  // How many of the chosen audience can actually be messaged, a moment after it settles.
  useEffect(() => {
    setReach(null);
    if (!audience) return;
    let stale = false;
    const id = window.setTimeout(async () => {
      try {
        const result = await whatsappCampaignsPreviewAudience(apiClient, workspaceId, audience);
        if (!stale) setReach(result);
      } catch {
        /* the count is a convenience; saving reports real errors */
      }
    }, 400);
    return () => {
      stale = true;
      window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, audienceKey]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setListText(await file.text());
  }

  const cap = Math.round(Number(dailyCap));
  const invalid = name.trim().length < 2 || !audience || !/^[a-z0-9_]{1,512}$/.test(template) || !/^[a-z]{2,3}(_[A-Z]{2})?$/.test(language) || !(cap >= 1);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (invalid || !audience) return;
    setSaving(true);
    setFormError(null);
    try {
      const campaign = await whatsappCampaignsCreate(apiClient, workspaceId, {
        name: name.trim(),
        audience,
        template: { name: template, language, params: params.split(/\r?\n/).map((p) => p.trim()).filter(Boolean) },
        couponCode: coupon.trim() || null,
        dailyCap: cap,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      });
      toast.success(t.created);
      onCreated(campaign);
    } catch (err) {
      const fields = getFieldErrors(err);
      setFormError(Object.values(fields)[0] ?? errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t.createTitle}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t.cancel}
          </Button>
          <Button type="submit" form="campaign-form" disabled={saving || invalid}>
            {saving ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <form id="campaign-form" onSubmit={submit} noValidate className="space-y-4">
        {formError && <Alert variant="danger">{formError}</Alert>}
        <TextField label={t.name} required value={name} maxLength={150} onChange={(e) => setName(e.target.value)} />

        <Field label={t.audience}>
          {({ id }) => (
            <Select id={id} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="all">{t.audAll}</option>
              <option value="segment">{t.audSegment}</option>
              <option value="list">{t.audList}</option>
            </Select>
          )}
        </Field>
        {type === "segment" &&
          ((segments.data ?? []).length === 0 && !segments.loading ? (
            <p className="text-sm text-ink-soft">{t.noSegments}</p>
          ) : (
            <Field label={t.segment}>
              {({ id }) => (
                <Select id={id} value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
                  <option value="">—</option>
                  {(segments.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ))}
        {type === "list" && (
          <Field label={t.list} hint={t.listHint}>
            {({ id }) => (
              <div className="space-y-2">
                <Textarea id={id} dir="auto" rows={5} value={listText} onChange={(e) => setListText(e.target.value)} placeholder={"منى أحمد, 01012345678"} />
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-primary hover:underline">
                  {t.loadCsv}
                  <Input type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={onFile} />
                </label>
              </div>
            )}
          </Field>
        )}
        {reach && (
          <Alert variant={reach.reachable === 0 ? "danger" : "default"}>
            {reach.reachable === 0 ? t.reachNone : fmt(t.reach, { reachable: reach.reachable, total: reach.audienceSize, excluded: reach.excluded })}
          </Alert>
        )}
        <p className="text-xs text-ink-soft">{t.consentNote}</p>

        <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
          <TextField label={t.template} dir="ltr" required hint={t.templateHint} value={template} onChange={(e) => setTemplate(e.target.value.trim())} />
          <TextField label={t.language} dir="ltr" value={language} onChange={(e) => setLanguage(e.target.value.trim())} />
        </div>
        <Field label={t.params} hint={t.paramsHint}>
          {({ id }) => <Textarea id={id} dir="auto" rows={3} value={params} onChange={(e) => setParams(e.target.value)} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label={t.coupon} dir="ltr" hint={t.couponHint} value={coupon} maxLength={100} onChange={(e) => setCoupon(e.target.value)} />
          <TextField label={t.dailyCap} type="number" min={1} dir="ltr" hint={t.dailyCapHint} value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} />
          <TextField label={t.schedule} type="datetime-local" dir="ltr" hint={t.scheduleHint} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        </div>
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------- detail --

function CampaignDialog({
  t,
  campaignId,
  onClose,
  onChanged,
  onDeleted,
}: {
  t: T;
  campaignId: string;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const detail = useAsync(() => whatsappCampaignsGet(apiClient, workspaceId, campaignId), [workspaceId, campaignId]);
  const [busy, setBusy] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const campaign = detail.data?.campaign;
  const sending = campaign?.status === "sending";
  useEffect(() => {
    if (!sending) return;
    const id = window.setInterval(() => void detail.refresh({ silent: true }), 4000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sending]);

  async function act(action: "start" | "pause" | "resume" | "cancel") {
    setBusy(true);
    try {
      const updated = await whatsappCampaignsAct(apiClient, workspaceId, campaignId, action);
      toast.success(action === "start" ? (updated.status === "scheduled" ? t.scheduledToast : t.started) : action === "pause" ? t.paused : action === "resume" ? t.resumed : t.cancelled);
      await detail.refresh({ silent: true });
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    } finally {
      setBusy(false);
    }
  }

  const r = campaign?.report;
  return (
    <Modal
      open
      onClose={onClose}
      title={campaign?.name ?? t.detailTitle}
      className="max-w-3xl"
      footer={
        campaign && (
          <>
            {["draft", "completed", "cancelled"].includes(campaign.status) && (
              <Button variant="ghost" onClick={() => setConfirmDelete(true)} disabled={busy}>
                <Trash2 className="size-4 text-danger" aria-hidden />
                {t.delete}
              </Button>
            )}
            {["scheduled", "sending", "paused"].includes(campaign.status) && (
              <Button variant="ghost" onClick={() => void act("cancel").catch(() => undefined)} disabled={busy}>
                {t.cancelCampaign}
              </Button>
            )}
            {["scheduled", "sending"].includes(campaign.status) && (
              <Button variant="outline" onClick={() => void act("pause").catch(() => undefined)} disabled={busy}>
                {t.pause}
              </Button>
            )}
            {campaign.status === "paused" && (
              <Button onClick={() => void act("resume").catch(() => undefined)} disabled={busy}>
                {t.resume}
              </Button>
            )}
            {campaign.status === "draft" && (
              <Button onClick={() => setConfirmStart(true)} disabled={busy}>
                {t.start}
              </Button>
            )}
          </>
        )
      }
    >
      <DataState loading={detail.loading} error={detail.error} onRetry={() => void detail.refresh()}>
        {campaign && r && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              <StatusBadge value={campaign.status} tone={STATUS_TONE[campaign.status]} text={statusText(t, campaign.status)} />
              <span dir="auto">{fmt(t.templateLine, { name: campaign.template.name, language: campaign.template.language })}</span>
              {campaign.status === "scheduled" && campaign.scheduledAt && <span>{fmt(t.scheduledFor, { date: formatDateTime(campaign.scheduledAt) })}</span>}
            </div>
            {campaign.status === "paused" && (
              <Alert variant={campaign.pauseReason && campaign.pauseReason !== "manual" ? "danger" : "default"}>
                {campaign.pauseReason && campaign.pauseReason !== "manual" ? fmt(t.pausedBecause, { reason: campaign.pauseReason }) : t.pausedManual}
              </Alert>
            )}
            {campaign.excludedNoConsent > 0 && <Alert>{fmt(t.excluded, { n: campaign.excludedNoConsent })}</Alert>}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard label={t.kSent} value={String(r.sent)} />
              <KpiCard label={t.kDelivered} value={String(r.delivered)} />
              <KpiCard label={t.kRead} value={String(r.read)} />
              <KpiCard label={t.kReplies} value={String(r.replies)} />
              <KpiCard label={t.kPending} value={String(r.pending)} />
              <KpiCard label={t.kFailed} value={String(r.failed)} />
              <KpiCard label={t.kUnsub} value={String(r.unsubscribed)} />
              <KpiCard label={t.kOrders} value={String(r.orders)} />
            </div>
            <p className="text-sm text-ink">
              {t.kRevenue}: <span className="font-semibold">{r.currency ? formatMoney(r.revenue, r.currency) : "—"}</span>
              <span className="ms-2 text-xs text-ink-soft">{fmt(t.ordersHint, { days: r.orderWindowDays })}</span>
            </p>

            {(detail.data?.failures ?? []).length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-semibold text-ink">{t.failures}</h3>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                  {(detail.data?.failures ?? []).map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <bdi dir="ltr" className="shrink-0 text-ink">
                        {f.phone}
                      </bdi>
                      <span className="text-danger" dir="auto">
                        {f.error}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DataState>

      <ConfirmDialog
        open={confirmStart}
        title={t.startTitle}
        description={t.startBody}
        confirmLabel={t.start}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        onCancel={() => setConfirmStart(false)}
        onConfirm={async () => {
          await act("start");
          setConfirmStart(false);
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={t.deleteTitle}
        description={fmt(t.deleteBody, { name: campaign?.name ?? "" })}
        confirmLabel={t.delete}
        cancelLabel={t.cancel}
        busyLabel={t.working}
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await whatsappCampaignsDelete(apiClient, workspaceId, campaignId);
          toast.success(t.deleted);
          onDeleted();
        }}
      />
    </Modal>
  );
}
