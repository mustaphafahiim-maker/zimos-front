import { useState, type ReactNode } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type {
  AdminCarrier,
  AdminCredentialsKeyState,
  AdminPaymentGateway,
  AdminProviderCheck,
} from "@store-builder/api-client";
import { ComingLater } from "@/components/ComingLater";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { StatusBadge, type Tone } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import * as adminApi from "@/lib/adminApi";
import { formatRelative } from "@/lib/format";

export type ProviderKind = "carrier" | "payment" | "whatsapp";

export function ProvidersPage({ kind }: { kind: ProviderKind }) {
  if (kind === "carrier") return <CarriersView />;
  if (kind === "payment") return <GatewaysView />;
  return (
    <ComingLater
      title="WhatsApp numbers"
      description="Sending numbers used for order confirmation."
      summary="Managing WhatsApp sender numbers from this console is planned for a later release."
    />
  );
}

// ---------------------------------------------------------------- shared bits

const KEY_TONE: Record<AdminCredentialsKeyState, Tone> = { present: "success", missing: "danger", invalid: "danger" };
const KEY_LABEL: Record<AdminCredentialsKeyState, string> = {
  present: "Present",
  missing: "Not set",
  invalid: "Set, but invalid",
};

const CHECK_TONE: Record<AdminProviderCheck["status"], Tone> = {
  operational: "success",
  degraded: "warning",
  down: "danger",
  not_checkable: "neutral",
};

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-ink-soft">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <StatusBadge key={item} tone="neutral">
          {item}
        </StatusBadge>
      ))}
    </div>
  );
}

function Connections({ c, extra }: { c: { workspaces: number; active: number; invalid: number }; extra?: ReactNode }) {
  return (
    <div className="text-sm">
      <span className="tabular font-semibold">{c.workspaces}</span>{" "}
      <span className="text-ink-soft">store{c.workspaces === 1 ? "" : "s"}</span>
      <span className="block text-xs text-ink-soft">
        <span className="tabular">{c.active}</span> active ·{" "}
        <span className={c.invalid > 0 ? "tabular font-medium text-danger" : "tabular"}>{c.invalid}</span> invalid
        {extra}
      </span>
    </div>
  );
}

/** The health-check cell: the last reading taken on this page, and the button. */
function HealthCell({
  checkable,
  target,
  check,
  busy,
  onCheck,
}: {
  checkable: boolean;
  target: string | null;
  check: AdminProviderCheck | undefined;
  busy: boolean;
  onCheck: () => void;
}) {
  if (!checkable) {
    return <span className="text-xs text-ink-soft">Not checkable without a merchant’s credentials.</span>;
  }
  return (
    <div className="flex flex-col items-start gap-1.5">
      {check ? (
        <>
          <StatusBadge tone={CHECK_TONE[check.status]} dot>
            {check.status === "not_checkable" ? "Not checkable" : check.status.charAt(0).toUpperCase() + check.status.slice(1)}
            {check.latencyMs !== null && check.status !== "down" ? ` · ${check.latencyMs} ms` : ""}
          </StatusBadge>
          <span className="max-w-64 text-xs text-ink-soft" title={check.detail}>
            {check.detail} <span className="whitespace-nowrap">({formatRelative(check.checkedAt)})</span>
          </span>
        </>
      ) : (
        <span className="text-xs text-ink-soft">
          Reaches <Mono>{target}</Mono>
        </span>
      )}
      <Button size="xs" variant="outline" disabled={busy} onClick={onCheck}>
        <Activity /> {busy ? "Checking…" : "Check"}
      </Button>
    </div>
  );
}

/** Per-row health checks, kept for as long as the page is open. */
function useChecks(run: (code: string) => Promise<AdminProviderCheck>) {
  const toast = useToast();
  const [checks, setChecks] = useState<Record<string, AdminProviderCheck>>({});
  const [busy, setBusy] = useState<Set<string>>(new Set());

  async function check(code: string) {
    setBusy((b) => new Set(b).add(code));
    try {
      const result = await run(code);
      setChecks((c) => ({ ...c, [code]: result }));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy((b) => {
        const next = new Set(b);
        next.delete(code);
        return next;
      });
    }
  }

  return { checks, busy, check };
}

