import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Ban, CheckCircle2, CreditCard, Globe, Package, RefreshCw, ScrollText, ShoppingCart, Users, Wallet, XCircle } from "lucide-react";
import { Button, Textarea, buttonVariants, useAsync } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DetailRow } from "@/components/Drawer";
import { KpiCard } from "@/components/KpiCard";
import { Panel, Mono } from "@/components/Panel";
import { Status, useStatusLabel } from "@/components/StatusBadge";
import { SubscriptionEditor } from "@/components/SubscriptionEditor";
import { useToast } from "@/components/Toast";
import { adminApi, type AdminWorkspaceDetail, type WorkspaceStatus } from "@/lib/adminApi";
import { formatDate, formatDateTime, formatMinor, formatNumber, formatRelative } from "@/lib/format";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    back: "Workspaces",
    created: "Created {date}",
    suspend: "Suspend",
    reactivate: "Reactivate",
    close: "Close workspace",
    suspendTitle: "Suspend {name}?",
    suspendDesc: "The store stops serving publicly until it's reactivated.",
    closeTitle: "Close {name}?",
    closeDesc: "The store stops serving publicly. You can reactivate it later.",
    reactivateTitle: "Reactivate {name}?",
    reactivateDesc: "The store starts serving publicly again.",
    reason: "Reason (saved in the audit log)",
    reasonPlaceholder: "e.g. Chargeback abuse reported by payment provider",
    statusChanged: "Workspace is now {status}.",
    orders: "Orders",
    orders30d: "{n} in the last 30 days",
    lastOrder: "Last order {when}",
    noOrders: "No orders yet",
    revenue: "Revenue (30 days)",
    products: "Products",
    members: "Active members",
    details: "Details",
    id: "ID",
    slug: "Slug",
    currency: "Default currency",
    status: "Workspace status",
    owner: "Owner",
    noOwner: "Owner account not found.",
    email: "Email",
    phone: "Phone",
    ownerStatus: "Account status",
    lastLogin: "Last login",
    subscription: "Subscription",
    noSubscription: "This workspace has no subscription.",
    changeSubscription: "Change",
    plan: "Plan",
    cycle: "Billing cycle",
    trialEnds: "Trial ends",
    periodStart: "Period started",
    periodEnd: "Period ends",
    graceUntil: "Grace until",
    cancelAtEnd: "Cancel at period end",
    provider: "Payment provider",
    websites: "Websites",
    noWebsites: "No websites yet.",
    audit: "Audit log",
  },
  ar: {
    back: "مساحات العمل",
    created: "اتعملت {date}",
    suspend: "إيقاف",
    reactivate: "إعادة تفعيل",
    close: "قفل مساحة العمل",
    suspendTitle: "توقف {name}؟",
    suspendDesc: "المتجر هيبطل يشتغل للجمهور لحد ما يتفعّل تاني.",
    closeTitle: "تقفل {name}؟",
    closeDesc: "المتجر هيبطل يشتغل للجمهور. تقدر تفعّله تاني بعدين.",
    reactivateTitle: "تفعّل {name} تاني؟",
    reactivateDesc: "المتجر هيرجع يشتغل للجمهور.",
    reason: "السبب (بيتسجل في سجل العمليات)",
    reasonPlaceholder: "مثلاً: بلاغ استرجاع مبالغ متكرر من مزود الدفع",
    statusChanged: "حالة مساحة العمل بقت {status}.",
    orders: "الطلبات",
    orders30d: "{n} في آخر 30 يوم",
    lastOrder: "آخر طلب {when}",
    noOrders: "مفيش طلبات لسه",
    revenue: "الإيراد (30 يوم)",
    products: "المنتجات",
    members: "الأعضاء النشطين",
    details: "التفاصيل",
    id: "المعرّف",
    slug: "الـ Slug",
    currency: "العملة الأساسية",
    status: "حالة مساحة العمل",
    owner: "المالك",
    noOwner: "حساب المالك مش موجود.",
    email: "الإيميل",
    phone: "الموبايل",
    ownerStatus: "حالة الحساب",
    lastLogin: "آخر دخول",
    subscription: "الاشتراك",
    noSubscription: "مساحة العمل دي مالهاش اشتراك.",
    changeSubscription: "تعديل",
    plan: "الباقة",
    cycle: "دورة الفوترة",
    trialEnds: "نهاية التجربة",
    periodStart: "بداية الفترة",
    periodEnd: "نهاية الفترة",
    graceUntil: "مهلة لحد",
    cancelAtEnd: "إلغاء في نهاية الفترة",
    provider: "مزود الدفع",
    websites: "المواقع",
    noWebsites: "مفيش مواقع لسه.",
    audit: "سجل العمليات",
  },
};

