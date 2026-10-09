import { useState, type FormEvent, type ReactNode } from "react";
import { Eye } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import { ApiError, adminSupportView, type AdminSupportView } from "@store-builder/api-client";
import { DetailRow } from "@/components/Drawer";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { DomainNotes } from "@/components/supportViewDomainNotes";
import { Status, humanize } from "@/components/StatusBadge";
import { TextField } from "@/components/forms";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime, formatMinorMoney, formatRelative } from "@/lib/format";
import { P } from "@/lib/permissions";

/**
 * The store's own data — team, domains, connections, recent orders, alerts
 * and activity — opened by support only while the merchant has let support
 * in (Settings → Security in their dashboard). Each opening asks for a
 * reason, which the merchant sees in their activity log.
 */
export function SupportViewPanel({ workspaceId }: { workspaceId: string }) {
  const { can } = useAuth();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminSupportView | null>(null);

  if (!can(P.SUPPORT_VIEW)) return null;

  async function open(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setData(await adminSupportView(apiClient, workspaceId, reason.trim()));
    } catch (err) {
      setData(null);
      setError(
        err instanceof ApiError && err.code === "SUPPORT_ACCESS_NOT_GRANTED"
          ? "The merchant has not allowed support into this store, or their permission has ended. Ask them to allow it from Settings → Security."
          : getErrorMessage(err)
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Store data"
      description="Opens the store's team, connections, orders and activity while the merchant allows support in. Each opening is shown to the merchant with your reason."
    >
      <form onSubmit={open} className="flex flex-wrap items-end gap-2">
        <TextField
          label="Reason"
          required
          minLength={3}
          maxLength={300}
          placeholder="e.g. Ticket: courier bookings failing"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="min-w-64 flex-1"
        />
        <Button type="submit" disabled={busy || reason.trim().length < 3}>
          <Eye className="size-4" aria-hidden />
          {busy ? "Opening…" : data ? "Reload" : "Open store data"}
        </Button>
      </form>
      {error && (
        <Alert variant="danger" className="mt-3">
          {error}
        </Alert>
      )}
      {data && <SupportViewBody data={data} />}
    </Panel>
  );
}

function Section({ title, empty, children }: { title: string; empty: boolean; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold tracking-wide text-ink-soft uppercase">{title}</p>
      {empty ? <p className="text-sm text-ink-soft">None.</p> : children}
    </div>
  );
}

function SupportViewBody({ data }: { data: AdminSupportView }) {
  const { store, team, domains, connections, orders, alerts, activity } = data;
  const linked = [
    ...connections.carriers.map((c) => ({ kind: "Courier", code: c.code, status: c.status, note: c.isDefault ? "default" : "", at: c.lastVerifiedAt })),
    ...connections.gateways.map((g) => ({ kind: "Payments", code: g.code, status: g.status, note: g.mode, at: g.lastWebhookAt })),
    ...connections.integrations.map((i) => ({ kind: "Integration", code: i.code, status: i.status, note: i.lastError ?? "", at: i.lastVerifiedAt })),
  ];
  return (
    <div className="mt-4 space-y-5">
      <p className="text-xs text-ink-soft">Support access ends {formatRelative(data.grant.expiresAt)} ({formatDateTime(data.grant.expiresAt)}).</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Store" empty={false}>
          <dl>
            <DetailRow label="Status">
              <Status value={store.status} />
            </DetailRow>
            <DetailRow label="Currency">{store.defaultCurrency}</DetailRow>
            <DetailRow label="Language">{store.defaultLocale}</DetailRow>
            <DetailRow label="Time zone">{store.timezone}</DetailRow>
          </dl>
        </Section>
        <Section title="Domains" empty={domains.length === 0}>
          <dl>
            {domains.map((d) => (
              <DetailRow key={d.hostname} label={d.isPrimary ? "Primary" : "Domain"}>
                <Mono>{d.hostname}</Mono> <Status value={d.status} /> <span className="text-xs text-ink-soft">SSL {d.sslStatus}</span>
                <DomainNotes domain={d} />
              </DetailRow>
            ))}
          </dl>
        </Section>
      </div>

      <Section title="Team" empty={team.length === 0}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Last login</Th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.map((m, i) => (
              <TableRow key={`${m.email}-${i}`}>
                <Td>{m.name || "—"}</Td>
                <Td>{m.email ?? "—"}</Td>
                <Td>{m.role}</Td>
                <Td>
                  <Status value={m.status} />
                </Td>
                <Td>{formatRelative(m.lastLoginAt)}</Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="Connections" empty={linked.length === 0}>
        <Table>
          <TableBody>
            {linked.map((c) => (
              <TableRow key={`${c.kind}-${c.code}`}>
                <Td>{c.kind}</Td>
                <Td>
                  <Mono>{c.code}</Mono>
                </Td>
                <Td>
                  <Status value={c.status} />
                </Td>
                <Td className="text-xs text-ink-soft">{c.note}</Td>
                <Td className="text-xs text-ink-soft">{c.at ? formatRelative(c.at) : "—"}</Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="Recent alerts" empty={alerts.length === 0}>
        <ul className="space-y-1 text-sm">
          {alerts.map((a, i) => (
            <li key={i} className="flex flex-wrap gap-2">
              <span className="text-xs text-ink-soft">{formatDateTime(a.createdAt)}</span>
              <span dir="auto">{a.title}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Latest orders (no customer details)" empty={orders.length === 0}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <Th>Order</Th>
              <Th>Confirmation</Th>
              <Th>Payment</Th>
              <Th>Fulfilment</Th>
              <Th className="text-end">Total</Th>
              <Th>Placed</Th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id}>
                <Td>
                  <Mono>{o.orderNumber}</Mono>
                </Td>
                <Td>{humanize(o.confirmationState)}</Td>
                <Td>
                  {humanize(o.financialState)} <span className="text-xs text-ink-soft">{o.paymentMethod}</span>
                </Td>
                <Td>{humanize(o.fulfillmentState)}</Td>
                <Td className="text-end tabular">{formatMinorMoney(Number(o.totalAmount), o.currency)}</Td>
                <Td>{formatDateTime(o.createdAt)}</Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="Activity" empty={activity.length === 0}>
        <ul className="space-y-1 text-sm">
          {activity.map((a, i) => (
            <li key={i} className="flex flex-wrap gap-2">
              <span className="text-xs text-ink-soft">{formatDateTime(a.createdAt)}</span>
              <Mono>{a.action}</Mono>
              <span className="text-ink-soft">{a.actor ?? "System"}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
