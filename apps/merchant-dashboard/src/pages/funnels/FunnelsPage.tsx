import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Eye, Layers, MousePointerClick, Pause, Pencil, Play, Plus, ShoppingBag, Trash2, Wallet } from "lucide-react";
import { Button, Input, Label, cn } from "@store-builder/ui";
import type { Funnel, FunnelStatus } from "@/mock/types";
import { mockApi } from "@/mock/api";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { KpiCard } from "@/components/KpiCard";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useLocale, useT, type Locale, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Funnels",
    description: "Single-product sales flows with order bumps, upsells and downsells.",
    createFunnel: "Create funnel",
    kpiVisits: "Total visits",
    kpiVisitsHint: "All funnels, all time",
    kpiOrders: "Orders",
    kpiOrdersHint: "Completed checkouts",
    kpiRevenue: "Revenue",
    kpiRevenueHint: "Including offers",
    kpiConversion: "Avg. conversion",
    kpiConversionHint: "Visits → orders, funnels with traffic",
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
    copyShareLink: "Copy share link",
    toastLive: "\"{name}\" is live.",
    toastPaused: "\"{name}\" paused.",
    toastResumed: "\"{name}\" resumed.",
    toastDuplicatedAs: "Duplicated as \"{name}\".",
    toastDuplicated: "Funnel duplicated.",
    toastCopied: "Copied {url}",
    toastCopyFailed: "Couldn't copy to clipboard.",
    toastDeleted: "\"{name}\" deleted.",
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
    kpiVisits: "إجمالي الزيارات",
    kpiVisitsHint: "كل المسارات، منذ البداية",
    kpiOrders: "الطلبات",
    kpiOrdersHint: "عمليات دفع مكتملة",
    kpiRevenue: "الإيرادات",
    kpiRevenueHint: "شاملة العروض",
    kpiConversion: "متوسط معدل التحويل",
    kpiConversionHint: "من الزيارات إلى الطلبات، للمسارات التي بها زيارات",
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
    copyShareLink: "نسخ رابط المشاركة",
    toastLive: "«{name}» منشور الآن.",
    toastPaused: "تم إيقاف «{name}» مؤقتًا.",
    toastResumed: "تم استئناف «{name}».",
    toastDuplicatedAs: "تم النسخ باسم «{name}».",
    toastDuplicated: "تم نسخ مسار البيع.",
    toastCopied: "تم نسخ {url}",
    toastCopyFailed: "تعذّر النسخ إلى الحافظة.",
    toastDeleted: "تم حذف «{name}».",
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
    creating: "Creating…",
    createAndOpen: "Create and open editor",
  },
  ar: {
    name: "الاسم",
    nameRequired: "اكتب اسمًا لمسار البيع.",
    namePlaceholder: "عرض السماعة Pro — رمضان",
    startFrom: "ابدأ من",
    toastCreated: "تم إنشاء «{name}».",
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
  id: string | null;
  name: string;
  description: string;
}

const START_TEMPLATES: Record<Locale, StartTemplate[]> = {
  en: [
    { id: null, name: "Blank", description: "Landing → checkout → thank you. Build the rest yourself." },
    { id: "tpl-cod-single", name: "COD single product", description: "One product, cash on delivery, phone-first checkout." },
    { id: "tpl-upsell-downsell", name: "Upsell + downsell", description: "Post-purchase offer with a fallback if declined." },
    { id: "tpl-lead-magnet", name: "Lead magnet", description: "Collect a phone number first, sell on the thank-you page." },
  ],
  ar: [
    { id: null, name: "فارغ", description: "صفحة الهبوط ← صفحة الدفع ← صفحة الشكر. وأكمل الباقي بنفسك." },
    { id: "tpl-cod-single", name: "منتج واحد بالدفع عند الاستلام", description: "منتج واحد، دفع عند الاستلام، وصفحة دفع تبدأ برقم الهاتف." },
    { id: "tpl-upsell-downsell", name: "عرض بعد الشراء + عرض بديل", description: "عرض بعد الشراء مع عرض بديل إذا رفضه العميل." },
    { id: "tpl-lead-magnet", name: "جذب العملاء المحتملين", description: "اجمع رقم الهاتف أولًا، ثم اعرض البيع في صفحة الشكر." },
  ],
};

function conversionPercent(f: Funnel): number {
  return f.visits > 0 ? (f.orders / f.visits) * 100 : 0;
}

function shareLink(f: Funnel): string {
  return `https://${f.slug}.zimos.test`;
}

