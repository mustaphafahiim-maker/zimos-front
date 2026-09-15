import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Hourglass, Pencil, RefreshCw } from "lucide-react";
import { Button, Table, TableBody, TableHeader, TableRow, useAsync } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Panel, Td, Th } from "@/components/Panel";
import { FilterChips, SearchInput } from "@/components/forms";
import { Status, useStatusLabel } from "@/components/StatusBadge";
import { SubscriptionEditor } from "@/components/SubscriptionEditor";
import { useToast } from "@/components/Toast";
import { adminApi, SUBSCRIPTION_STATUSES, type AdminWorkspaceRow } from "@/lib/adminApi";
import { formatDate, formatNumber } from "@/lib/format";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Subscriptions",
    description: "One subscription per workspace. Changes are applied immediately.",
    runTrialCheck: "Run trial check",
    trialTitle: "Run the trial expiry check now?",
    trialDesc: "Every trial that has already ended is marked past due. This can't be undone from here.",
    trialDone: "Trial check finished — {n} trial(s) expired.",
    search: "Search workspace…",
    workspace: "Workspace",
    plan: "Plan",
    trialEnds: "Trial ends",
    periodEnd: "Period ends",
    orders: "Orders",
    change: "Change",
    empty: "No subscriptions yet.",
    noMatch: "No subscriptions match these filters.",
    overdue: "ended",
  },
  ar: {
    title: "الاشتراكات",
    description: "اشتراك واحد لكل مساحة عمل. التعديلات بتتطبق فورًا.",
    runTrialCheck: "شغّل فحص التجارب",
    trialTitle: "تشغّل فحص انتهاء الفترات التجريبية دلوقتي؟",
    trialDesc: "كل فترة تجريبية خلصت هتتعلّم متأخرة في الدفع. مينفعش ترجع فيها من هنا.",
    trialDone: "الفحص خلص — {n} فترة تجريبية انتهت.",
    search: "دوّر على مساحة عمل…",
    workspace: "مساحة العمل",
    plan: "الباقة",
    trialEnds: "نهاية التجربة",
    periodEnd: "نهاية الفترة",
    orders: "الطلبات",
    change: "تعديل",
    empty: "مفيش اشتراكات لسه.",
    noMatch: "مفيش اشتراكات بالفلاتر دي.",
    overdue: "خلصت",
  },
};

export function SubscriptionsPage() {
  const t = useT(STRINGS);
  const c = useCommon();
  const toast = useToast();
  const statusLabel = useStatusLabel();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "all";
  const { data, loading, error, refresh } = useAsync(() => adminApi.listWorkspaces(), []);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<AdminWorkspaceRow | null>(null);
  const [confirmTrial, setConfirmTrial] = useState(false);

  const rows = data ?? [];
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => (status === "all" || r.status === status) && (!needle || r.workspaceName.toLowerCase().includes(needle)));
  }, [rows, status, q]);

  const now = Date.now();

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw /> {c.refresh}
            </Button>
            <Button size="sm" onClick={() => setConfirmTrial(true)}>
              <Hourglass /> {t.runTrialCheck}
            </Button>
          </>
        }
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()} empty={!!data && rows.length === 0} emptyMessage={t.empty}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <FilterChips
            value={status}
            onChange={(v) => setParams(v === "all" ? {} : { status: v }, { replace: true })}
            options={[
              { value: "all", label: c.all, count: rows.length },
              ...SUBSCRIPTION_STATUSES.map((s) => ({ value: s, label: statusLabel(s), count: rows.filter((r) => r.status === s).length })),
            ]}
          />
          <SearchInput value={q} onChange={setQ} placeholder={t.search} />
        </div>
        <Panel flush>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>{t.workspace}</Th>
                  <Th>{t.plan}</Th>
                  <Th>{c.status}</Th>
                  <Th>{t.trialEnds}</Th>
                  <Th>{t.periodEnd}</Th>
                  <Th className="text-end">{t.orders}</Th>
                  <Th className="text-end">{c.actions}</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <Td colSpan={7} className="py-10 text-center text-ink-soft">
                      {t.noMatch}
                    </Td>
                  </TableRow>
                ) : (
                  filtered.map((r) => {
                    const trialOver = r.status === "trialing" && r.trialEndsAt && new Date(r.trialEndsAt).getTime() < now;
                    return (
                      <TableRow key={r.workspaceId}>
                        <Td>
                          <Link to={`/workspaces/${r.workspaceId}`} className="font-medium text-ink hover:text-primary">
                            {r.workspaceName}
                          </Link>
                        </Td>
                        <Td>{r.plan || "—"}</Td>
                        <Td>
                          <Status value={r.status} />
                        </Td>
                        <Td className={trialOver ? "text-warning" : "text-ink-soft"}>
                          {formatDate(r.trialEndsAt)}
                          {trialOver && ` · ${t.overdue}`}
                        </Td>
                        <Td className="text-ink-soft">{formatDate(r.currentPeriodEnd)}</Td>
                        <Td className="tabular text-end">{formatNumber(r.orderCount)}</Td>
                        <Td className="text-end">
                          <Button variant="outline" size="sm" onClick={() => setEditing(r)}>
                            <Pencil /> {t.change}
                          </Button>
                        </Td>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Panel>
      </DataState>

      {editing && (
        <SubscriptionEditor
          open
          workspaceId={editing.workspaceId}
          workspaceName={editing.workspaceName}
          current={{ status: editing.status, planName: editing.plan, currentPeriodEnd: editing.currentPeriodEnd, trialEndsAt: editing.trialEndsAt }}
          onClose={() => setEditing(null)}
          onSaved={() => void refresh({ silent: true })}
        />
      )}

      <ConfirmDialog
        open={confirmTrial}
        title={t.trialTitle}
        description={t.trialDesc}
        confirmLabel={t.runTrialCheck}
        onCancel={() => setConfirmTrial(false)}
        onConfirm={async () => {
          const res = await adminApi.runTrialCheck();
          toast.success(fmt(t.trialDone, { n: formatNumber(res.expired ?? 0) }));
          setConfirmTrial(false);
          void refresh({ silent: true });
        }}
      />
    </div>
  );
}
