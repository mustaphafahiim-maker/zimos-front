import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Copy, Eye, Layers, Link2, MoreHorizontal, MousePointerClick, Pause, Pencil, Play, Plus, Share2, ShoppingBag, Trash2, Wallet } from "lucide-react";
import { FunnelShareDialog, FunnelWizard } from "./FunnelWizard";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Input, Label, Spinner, cn } from "@store-builder/ui";
import {
  funnelsDelete,
  funnelsList,
  funnelsListSteps,
  funnelsPause,
  funnelsProblemsOf,
  funnelsPublish,
  funnelsResume,
  type FunnelDto,
  type FunnelStatus,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDate, formatMoney, formatPercentValue } from "@/lib/format";
import { percentToRatio, rangeWindows, type AnalyticsRange } from "@/lib/analytics";
import { canViewAnalytics } from "@/lib/analyticsAccess";
import { useWorkspace } from "@/context/WorkspaceContext";
import { RangeSwitch } from "@/components/RangeSwitch";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { KpiCard } from "@/components/KpiCard";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useLocale, useT, type Locale, type Messages } from "@/i18n/LocaleContext";
import {
  STARTER_TEMPLATE_IDS,
  createFunnelFromStarter,
  duplicateFunnel,
  funnelPublicUrl,
  starterPlan,
  useFunnelErrorMessage,
  type StarterTemplateId,
  type UiStepType,
} from "./funnelAdapter";
import { STARTER_TEMPLATE_TEXT } from "./FunnelEditorPage.strings";
import { StepChain } from "./StepChain";

