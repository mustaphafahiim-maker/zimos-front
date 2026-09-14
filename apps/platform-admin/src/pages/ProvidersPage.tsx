import { useMemo, useState } from "react";
import { Lock, RefreshCw } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow, cn } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { Status, StatusBadge } from "@/components/StatusBadge";
import { Toggle } from "@store-builder/ui";
import { useToast } from "@/components/Toast";
import { useAsync } from "@store-builder/ui";
import { getErrorMessage } from "@/lib/errors";
import { adminApi } from "@/mock/adminApi";
import type { HealthStatus, Provider, ProviderKind } from "@/mock/types";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";

const COPY: Record<ProviderKind, { title: string; description: string; noun: string }> = {
  carrier: { title: "Carriers", description: "Shipping carrier integrations available to merchants.", noun: "carrier" },
  payment: { title: "Payment gateways", description: "Online payment providers available at checkout.", noun: "gateway" },
  whatsapp: { title: "WhatsApp numbers", description: "Platform-managed WhatsApp Business numbers.", noun: "number" },
};

export function ProvidersPage({ kind }: { kind: ProviderKind }) {
  const toast = useToast();
  const copy = COPY[kind];
  const { data, loading, error, refresh, setData } = useAsync(() => adminApi.listProviders(kind), [kind]);
  const [checking, setChecking] = useState<Set<string>>(new Set());

  const rows = useMemo(() => data ?? [], [data]);
  const replace = (p: Provider) => setData((prev) => (prev ?? []).map((x) => (x.id === p.id ? p : x)));
  const counts = (h: HealthStatus) => rows.filter((p) => p.health === h).length;

  async function toggle(p: Provider, enabled: boolean) {
    try {
      replace(await adminApi.setProviderEnabled(p.id, enabled));
      toast.success(`${p.name} ${enabled ? "enabled" : "disabled"}.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function check(ids: string[]) {
    setChecking((prev) => new Set([...prev, ...ids]));
    try {
      const results = await Promise.all(ids.map((id) => adminApi.runProviderCheck(id)));
      results.forEach(replace);
      if (ids.length > 1) toast.success(`Checked ${ids.length} ${copy.noun}s.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setChecking((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  }

  return (
    <div>
      <PageHeader
        title={copy.title}
        description={copy.description}
        actions={
          <Button variant="outline" size="sm" disabled={loading || rows.length === 0 || checking.size > 0} onClick={() => void check(rows.map((r) => r.id))}>
            <RefreshCw className={cn(checking.size > 0 && "animate-spin")} /> Check all
          </Button>
        }
      />
      <DataState
        loading={loading}
        error={error}
        onRetry={() => void refresh()}
        empty={rows.length === 0}
        emptyMessage={`No ${copy.noun}s registered.`}
      >
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(["operational", "degraded", "down"] as const).map((h) => (
            <div key={h} className="flex items-center justify-between rounded-[var(--radius-card)] border border-line bg-paper-raised px-4 py-3 shadow-[var(--shadow-card)]">
              <Status value={h} />
              <span className="tabular text-xl font-semibold text-ink">{counts(h)}</span>
            </div>
          ))}
        </div>

        <Alert variant="info" className="mb-4 flex items-center gap-2">
          <Lock className="size-4" aria-hidden />
          <span>Credentials are stored server-side and are never shown in the admin console. Only their status is visible here.</span>
        </Alert>

        <Panel flush>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <Th>{kind === "whatsapp" ? "Number" : "Provider"}</Th>
                <Th>Region</Th>
                {kind === "whatsapp" && <Th>Quality</Th>}
                <Th>Health</Th>
                <Th className="text-end">Errors 24h</Th>
                <Th>Last check</Th>
                <Th>Credentials</Th>
                <Th className="text-end">Workspaces</Th>
                <Th>Enabled</Th>
                <Th className="text-end">Actions</Th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const busy = checking.has(p.id);
                return (
                  <TableRow key={p.id} className={cn(!p.enabled && "opacity-70")}>
                    <Td className="max-w-xs whitespace-normal">
                      <span className="block font-medium">{p.name}</span>
                      {p.phoneNumber ? <span className="tabular block text-xs text-ink-soft">{p.phoneNumber}</span> : <Mono>{p.code}</Mono>}
                      {p.lastError && p.health !== "operational" && <span className="mt-1 block text-xs text-danger">{p.lastError}</span>}
                    </Td>
                    <Td className="text-ink-soft">{p.region}</Td>
                    {kind === "whatsapp" && (
                      <Td>
                        {p.qualityRating ? (
                          <StatusBadge tone={p.qualityRating === "high" ? "success" : p.qualityRating === "medium" ? "warning" : "danger"}>
                            {p.qualityRating}
                          </StatusBadge>
                        ) : (
                          "—"
                        )}
                      </Td>
                    )}
                    <Td>
                      <Status value={p.health} />
                      <span className="tabular mt-0.5 block text-xs text-ink-soft">{p.latencyMs > 0 ? `${formatNumber(p.latencyMs)} ms` : "No response"}</span>
                    </Td>
                    <Td className={cn("tabular text-end", p.errorRate24h >= 5 ? "text-danger" : p.errorRate24h >= 1 ? "text-warning" : "text-ink")}>
                      {p.errorRate24h.toFixed(1)}%
                    </Td>
                    <Td className="text-ink-soft" >
                      <span title={formatDateTime(p.lastCheckAt)}>{formatRelative(p.lastCheckAt)}</span>
                    </Td>
                    <Td>
                      <Status value={p.credentialStatus} />
                      <span className="mt-0.5 block text-xs text-ink-soft">
                        {p.credentialUpdatedAt ? `Rotated ${formatRelative(p.credentialUpdatedAt)}` : "Not set"}
                      </span>
                    </Td>
                    <Td className="tabular text-end">{formatNumber(p.workspacesUsing)}</Td>
                    <Td>
                      <Toggle label={`${p.name} enabled`} hideLabel checked={p.enabled} onChange={(v) => void toggle(p, v)} />
                    </Td>
                    <Td className="text-end">
                      <Button size="sm" variant="outline" onClick={() => void check([p.id])} disabled={busy}>
                        <RefreshCw className={cn(busy && "animate-spin")} /> {busy ? "Checking…" : "Run check"}
                      </Button>
                    </Td>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Panel>
      </DataState>
    </div>
  );
}
