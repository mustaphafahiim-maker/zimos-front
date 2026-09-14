import { useCallback, useEffect, useState } from "react";
import { Database, HardDrive, Layers, Mail, MessageCircle, MessageSquare, RefreshCw, Server } from "lucide-react";
import { Button, Spinner, cn } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { JsonBlock, Mono, Panel } from "@/components/Panel";
import { Status, StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAsync } from "@store-builder/ui";
import { getErrorMessage } from "@/lib/errors";
import { API_BASE_URL, backendRootUrl } from "@/lib/apiClient";
import { adminApi } from "@/mock/adminApi";
import type { ServiceTile } from "@/mock/types";
import { formatDateTime, formatRelative } from "@/lib/format";

interface ProbeResult {
  label: string;
  path: string;
  url: string;
  running: boolean;
  ok: boolean | null;
  httpStatus: number | null;
  latencyMs: number | null;
  body: unknown;
  error: string | null;
  checkedAt: string | null;
}

const PROBES = [
  { label: "Liveness", path: "/health", description: "Process is up and serving HTTP." },
  { label: "Readiness", path: "/health/ready", description: "Dependencies (database, queue) are reachable." },
] as const;

const TIMEOUT_MS = 8000;

function initialProbe(label: string, path: string): ProbeResult {
  return { label, path, url: `${backendRootUrl()}${path}`, running: true, ok: null, httpStatus: null, latencyMs: null, body: null, error: null, checkedAt: null };
}

async function runProbe(label: string, path: string): Promise<ProbeResult> {
  const url = `${backendRootUrl()}${path}`;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = performance.now();
  const base = { label, path, url, running: false, checkedAt: new Date().toISOString() };
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" }, cache: "no-store" });
    const latencyMs = Math.round(performance.now() - started);
    const type = res.headers.get("content-type") ?? "";
    const text = await res.text();
    if (!type.includes("json")) {
      return {
        ...base,
        ok: false,
        httpStatus: res.status,
        latencyMs,
        body: null,
        error: type.includes("html")
          ? "Received an HTML page instead of JSON — the request did not reach the backend (check the dev proxy / API base URL)."
          : `Unexpected content type “${type || "none"}”.`,
      };
    }
    let body: unknown = text;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      /* keep raw text */
    }
    return { ...base, ok: res.ok, httpStatus: res.status, latencyMs, body, error: res.ok ? null : `HTTP ${res.status} ${res.statusText}`.trim() };
  } catch (err) {
    return {
      ...base,
      ok: false,
      httpStatus: null,
      latencyMs: null,
      body: null,
      error: controller.signal.aborted ? `Timed out after ${TIMEOUT_MS / 1000}s.` : `Backend unreachable — ${getErrorMessage(err, "network error")}`,
    };
  } finally {
    window.clearTimeout(timer);
  }
}

const SERVICE_ICON: Record<string, typeof Database> = {
  svc_db: Database,
  svc_queue: Layers,
  svc_email: Mail,
  svc_sms: MessageSquare,
  svc_whatsapp: MessageCircle,
  svc_storage: HardDrive,
};