export function FunnelsPage() {
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const toast = useToast();
  const t = useT(STRINGS);
  const c = useCommon();
  const { intlLocale } = useLocale();
  const list = useAsync(() => mockApi.listFunnels(workspaceId), [workspaceId]);

  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Funnel | null>(null);

  const funnels = list.data ?? [];
  const reload = () => list.refresh({ silent: true });

  const numberFmt = useMemo(() => new Intl.NumberFormat(intlLocale), [intlLocale]);
  const percentFmt = useMemo(
    () => new Intl.NumberFormat(intlLocale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [intlLocale]
  );

  const statusLabel: Record<FunnelStatus, string> = {
    draft: t.statusDraft,
    published: t.statusPublished,
    paused: t.statusPaused,
  };

  const kpis = useMemo(() => {
    const visits = funnels.reduce((a, f) => a + f.visits, 0);
    const orders = funnels.reduce((a, f) => a + f.orders, 0);
    const revenue = funnels.reduce((a, f) => a + Number(f.revenueAmount), 0);
    const withTraffic = funnels.filter((f) => f.visits > 0);
    const avgConversion = withTraffic.length > 0 ? withTraffic.reduce((a, f) => a + conversionPercent(f), 0) / withTraffic.length : 0;
    return { visits, orders, revenue, avgConversion, currency: funnels[0]?.currency ?? "EGP" };
  }, [funnels]);

  async function setStatus(f: Funnel, status: FunnelStatus) {
    try {
      await mockApi.setFunnelStatus(workspaceId, f.id, status);
      toast.success(fmt(status === "published" ? t.toastLive : status === "paused" ? t.toastPaused : t.toastResumed, { name: f.name }));
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function duplicate(f: Funnel) {
    try {
      const copy = await mockApi.duplicateFunnel(workspaceId, f.id);
      toast.success(copy ? fmt(t.toastDuplicatedAs, { name: copy.name }) : t.toastDuplicated);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function copyLink(f: Funnel) {
    const url = shareLink(f);
    try {
      await navigator.clipboard.writeText(url);
      toast.success(fmt(t.toastCopied, { url }));
    } catch {
      toast.error(t.toastCopyFailed);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    await mockApi.deleteFunnel(workspaceId, deleting.id);
    toast.success(fmt(t.toastDeleted, { name: deleting.name }));
    setDeleting(null);
    reload();
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden /> {t.createFunnel}
          </Button>
        }
      />

      <DataState loading={list.loading} error={list.error} onRetry={() => list.refresh()}>
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label={t.kpiVisits} value={<bdi dir="ltr">{numberFmt.format(kpis.visits)}</bdi>} icon={<Eye />} hint={t.kpiVisitsHint} />
          <KpiCard label={t.kpiOrders} value={<bdi dir="ltr">{numberFmt.format(kpis.orders)}</bdi>} icon={<ShoppingBag />} hint={t.kpiOrdersHint} />
          <KpiCard label={t.kpiRevenue} value={<bdi dir="ltr">{formatMoney(kpis.revenue, kpis.currency)}</bdi>} icon={<Wallet />} hint={t.kpiRevenueHint} />
          <KpiCard label={t.kpiConversion} value={<bdi dir="ltr">{percentFmt.format(kpis.avgConversion / 100)}</bdi>} icon={<MousePointerClick />} hint={t.kpiConversionHint} />
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
                {funnels.map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => navigate(`/funnels/${f.id}`)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-paper"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink" dir="auto">
                        {f.name}
                      </p>
                      <p className="text-xs text-ink-soft" dir="ltr">
                        <bdi>{f.slug}.zimos.test</bdi>
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={statusLabel[f.status]} tone={STATUS_TONE[f.status]} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink-soft">
                      <bdi dir="ltr">{numberFmt.format(f.steps.length)}</bdi>
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-ink-soft">
                      <bdi dir="ltr">{numberFmt.format(f.visits)}</bdi>
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-ink-soft">
                      <bdi dir="ltr">{numberFmt.format(f.orders)}</bdi>
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-ink">
                      <bdi dir="ltr">{percentFmt.format(conversionPercent(f) / 100)}</bdi>
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-ink">
                      <bdi dir="ltr">{formatMoney(f.revenueAmount, f.currency)}</bdi>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{formatDate(f.updatedAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-end" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button size="icon-sm" variant="ghost" title={c.edit} aria-label={c.edit} onClick={() => navigate(`/funnels/${f.id}`)}>
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        {f.status === "published" ? (
                          <Button size="icon-sm" variant="ghost" title={t.pause} aria-label={t.pause} onClick={() => void setStatus(f, "paused")}>
                            <Pause className="size-4" aria-hidden />
                          </Button>
                        ) : (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title={f.status === "paused" ? t.resume : t.publish}
                            aria-label={f.status === "paused" ? t.resume : t.publish}
                            onClick={() => void setStatus(f, "published")}
                          >
                            <Play className="size-4" aria-hidden />
                          </Button>
                        )}
                        <Button size="icon-sm" variant="ghost" title={t.duplicate} aria-label={t.duplicate} onClick={() => void duplicate(f)}>
                          <Copy className="size-4" aria-hidden />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void copyLink(f)}>
                          {t.copyShareLink}
                        </Button>
                        <Button size="icon-sm" variant="ghost" className="text-danger hover:bg-danger-soft" title={c.delete} aria-label={c.delete} onClick={() => setDeleting(f)}>
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataState>

      <Modal open={creating} onClose={() => setCreating(false)} title={t.createFunnel} description={t.modalDescription}>
        {creating && <CreateFunnelForm onCancel={() => setCreating(false)} onCreated={(f) => navigate(`/funnels/${f.id}`)} />}
      </Modal>

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

function CreateFunnelForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (f: Funnel) => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(FORM_STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
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
      const funnel = await mockApi.createFunnel(workspaceId, { name: name.trim(), templateId });
      toast.success(fmt(t.toastCreated, { name: funnel.name }));
      onCreated(funnel);
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="funnel-name">{t.name}</Label>
        <Input id="funnel-name" dir="auto" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} autoFocus />
        {error && <p className="text-xs font-medium text-danger">{error}</p>}
      </div>

      <div className="space-y-2">
        <Label>{t.startFrom}</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {START_TEMPLATES[locale].map((tpl) => {
            const active = tpl.id === templateId;
            return (
              <label
                key={tpl.id ?? "blank"}
                className={cn(
                  "cursor-pointer rounded-2xl border p-3 transition-colors",
                  active ? "border-primary bg-primary-soft ring-1 ring-primary/30" : "border-line hover:border-primary/50"
                )}
              >
                <input type="radio" name="funnel-template" className="sr-only" checked={active} onChange={() => setTemplateId(tpl.id)} />
                <p className={cn("text-sm font-semibold", active ? "text-primary-dark" : "text-ink")}>{tpl.name}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{tpl.description}</p>
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