export function WorkspaceDetailPage() {
  const { id = "" } = useParams();
  const t = useT(STRINGS);
  const c = useCommon();
  const { data, loading, error, refresh } = useAsync(() => adminApi.getWorkspace(id), [id]);

  return (
    <div>
      <Link to="/workspaces" className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {t.back}
      </Link>
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        {data && <Detail ws={data} refresh={() => void refresh({ silent: true })} />}
      </DataState>
      {!data && !loading && !error && <p className="text-sm text-ink-soft">{c.empty}</p>}
    </div>
  );
}

function Detail({ ws, refresh }: { ws: AdminWorkspaceDetail; refresh: () => void }) {
  const t = useT(STRINGS);
  const c = useCommon();
  const toast = useToast();
  const statusLabel = useStatusLabel();
  const [pending, setPending] = useState<WorkspaceStatus | null>(null);
  const [reason, setReason] = useState("");
  const [editSub, setEditSub] = useState(false);
  const sub = ws.subscription;

  const openConfirm = (s: WorkspaceStatus) => {
    setReason("");
    setPending(s);
  };

  const confirmCopy =
    pending === "suspended"
      ? { title: t.suspendTitle, desc: t.suspendDesc, label: t.suspend }
      : pending === "closed"
        ? { title: t.closeTitle, desc: t.closeDesc, label: t.close }
        : { title: t.reactivateTitle, desc: t.reactivateDesc, label: t.reactivate };

  return (
    <>
      <PageHeader
        title={ws.name}
        description={fmt(t.created, { date: formatDate(ws.createdAt) })}
        actions={
          <>
            <Status value={ws.status} />
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw /> {c.refresh}
            </Button>
            <Link to={`/audit-log?workspaceId=${ws.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ScrollText /> {t.audit}
            </Link>
            {ws.status === "active" ? (
              <>
                <Button variant="destructive" size="sm" onClick={() => openConfirm("suspended")}>
                  <Ban /> {t.suspend}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => openConfirm("closed")}>
                  <XCircle /> {t.close}
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" onClick={() => openConfirm("active")}>
                  <CheckCircle2 /> {t.reactivate}
                </Button>
                {ws.status === "suspended" && (
                  <Button variant="destructive" size="sm" onClick={() => openConfirm("closed")}>
                    <XCircle /> {t.close}
                  </Button>
                )}
              </>
            )}
          </>
        }
      />

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={t.orders}
            value={formatNumber(ws.counts.orders)}
            icon={<ShoppingCart />}
            hint={`${fmt(t.orders30d, { n: formatNumber(ws.counts.orders30d) })} · ${ws.lastOrderAt ? fmt(t.lastOrder, { when: formatRelative(ws.lastOrderAt) }) : t.noOrders}`}
          />
          <KpiCard label={t.revenue} value={formatMinor(ws.revenue30d, ws.defaultCurrency)} icon={<Wallet />} />
          <KpiCard label={t.products} value={formatNumber(ws.counts.products)} icon={<Package />} />
          <KpiCard label={t.members} value={formatNumber(ws.counts.members)} icon={<Users />} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel title={t.details}>
            <dl>
              <DetailRow label={t.id}>
                <Mono>{ws.id}</Mono>
              </DetailRow>
              <DetailRow label={t.slug}>
                <span dir="ltr">{ws.slug}</span>
              </DetailRow>
              <DetailRow label={t.status}>
                <Status value={ws.status} />
              </DetailRow>
              <DetailRow label={t.currency}>{ws.defaultCurrency}</DetailRow>
            </dl>
          </Panel>

          <Panel title={t.owner}>
            {ws.owner ? (
              <dl>
                <DetailRow label={t.owner}>{ws.owner.fullName || "—"}</DetailRow>
                <DetailRow label={t.email}>
                  <span dir="ltr">{ws.owner.email}</span>
                </DetailRow>
                <DetailRow label={t.phone}>
                  <span dir="ltr">{ws.owner.phone || "—"}</span>
                </DetailRow>
                <DetailRow label={t.ownerStatus}>
                  <Status value={ws.owner.status} />
                </DetailRow>
                <DetailRow label={t.lastLogin}>{formatDateTime(ws.owner.lastLoginAt)}</DetailRow>
              </dl>
            ) : (
              <EmptyBlock message={t.noOwner} />
            )}
          </Panel>

          <Panel
            title={t.subscription}
            actions={
              sub && (
                <Button variant="outline" size="sm" onClick={() => setEditSub(true)}>
                  <CreditCard /> {t.changeSubscription}
                </Button>
              )
            }
          >
            {sub ? (
              <dl>
                <DetailRow label={c.status}>
                  <Status value={sub.status} />
                </DetailRow>
                <DetailRow label={t.plan}>{sub.plan ? `${sub.plan.name} · ${formatMinor(sub.billingCycle === "yearly" ? sub.plan.yearlyPriceAmount : sub.plan.monthlyPriceAmount, sub.plan.currency)}` : "—"}</DetailRow>
                <DetailRow label={t.cycle}>
                  <Status value={sub.billingCycle} />
                </DetailRow>
                <DetailRow label={t.trialEnds}>{formatDate(sub.trialEndsAt)}</DetailRow>
                <DetailRow label={t.periodStart}>{formatDate(sub.currentPeriodStart)}</DetailRow>
                <DetailRow label={t.periodEnd}>{formatDate(sub.currentPeriodEnd)}</DetailRow>
                <DetailRow label={t.graceUntil}>{formatDate(sub.graceUntil)}</DetailRow>
                <DetailRow label={t.cancelAtEnd}>{sub.cancelAtPeriodEnd ? c.yes : c.no}</DetailRow>
                <DetailRow label={t.provider}>{sub.externalProvider || "—"}</DetailRow>
              </dl>
            ) : (
              <EmptyBlock message={t.noSubscription} />
            )}
          </Panel>

          <Panel title={t.websites} flush>
            {ws.websites.length === 0 ? (
              <div className="p-4">
                <EmptyBlock message={t.noWebsites} />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {ws.websites.map((site) => (
                  <li key={site.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <Globe className="size-4 shrink-0 text-ink-muted" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{site.name}</span>
                      <span className="block truncate font-mono text-xs text-ink-soft" dir="ltr">
                        {site.subdomain}
                      </span>
                    </span>
                    <Status value={site.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={fmt(confirmCopy.title, { name: ws.name })}
        description={confirmCopy.desc}
        confirmLabel={confirmCopy.label}
        destructive={pending !== "active"}
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          const res = await adminApi.setWorkspaceStatus(ws.id, pending, reason.trim() || undefined);
          toast.success(fmt(t.statusChanged, { status: statusLabel(res.workspace.status) }));
          setPending(null);
          refresh();
        }}
      >
        <label className="mt-2 block space-y-1.5 text-sm">
          <span className="text-ink">{t.reason}</span>
          <Textarea value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder={t.reasonPlaceholder} />
        </label>
      </ConfirmDialog>

      {sub && (
        <SubscriptionEditor
          open={editSub}
          workspaceId={ws.id}
          workspaceName={ws.name}
          current={{
            status: sub.status,
            planId: sub.plan?.id ?? null,
            billingCycle: sub.billingCycle,
            currentPeriodEnd: sub.currentPeriodEnd,
            trialEndsAt: sub.trialEndsAt,
            graceUntil: sub.graceUntil,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          }}
          onClose={() => setEditSub(false)}
          onSaved={refresh}
        />
      )}
    </>
  );
}