export function SystemHealthPage() {
  const toast = useToast();
  const [probes, setProbes] = useState<ProbeResult[]>(() => PROBES.map((p) => initialProbe(p.label, p.path)));
  const services = useAsync(() => adminApi.listServices(), []);
  const [recheckingServices, setRecheckingServices] = useState(false);

  const runProbes = useCallback(async () => {
    setProbes((prev) => prev.map((p) => ({ ...p, running: true })));
    const results = await Promise.all(PROBES.map((p) => runProbe(p.label, p.path)));
    setProbes(results);
  }, []);

  useEffect(() => {
    void runProbes();
  }, [runProbes]);

  async function recheckAll() {
    setRecheckingServices(true);
    try {
      const [, next] = await Promise.all([runProbes(), adminApi.recheckServices()]);
      services.setData(next);
      toast.success("Health checks refreshed.");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRecheckingServices(false);
    }
  }

  const anyRunning = probes.some((p) => p.running) || recheckingServices;

  return (
    <div>
      <PageHeader
        title="System health"
        description="Live backend probes plus the status of platform dependencies."
        actions={
          <Button variant="outline" size="sm" onClick={() => void recheckAll()} disabled={anyRunning}>
            <RefreshCw className={cn(anyRunning && "animate-spin")} /> Re-run checks
          </Button>
        }
      />

      <section className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Server className="size-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold text-ink">Backend API</h2>
          <StatusBadge tone="primary">Live</StatusBadge>
          <span className="text-xs text-ink-soft">
            API base <Mono>{API_BASE_URL}</Mono>
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {probes.map((p, i) => (
            <Panel
              key={p.path}
              title={
                <span className="flex items-center gap-2">
                  {p.label} <Mono>GET {p.path}</Mono>
                </span>
              }
              description={PROBES[i].description}
              actions={
                p.running ? (
                  <Spinner className="text-ink-soft" />
                ) : p.ok ? (
                  <StatusBadge tone="success" dot>
                    Healthy
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="danger" dot>
                    {p.httpStatus === 503 ? "Not ready" : "Failing"}
                  </StatusBadge>
                )
              }
            >
              {p.running && p.checkedAt === null ? (
                <p className="text-sm text-ink-soft">Checking…</p>
              ) : (
                <div className="space-y-3">
                  <dl className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-ink-soft">HTTP status</dt>
                      <dd className={cn("tabular font-semibold", p.ok ? "text-success" : "text-danger")}>{p.httpStatus ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-soft">Latency</dt>
                      <dd className={cn("tabular font-semibold", (p.latencyMs ?? 0) > 1000 ? "text-warning" : "text-ink")}>
                        {p.latencyMs !== null ? `${p.latencyMs} ms` : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-soft">Checked</dt>
                      <dd className="text-ink" title={formatDateTime(p.checkedAt)}>
                        {formatRelative(p.checkedAt)}
                      </dd>
                    </div>
                  </dl>
                  <p className="truncate text-xs text-ink-soft" title={p.url}>
                    {p.url}
                  </p>
                  {p.error && <p className="rounded-[10px] border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">{p.error}</p>}
                  {p.body !== null && <JsonBlock value={p.body} className="max-h-48" />}
                </div>
              )}
            </Panel>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-ink">Platform services</h2>
          <StatusBadge tone="neutral">Mock data</StatusBadge>
        </div>
        <DataState loading={services.loading} error={services.error} onRetry={() => void services.refresh()} empty={services.data?.length === 0}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(services.data ?? []).map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        </DataState>
      </section>
    </div>
  );
}

function ServiceCard({ service: s }: { service: ServiceTile }) {
  const Icon = SERVICE_ICON[s.id] ?? Server;
  return (
    <article
      className={cn(
        "rounded-[var(--radius-card)] border bg-paper-raised p-4 shadow-[var(--shadow-card)]",
        s.status === "down" ? "border-danger/40" : s.status === "degraded" ? "border-warning/40" : "border-line"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
            <Icon className="size-4" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-ink">{s.name}</h3>
            <p className="text-xs text-ink-soft">{s.description}</p>
          </div>
        </div>
        <Status value={s.status} />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-ink-soft">Latency</dt>
          <dd className="tabular font-medium text-ink">{s.latencyMs !== null ? `${s.latencyMs} ms` : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">Uptime 30d</dt>
          <dd className="tabular font-medium text-ink">{s.uptime30d.toFixed(2)}%</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">Checked</dt>
          <dd className="font-medium text-ink">{formatRelative(s.lastCheckAt)}</dd>
        </div>
      </dl>
      <div className="mt-3 border-t border-line pt-3 text-xs">
        <p className="font-medium text-ink-soft">Last incident</p>
        {s.lastIncidentAt ? (
          <p className="mt-0.5 text-ink">
            <span className="text-ink-soft" title={formatDateTime(s.lastIncidentAt)}>
              {formatRelative(s.lastIncidentAt)} ·{" "}
            </span>
            {s.lastIncidentSummary}
          </p>
        ) : (
          <p className="mt-0.5 text-ink-soft">No incidents recorded.</p>
        )}
      </div>
    </article>
  );
}