const STRINGS = {
  en: {
    title: "Funnels",
    description: "Single-product sales flows with order bumps, upsells and downsells.",
    createFunnel: "Create funnel",
    kpiVisits: "Sessions",
    kpiVisitsHint: "All funnels, in the period",
    kpiOrders: "Orders",
    kpiOrdersHint: "Placed inside funnels",
    kpiRevenue: "Revenue",
    kpiRevenueHint: "Including upsells",
    kpiConversion: "Conversion",
    kpiConversionHint: "Checkouts ÷ sessions",
    statsUnavailable: "Stats couldn't be loaded",
    statsNoAccess: "Your role can't see analytics",
    viewAnalytics: "Analytics",
    emptyTitle: "No funnels yet",
    emptyDescription: "Create a funnel to sell a single product with a focused landing page and one-click offers.",
    colFunnel: "Funnel",
    colSteps: "Steps",
    colVisits: "Visits",
    colOrders: "Orders",
    colConversion: "Conv.",
    colRevenue: "Revenue",
    colUpdated: "Updated",
    pause: "Pause",
    resume: "Resume",
    publish: "Publish",
    duplicate: "Duplicate",
    share: "Share",
    moreActions: "More actions",
    duplicating: "Duplicating…",
    copyShareLink: "Copy share link",
    toastLive: "\"{name}\" is live.",
    toastPaused: "\"{name}\" paused.",
    toastResumed: "\"{name}\" resumed.",
    toastPublishBlocked: "\"{name}\" can't be published yet ({n} problems). Open the editor to fix them.",
    toastDuplicatedAs: "Duplicated as \"{name}\".",
    toastDuplicatePartial: "The copy was created but not every step or edge could be copied: {message}",
    toastCopied: "Copied {url}",
    toastCopyFailed: "Couldn't copy to clipboard.",
    toastDeleted: "\"{name}\" deleted.",
    copySuffix: "{name} (copy)",
    modalDescription: "Pick a name and a starting point. You can change everything in the editor.",
    deleteTitleNamed: "Delete \"{name}\"?",
    deleteTitle: "Delete funnel?",
    deleteDescription: "The funnel, its steps and its share link stop working immediately. Orders already placed are kept.",
    deleteConfirm: "Delete funnel",
    statusDraft: "Draft",
    statusPublished: "Published",
    statusPaused: "Paused",
  },
  ar: {
    title: "مسارات البيع",
    description: "مسارات بيع لمنتج واحد مع عروض إضافية عند الدفع وعروض بعد الشراء وعروض بديلة.",
    createFunnel: "إنشاء مسار بيع",
    kpiVisits: "الجلسات",
    kpiVisitsHint: "كل المسارات، خلال الفترة",
    kpiOrders: "الطلبات",
    kpiOrdersHint: "الطلبات المُنشأة داخل المسارات",
    kpiRevenue: "الإيرادات",
    kpiRevenueHint: "شاملة العروض الإضافية",
    kpiConversion: "معدل التحويل",
    kpiConversionHint: "عمليات الدفع ÷ الجلسات",
    statsUnavailable: "تعذّر تحميل الإحصاءات",
    statsNoAccess: "دورك لا يتيح عرض التحليلات",
    viewAnalytics: "التحليلات",
    emptyTitle: "لا توجد مسارات بيع بعد",
    emptyDescription: "أنشئ مسار بيع لبيع منتج واحد بصفحة هبوط مركّزة وعروض بنقرة واحدة.",
    colFunnel: "مسار البيع",
    colSteps: "الخطوات",
    colVisits: "الزيارات",
    colOrders: "الطلبات",
    colConversion: "التحويل",
    colRevenue: "الإيرادات",
    colUpdated: "آخر تحديث",
    pause: "إيقاف مؤقت",
    resume: "استئناف",
    publish: "نشر",
    duplicate: "نسخ المسار",
    share: "مشاركة",
    moreActions: "إجراءات أخرى",
    duplicating: "جارٍ النسخ…",
    copyShareLink: "نسخ رابط المشاركة",
    toastLive: "«{name}» منشور الآن.",
    toastPaused: "تم إيقاف «{name}» مؤقتًا.",
    toastResumed: "تم استئناف «{name}».",
    toastPublishBlocked: "لا يمكن نشر «{name}» بعد ({n} مشكلات). افتح المحرر لإصلاحها.",
    toastDuplicatedAs: "تم النسخ باسم «{name}».",
    toastDuplicatePartial: "تم إنشاء النسخة لكن تعذّر نسخ بعض الخطوات أو الروابط: {message}",
    toastCopied: "تم نسخ {url}",
    toastCopyFailed: "تعذّر النسخ إلى الحافظة.",
    toastDeleted: "تم حذف «{name}».",
    copySuffix: "{name} (نسخة)",
    modalDescription: "اختر اسمًا ونقطة بداية. يمكنك تغيير كل شيء من المحرر.",
    deleteTitleNamed: "حذف «{name}»؟",
    deleteTitle: "حذف مسار البيع؟",
    deleteDescription: "سيتوقف مسار البيع وخطواته ورابط المشاركة عن العمل فورًا. الطلبات السابقة تبقى محفوظة.",
    deleteConfirm: "حذف مسار البيع",
    statusDraft: "مسودة",
    statusPublished: "منشور",
    statusPaused: "متوقف مؤقتًا",
  },
} satisfies Messages;

const FORM_STRINGS = {
  en: {
    name: "Name",
    nameRequired: "Give the funnel a name.",
    namePlaceholder: "Headphones Pro offer — Ramadan",
    startFrom: "Start from",
    toastCreated: "\"{name}\" created.",
    toastCreatedPartial: "The funnel was created but its starter steps couldn't all be added: {message}",
    creating: "Creating…",
    createAndOpen: "Create and open editor",
  },
  ar: {
    name: "الاسم",
    nameRequired: "اكتب اسمًا لمسار البيع.",
    namePlaceholder: "عرض السماعة Pro — رمضان",
    startFrom: "ابدأ من",
    toastCreated: "تم إنشاء «{name}».",
    toastCreatedPartial: "تم إنشاء مسار البيع لكن تعذّرت إضافة كل الخطوات المبدئية: {message}",
    creating: "جارٍ الإنشاء…",
    createAndOpen: "إنشاء وفتح المحرر",
  },
} satisfies Messages;

const STATUS_TONE: Record<FunnelStatus, "neutral" | "success" | "warning"> = {
  draft: "neutral",
  published: "success",
  paused: "warning",
};

