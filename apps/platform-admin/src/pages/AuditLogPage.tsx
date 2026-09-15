import { Fragment, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, RefreshCw } from "lucide-react";
import { Button, Input, Table, TableBody, TableHeader, TableRow, cn, useAsync } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { JsonBlock, Mono, Panel, Td, Th } from "@/components/Panel";
import { NativeSelect } from "@/components/forms";
import { useToast } from "@/components/Toast";
import { adminApi, type AdminAuditLog } from "@/lib/adminApi";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { useCommon, useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Audit log",
    description: "Every recorded action across the platform, newest first.",
    action: "Action starts with",
    actionPlaceholder: "e.g. admin. or user.login",
    entityType: "Entity type",
    entityPlaceholder: "e.g. Workspace",
    workspace: "Workspace",
    allWorkspaces: "All workspaces",
    apply: "Apply",
    clear: "Clear",
    when: "When",
    actor: "Actor",
    entity: "Entity",
    ip: "IP",
    system: "System",
    empty: "No audit entries match these filters.",
    before: "Before",
    after: "After",
    details: "Show details",
    end: "End of log.",
  },
  ar: {
    title: "سجل العمليات",
    description: "كل العمليات المتسجلة على المنصة، الأحدث الأول.",
    action: "العملية بتبدأ بـ",
    actionPlaceholder: "مثلاً admin. أو user.login",
    entityType: "نوع الكيان",
    entityPlaceholder: "مثلاً Workspace",
    workspace: "مساحة العمل",
    allWorkspaces: "كل مساحات العمل",
    apply: "طبّق",
    clear: "امسح",
    when: "الوقت",
    actor: "المنفّذ",
    entity: "الكيان",
    ip: "IP",
    system: "النظام",
    empty: "مفيش عمليات بالفلاتر دي.",
    before: "قبل",
    after: "بعد",
    details: "اعرض التفاصيل",
    end: "آخر السجل.",
  },
};

const PAGE = 50;

export function AuditLogPage() {
  const t = useT(STRINGS);
  const c = useCommon();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const filters = { action: params.get("action") ?? "", entityType: params.get("entityType") ?? "", workspaceId: params.get("workspaceId") ?? "" };
  const [draft, setDraft] = useState(filters);
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const workspaces = useAsync(() => adminApi.listWorkspaces(), []);

  const first = useAsync(
    () => adminApi.listAuditLogs({ limit: PAGE, action: filters.action || undefined, entityType: filters.entityType || undefined, workspaceId: filters.workspaceId || undefined }),
    [filters.action, filters.entityType, filters.workspaceId]
  );

  useEffect(() => {
    if (first.data) {
      setLogs(first.data.logs);
      setCursor(first.data.nextCursor);
    }
  }, [first.data]);

  useEffect(() => {
    setDraft(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const apply = (next: typeof filters) => {
    const p: Record<string, string> = {};
    for (const [k, v] of Object.entries(next)) if (v.trim()) p[k] = v.trim();
    setParams(p, { replace: true });
  };

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await adminApi.listAuditLogs({ limit: PAGE, before: cursor, action: filters.action || undefined, entityType: filters.entityType || undefined, workspaceId: filters.workspaceId || undefined });
      setLogs((prev) => [...prev, ...res.logs]);
      setCursor(res.nextCursor);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button variant="outline" size="sm" onClick={() => void first.refresh()} disabled={first.loading}>
            <RefreshCw /> {c.refresh}
          </Button>
        }
      />

      <form
        className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          apply(draft);
        }}
      >
        <label className="space-y-1.5 text-sm">
          <span className="text-ink-soft">{t.action}</span>
          <Input value={draft.action} onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))} placeholder={t.actionPlaceholder} dir="ltr" />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-ink-soft">{t.entityType}</span>
          <Input value={draft.entityType} onChange={(e) => setDraft((d) => ({ ...d, entityType: e.target.value }))} placeholder={t.entityPlaceholder} dir="ltr" />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-ink-soft">{t.workspace}</span>
          <NativeSelect value={draft.workspaceId} onChange={(e) => apply({ ...draft, workspaceId: e.target.value })}>
            <option value="">{t.allWorkspaces}</option>
            {(workspaces.data ?? []).map((w) => (
              <option key={w.workspaceId} value={w.workspaceId}>
                {w.workspaceName}
              </option>
            ))}
            {filters.workspaceId && !workspaces.data?.some((w) => w.workspaceId === filters.workspaceId) && <option value={filters.workspaceId}>{filters.workspaceId}</option>}
          </NativeSelect>
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit">{t.apply}</Button>
          <Button type="button" variant="outline" onClick={() => apply({ action: "", entityType: "", workspaceId: "" })}>
            {t.clear}
          </Button>
        </div>
      </form>

      <DataState loading={first.loading} error={first.error} onRetry={() => void first.refresh()} empty={!!first.data && logs.length === 0} emptyMessage={t.empty}>
        <Panel flush>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>{t.when}</Th>
                  <Th>{t.action}</Th>
                  <Th>{t.actor}</Th>
                  <Th>{t.workspace}</Th>
                  <Th>{t.entity}</Th>
                  <Th>{t.ip}</Th>
                  <Th />
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const expanded = open === log.id;
                  const hasDiff = log.before !== null || log.after !== null;
                  return (
                    <Fragment key={log.id}>
                      <TableRow>
                        <Td className="whitespace-nowrap text-ink-soft">{formatDateTime(log.createdAt)}</Td>
                        <Td>
                          <Mono>{log.action}</Mono>
                        </Td>
                        <Td>{log.actor ? <span title={log.actor.email}>{log.actor.fullName || log.actor.email}</span> : <span className="text-ink-muted">{t.system}</span>}</Td>
                        <Td>
                          {log.workspace ? (
                            <Link to={`/workspaces/${log.workspace.id}`} className="hover:text-primary">
                              {log.workspace.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </Td>
                        <Td className="text-ink-soft">
                          {log.entityType}
                          {log.entityId && (
                            <span className="block font-mono text-xs text-ink-muted" dir="ltr">
                              {log.entityId.slice(0, 8)}
                            </span>
                          )}
                        </Td>
                        <Td className="font-mono text-xs text-ink-soft" >
                          <span dir="ltr">{log.ipAddress || "—"}</span>
                        </Td>
                        <Td className="text-end">
                          {hasDiff && (
                            <button
                              type="button"
                              aria-expanded={expanded}
                              aria-label={t.details}
                              onClick={() => setOpen(expanded ? null : log.id)}
                              className="cursor-pointer rounded-md p-1 text-ink-soft hover:bg-primary-soft hover:text-ink"
                            >
                              <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden />
                            </button>
                          )}
                        </Td>
                      </TableRow>
                      {expanded && (
                        <TableRow className="hover:bg-transparent">
                          <Td colSpan={7}>
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" dir="ltr">
                              <div>
                                <p className="mb-1 text-xs font-medium text-ink-soft">{t.before}</p>
                                <JsonBlock value={log.before} />
                              </div>
                              <div>
                                <p className="mb-1 text-xs font-medium text-ink-soft">{t.after}</p>
                                <JsonBlock value={log.after} />
                              </div>
                            </div>
                          </Td>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Panel>
        <div className="mt-4 flex justify-center">
          {cursor ? (
            <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore ? c.loading : c.loadMore}
            </Button>
          ) : (
            logs.length > 0 && <p className="text-sm text-ink-muted">{t.end}</p>
          )}
        </div>
      </DataState>
    </div>
  );
}