const READ_ONLY_NOTE =
  "Read-only. Availability comes from the server's environment variables and can only be changed there, followed by a redeploy.";

// -------------------------------------------------------------------- carriers

function carrierCapabilities(c: AdminCarrier): string[] {
  const caps = c.capabilities;
  if (!caps) return [];
  const out = [caps.cancel === "api" ? "Cancel via API" : "Manual cancel"];
  if (caps.label) out.push("Carrier label");
  if (caps.webhook !== "none") out.push(caps.webhook === "per_shipment" ? "Webhook per shipment" : "Account webhook");
  if (caps.polling) out.push(caps.bulkStatus ? "Status polling (bulk)" : "Status polling");
  if (caps.sandbox) out.push("Sandbox for test stores");
  out.push(`Address: ${caps.addressLevels.join(" › ")}`);
  return out;
}

const ROLLOUT_TONE: Record<AdminCarrier["rollout"], Tone> = { enabled: "success", beta: "info", off: "neutral" };
const ROLLOUT_LABEL: Record<AdminCarrier["rollout"], string> = { enabled: "Enabled", beta: "Beta", off: "Off" };

function CarriersView() {
  const { data, loading, error, refresh } = useAsync(() => adminApi.listCarriers(), []);
  const { checks, busy, check } = useChecks(adminApi.checkCarrier);
  const env = data?.environment;

  return (
    <div>
      <PageHeader
        title="Carriers"
        description="Courier integrations registered in this backend, and how many stores use them."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {env && (
          <Panel title="Environment" description={READ_ONLY_NOTE} className="mb-4">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <EnvItem label="CARRIERS_ENABLED">
                <Chips items={env.enabled} />
              </EnvItem>
              <EnvItem label="CARRIERS_BETA">
                <Chips items={env.beta} />
              </EnvItem>
              <EnvItem label="CARRIERS_BETA_WORKSPACES">
                <Chips items={env.betaWorkspaces} />
              </EnvItem>
              <EnvItem label="CARRIER_CREDENTIALS_KEY">
                <StatusBadge tone={KEY_TONE[env.credentialsKey]} dot>
                  {KEY_LABEL[env.credentialsKey]}
                </StatusBadge>
              </EnvItem>
            </dl>
            {env.warnings.length > 0 && (
              <Alert variant="danger" className="mt-3">
                <ul className="list-disc ps-4">
                  {env.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Alert>
            )}
          </Panel>
        )}
        {!data || data.carriers.length === 0 ? (
          <EmptyBlock message="No courier adapter is registered in this backend." />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>Carrier</Th>
                  <Th>Rollout</Th>
                  <Th>Capabilities</Th>
                  <Th>Connections</Th>
                  <Th>Health</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.carriers.map((c) => (
                  <TableRow key={c.code} className="align-top">
                    <Td>
                      <span className="font-medium">{c.name}</span>
                      <Mono className="mt-1 block w-fit">{c.code}</Mono>
                      {!c.registered && (
                        <StatusBadge tone="warning" className="mt-1">
                          Not registered
                        </StatusBadge>
                      )}
                    </Td>
                    <Td className="max-w-60">
                      <StatusBadge tone={ROLLOUT_TONE[c.rollout]} dot>
                        {ROLLOUT_LABEL[c.rollout]}
                      </StatusBadge>
                      <p className="mt-1 text-xs text-ink-soft">{c.rolloutDetail}</p>
                    </Td>
                    <Td className="max-w-72">
                      <Chips items={carrierCapabilities(c)} />
                    </Td>
                    <Td>
                      <Connections c={c.connections} />
                    </Td>
                    <Td>
                      <HealthCell
                        checkable={c.healthCheck.checkable}
                        target={c.healthCheck.target}
                        check={checks[c.code]}
                        busy={busy.has(c.code)}
                        onCheck={() => void check(c.code)}
                      />
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </DataState>
    </div>
  );
}

function EnvItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="font-mono text-[11px] tracking-wide text-ink-soft">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

// -------------------------------------------------------------------- gateways

const AVAILABILITY_TONE: Record<AdminPaymentGateway["availability"], Tone> = {
  enabled: "success",
  connect_only: "warning",
  off: "neutral",
};
const AVAILABILITY_LABEL: Record<AdminPaymentGateway["availability"], string> = {
  enabled: "Enabled",
  connect_only: "Connect only",
  off: "Off",
};

function gatewayCapabilities(g: AdminPaymentGateway): string[] {
  const caps = g.capabilities;
  if (!caps) return [];
  const out = [...caps.methods.map((m) => m.charAt(0).toUpperCase() + m.slice(1)), ...caps.currencies];
  if (caps.refunds) out.push("Refunds");
  if (caps.statusInquiry) out.push("Status inquiry");
  if (caps.webhook) out.push(caps.webhook.automatic ? "Webhook set automatically" : "Webhook pasted by merchant");
  return out;
}

function GatewaysView() {
  const { data, loading, error, refresh } = useAsync(() => adminApi.listPaymentGateways(), []);
  const { checks, busy, check } = useChecks(adminApi.checkPaymentGateway);
  const env = data?.environment;

  return (
    <div>
      <PageHeader
        title="Payment gateways"
        description="Online payment gateways merchants connect with their own accounts."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      <DataState loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {env && (
          <Panel title="Environment" description={READ_ONLY_NOTE} className="mb-4">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <EnvItem label="PAYMENTS_ONLINE_ENABLED">
                <StatusBadge tone={env.onlineEnabled ? "success" : "neutral"} dot>
                  {env.onlineEnabled ? "On" : "Off"}
                </StatusBadge>
              </EnvItem>
              <EnvItem label="GATEWAY_CREDENTIALS_KEY">
                <StatusBadge tone={KEY_TONE[env.credentialsKey]} dot>
                  {KEY_LABEL[env.credentialsKey]}
                </StatusBadge>
              </EnvItem>
            </dl>
            <p className="mt-3 text-xs text-ink-soft">
              There is no per-gateway switch: every registered gateway is offered alike, so the availability below is the
              same for all of them.
            </p>
          </Panel>
        )}
        {!data || data.gateways.length === 0 ? (
          <EmptyBlock message="No payment gateway is registered in this backend." />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>Gateway</Th>
                  <Th>Availability</Th>
                  <Th>Capabilities</Th>
                  <Th>Connections</Th>
                  <Th>Health</Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.gateways.map((g) => (
                  <TableRow key={g.code} className="align-top">
                    <Td>
                      <span className="font-medium">{g.name}</span>
                      <Mono className="mt-1 block w-fit">{g.code}</Mono>
                      {!g.registered && (
                        <StatusBadge tone="warning" className="mt-1">
                          Not registered
                        </StatusBadge>
                      )}
                    </Td>
                    <Td className="max-w-60">
                      <StatusBadge tone={AVAILABILITY_TONE[g.availability]} dot>
                        {AVAILABILITY_LABEL[g.availability]}
                      </StatusBadge>
                      <p className="mt-1 text-xs text-ink-soft">{g.availabilityDetail}</p>
                    </Td>
                    <Td className="max-w-72">
                      <Chips items={gatewayCapabilities(g)} />
                    </Td>
                    <Td>
                      <Connections
                        c={g.connections}
                        extra={
                          <>
                            <br />
                            <span className="tabular">{g.connections.live}</span> live ·{" "}
                            <span className="tabular">{g.connections.test}</span> test
                          </>
                        }
                      />
                    </Td>
                    <Td>
                      <HealthCell
                        checkable={g.healthCheck.checkable}
                        target={g.healthCheck.target}
                        check={checks[g.code]}
                        busy={busy.has(g.code)}
                        onCheck={() => void check(g.code)}
                      />
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
      </DataState>
    </div>
  );
}