interface StartTemplate {
  id: StarterTemplateId;
  name: string;
  description: string;
  types: UiStepType[];
}

/** Names/descriptions live in FunnelEditorPage.strings (the editor offers the same starters on an empty funnel). */
function startTemplates(locale: Locale): StartTemplate[] {
  return STARTER_TEMPLATE_IDS.map((id) => ({
    id,
    ...STARTER_TEMPLATE_TEXT[locale][id],
    types: starterPlan(id, locale).steps.map((s) => s.type),
  }));
}

function partialIdOf(err: unknown): string | null {
  const id = (err as { partialFunnelId?: unknown } | null)?.partialFunnelId;
  return typeof id === "string" ? id : null;
}

export function FunnelsPage() {
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const toast = useToast();
  const t = useT(STRINGS);
  const c = useCommon();
  const { intlLocale } = useLocale();
  const describeError = useFunnelErrorMessage();
  const list = useAsync(() => funnelsList(apiClient, workspaceId), [workspaceId]);

  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<FunnelDto | null>(null);
  const [sharing, setSharing] = useState<FunnelDto | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const funnels = list.data ?? [];
  const reload = () => list.refresh({ silent: true });

  // The list endpoint has no step count; fetch each funnel's steps (read-only, parallel).
  const idsKey = funnels.map((f) => f.id).join(",");
  const stepCounts = useAsync(async () => {
    const entries = await Promise.all(
      funnels.map(async (f) => [f.id, (await funnelsListSteps(apiClient, workspaceId, f.id)).length] as const)
    );
    return new Map(entries);
  }, [workspaceId, idsKey]);

  // Funnel stats need analytics.view; a role without it gets dashes, not a 403.
  const { currentWorkspace } = useWorkspace();
  const analyticsAllowed = canViewAnalytics(currentWorkspace?.role);
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const stats = useAsync(
    () =>
      analyticsAllowed ? apiClient.getFunnelAnalytics(workspaceId, rangeWindows(range).current) : Promise.resolve(null),
    [workspaceId, range, analyticsAllowed]
  );
  const statsById = new Map((stats.data?.funnels ?? []).map((row) => [row.id, row]));
  const currency = stats.data?.currency ?? "EGP";

  const numberFmt = new Intl.NumberFormat(intlLocale);

  const statusLabel: Record<FunnelStatus, string> = {
    draft: t.statusDraft,
    published: t.statusPublished,
    paused: t.statusPaused,
  };

  /** Shown while the stats load, when they failed or aren't allowed: never a made-up number. */
  const noStatReason = !analyticsAllowed ? t.statsNoAccess : stats.error ? t.statsUnavailable : undefined;
  const noStat = (
    <span title={noStatReason} aria-label={noStatReason}>
      —
    </span>
  );
  const stat = (value: number | null | undefined, render: (v: number) => string) =>
    value === null || value === undefined ? noStat : <bdi dir="ltr">{render(value)}</bdi>;
  const totals = stats.data?.totals;

  async function changeStatus(f: FunnelDto) {
    setBusyId(f.id);
    try {
      if (f.status === "published") {
        await funnelsPause(apiClient, workspaceId, f.id);
        toast.success(fmt(t.toastPaused, { name: f.name }));
      } else if (f.status === "paused") {
        await funnelsResume(apiClient, workspaceId, f.id);
        toast.success(fmt(t.toastResumed, { name: f.name }));
      } else {
        await funnelsPublish(apiClient, workspaceId, f.id);
        toast.success(fmt(t.toastLive, { name: f.name }));
      }
      await reload();
    } catch (err) {
      const problems = funnelsProblemsOf(err);
      toast.error(problems.length > 0 ? fmt(t.toastPublishBlocked, { name: f.name, n: problems.length }) : describeError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(f: FunnelDto) {
    setBusyId(f.id);
    try {
      const copy = await duplicateFunnel(workspaceId, f.id, (name) => fmt(t.copySuffix, { name }));
      toast.success(fmt(t.toastDuplicatedAs, { name: copy.name }));
      navigate(`/funnels/${copy.id}`);
    } catch (err) {
      const partial = partialIdOf(err);
      if (partial) {
        toast.error(fmt(t.toastDuplicatePartial, { message: describeError(err) }));
        navigate(`/funnels/${partial}`);
      } else {
        toast.error(describeError(err));
        await reload();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(fmt(t.toastCopied, { url }));
    } catch {
      toast.error(t.toastCopyFailed);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await funnelsDelete(apiClient, workspaceId, deleting.id);
    } catch (err) {
      throw new Error(describeError(err));
    }
    toast.success(fmt(t.toastDeleted, { name: deleting.name }));
    setDeleting(null);
    await reload();
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <>
            {analyticsAllowed && <RangeSwitch value={range} onChange={setRange} />}
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden /> {t.createFunnel}
            </Button>
          </>
        }
      />

      <DataState loading={list.loading} error={list.error} onRetry={() => list.refresh()}>
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label={t.kpiVisits}
            value={stat(totals?.sessions, numberFmt.format)}
            icon={<Eye />}
            hint={noStatReason ?? t.kpiVisitsHint}
          />
          <KpiCard
            label={t.kpiOrders}
            value={stat(totals?.orders, numberFmt.format)}
            icon={<ShoppingBag />}
            hint={noStatReason ?? t.kpiOrdersHint}
          />
          <KpiCard
            label={t.kpiRevenue}
            value={stat(totals?.revenue, (v) => formatMoney(v, currency))}
            icon={<Wallet />}
            hint={noStatReason ?? t.kpiRevenueHint}
          />
          <KpiCard
            label={t.kpiConversion}
            value={stat(totals?.conversionRate, (v) => formatPercentValue(percentToRatio(v)))}
            icon={<MousePointerClick />}
            hint={noStatReason ?? t.kpiConversionHint}
          />
        </div>

        {funnels.length === 0 ? (
          <EmptyState
            icon={<Layers />}
            title={t.emptyTitle}
            description={t.emptyDescription}
            action={<Button onClick={() => setCreating(true)}>{t.createFunnel}</Button>}
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-line bg-paper text-start text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 text-start font-medium">{t.colFunnel}</th>
                  <th className="px-4 py-3 text-start font-medium">{c.status}</th>
                  <th className="px-4 py-3 text-start font-medium">{t.colSteps}</th>
                  <th className="px-4 py-3 text-end font-medium">{t.colVisits}</th>
                  <th className="px-4 py-3 text-end font-medium">{t.colOrders}</th>
                  <th className="px-4 py-3 text-end font-medium">{t.colConversion}</th>
                  <th className="px-4 py-3 text-end font-medium">{t.colRevenue}</th>
                  <th className="px-4 py-3 text-start font-medium">{t.colUpdated}</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">{c.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {funnels.map((f) => {
                  const busy = busyId === f.id;
                  const url = funnelPublicUrl(f.subdomain);
                  const count = stepCounts.data?.get(f.id);
                  const row = statsById.get(f.id);
                  return (
                    <tr
                      key={f.id}
                      onClick={() => navigate(`/funnels/${f.id}`)}
                      className="cursor-pointer border-b border-line last:border-0 hover:bg-paper"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink" dir="auto">
                          {f.name}
                        </p>
                        {f.subdomain && (
                          <p className="text-xs text-ink-soft" dir="ltr">
                            <bdi>{f.subdomain}</bdi>
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={f.status} text={statusLabel[f.status]} tone={STATUS_TONE[f.status]} />
                      </td>
                      <td className="px-4 py-3 tabular-nums text-ink-soft">
                        <bdi dir="ltr">{count === undefined ? "—" : numberFmt.format(count)}</bdi>
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums text-ink-soft">{stat(row?.sessions, numberFmt.format)}</td>
                      <td className="px-4 py-3 text-end tabular-nums text-ink-soft">{stat(row?.orders, numberFmt.format)}</td>
                      <td className="px-4 py-3 text-end tabular-nums text-ink-soft">
                        {stat(row ? row.conversionRate : undefined, (v) => formatPercentValue(percentToRatio(v)))}
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums text-ink-soft">
                        {stat(row?.revenue, (v) => formatMoney(v, currency))}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{formatDate(f.updatedAt)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-end" onClick={(e) => e.stopPropagation()}>
                        {/* One clear action, and the rest behind a menu with their names. */}
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => navigate(`/funnels/${f.id}`)}>
                            <Pencil className="size-4" aria-hidden />
                            {c.edit}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label={t.moreActions} title={t.moreActions} />}>
                              {busy ? <Spinner className="size-4" /> : <MoreHorizontal className="size-4" aria-hidden />}
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-52">
                              {analyticsAllowed && (
                                <DropdownMenuItem onClick={() => navigate(`/analytics/funnels/${f.id}`)}>
                                  <BarChart3 className="size-4" aria-hidden />
                                  {t.viewAnalytics}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem disabled={busy} onClick={() => void changeStatus(f)}>
                                {f.status === "published" ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                                {f.status === "published" ? t.pause : f.status === "paused" ? t.resume : t.publish}
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled={busyId !== null} onClick={() => void duplicate(f)}>
                                <Copy className="size-4" aria-hidden />
                                {t.duplicate}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setSharing(f)}>
                                <Share2 className="size-4" aria-hidden />
                                {t.share}
                              </DropdownMenuItem>
                              {url && (
                                <DropdownMenuItem onClick={() => void copyLink(url)}>
                                  <Link2 className="size-4" aria-hidden />
                                  {t.copyShareLink}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(f)}>
                                <Trash2 className="size-4" aria-hidden />
                                {c.delete}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DataState>

      <Modal open={creating} onClose={() => setCreating(false)} title={t.createFunnel} description={t.modalDescription}>
        {creating && <FunnelWizard onCancel={() => setCreating(false)} onCreated={(id) => navigate(`/funnels/${id}`)} />}
      </Modal>

      <FunnelShareDialog funnel={sharing} onClose={() => setSharing(null)} />

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? fmt(t.deleteTitleNamed, { name: deleting.name }) : t.deleteTitle}
        description={t.deleteDescription}
        confirmLabel={t.deleteConfirm}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

/** The one-screen form the wizard replaced; kept for callers that want name + template only. */
export function CreateFunnelForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(FORM_STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const describeError = useFunnelErrorMessage();
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<StarterTemplateId>("blank");
  const templates = useMemo(() => startTemplates(locale), [locale]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t.nameRequired);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const funnel = await createFunnelFromStarter(workspaceId, name.trim(), templateId, locale);
      toast.success(fmt(t.toastCreated, { name: funnel.name }));
      onCreated(funnel.id);
    } catch (err) {
      const partial = partialIdOf(err);
      if (partial) {
        toast.error(fmt(t.toastCreatedPartial, { message: describeError(err) }));
        onCreated(partial);
        return;
      }
      setError(describeError(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="funnel-name">{t.name}</Label>
        <Input id="funnel-name" dir="auto" maxLength={200} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} autoFocus />
        {error && <p className="text-xs font-medium text-danger">{error}</p>}
      </div>

      <div className="space-y-2">
        <Label>{t.startFrom}</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {templates.map((tpl) => {
            const active = tpl.id === templateId;
            return (
              <label
                key={tpl.id}
                className={cn(
                  "cursor-pointer rounded-2xl border p-3 transition-colors",
                  active ? "border-primary bg-primary-soft ring-1 ring-primary/30" : "border-line hover:border-primary/50"
                )}
              >
                <input type="radio" name="funnel-template" className="sr-only" checked={active} onChange={() => setTemplateId(tpl.id)} />
                <p className={cn("text-sm font-semibold", active ? "text-primary-dark" : "text-ink")}>{tpl.name}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{tpl.description}</p>
                <StepChain types={tpl.types} className="mt-2" />
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {c.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t.creating : t.createAndOpen}
        </Button>
      </div>
    </form>
  );
}
