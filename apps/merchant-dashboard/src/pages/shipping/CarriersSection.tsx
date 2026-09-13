import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Banknote, MapPin, PackageCheck, Plug, Truck } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from "@store-builder/ui";
import { mockApi } from "@/mock/api";
import type { Carrier, CarrierAccount, CarrierKey } from "@/mock/types";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField, Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { Toggle } from "@/components/Toggle";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";

const STATUS_TONE: Record<CarrierAccount["status"], "success" | "danger" | "neutral"> = {
  connected: "success",
  error: "danger",
  disconnected: "neutral",
};

const AUTO_CREATE_LABEL: Record<CarrierAccount["autoCreateShipmentOn"], string> = {
  never: "Never (manual)",
  confirmed: "When order is confirmed",
  paid: "When order is paid",
};

function LogoChip({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-[0.6rem] bg-primary-soft font-display text-sm font-semibold text-primary-dark",
        className
      )}
    >
      {text}
    </span>
  );
}

export function CarriersSection() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const data = useAsync(
    () =>
      Promise.all([mockApi.listCarriers(), mockApi.listCarrierAccounts(workspaceId)]).then(([carriers, accounts]) => ({
        carriers,
        accounts,
      })),
    [workspaceId]
  );
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<CarrierAccount | null>(null);

  const carriers = data.data?.carriers ?? [];
  const accounts = data.data?.accounts ?? [];
  const carrierByKey = new Map(carriers.map((c) => [c.key, c]));
  const reload = () => data.refresh({ silent: true });

  async function patch(acc: CarrierAccount, changes: Partial<CarrierAccount>, message?: string) {
    await mockApi.saveCarrierAccount(workspaceId, { ...acc, ...changes });
    if (message) toast.success(message);
    reload();
  }

  async function testConnection(acc: CarrierAccount) {
    await mockApi.saveCarrierAccount(workspaceId, { ...acc, status: "connected" });
    toast.success(`${acc.label}: connection OK.`);
    reload();
  }

  async function confirmDisconnect() {
    if (!disconnecting) return;
    await mockApi.deleteCarrierAccount(workspaceId, disconnecting.id);
    toast.success(`${disconnecting.label} disconnected.`);
    setDisconnecting(null);
    reload();
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-medium text-ink">Connected carriers</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Shipments are created with these accounts. COD collection is settled by the carrier.
            </p>
          </div>
          <Button onClick={() => setConnecting(true)}>
            <Plug /> Connect carrier
          </Button>
        </div>

        <DataState loading={data.loading} error={data.error} onRetry={() => data.refresh()}>
          {accounts.length === 0 ? (
            <EmptyState
              icon={<Truck />}
              title="No carriers connected"
              description="Connect Bosta, Aramex, J&T or another carrier to create shipments straight from your orders."
              action={<Button onClick={() => setConnecting(true)}>Connect carrier</Button>}
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {accounts.map((acc) => {
                const carrier = carrierByKey.get(acc.carrierKey);
                return (
                  <Card key={acc.id} className={cn("p-5", acc.status === "error" && "ring-danger/30")}>
                    <div className="flex items-start gap-3">
                      <LogoChip text={carrier?.logoText ?? "?"} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium text-ink">{acc.label}</p>
                          <StatusBadge value={acc.status} tone={STATUS_TONE[acc.status]} />
                          {acc.isDefault && <StatusBadge value="default" tone="info" />}
                        </div>
                        <p className="text-xs text-ink-soft">
                          {carrier?.name ?? acc.carrierKey} · {acc.shipmentsThisMonth.toLocaleString()} shipments this month
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <Field label="Auto-create shipment">
                        {({ id }) => (
                          <Select
                            id={id}
                            value={acc.autoCreateShipmentOn}
                            onChange={(e) =>
                              patch(acc, { autoCreateShipmentOn: e.target.value as CarrierAccount["autoCreateShipmentOn"] }, "Saved.")
                            }
                          >
                            {(Object.keys(AUTO_CREATE_LABEL) as CarrierAccount["autoCreateShipmentOn"][]).map((k) => (
                              <option key={k} value={k}>
                                {AUTO_CREATE_LABEL[k]}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>
                      <Toggle
                        label="COD collection"
                        description={
                          carrier && !carrier.supportsCod
                            ? "This carrier does not support cash on delivery."
                            : "Carrier collects cash from the customer and settles it to you."
                        }
                        checked={acc.codCollection}
                        disabled={carrier ? !carrier.supportsCod : false}
                        onChange={(v) => patch(acc, { codCollection: v })}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-line pt-3">
                      {!acc.isDefault && (
                        <Button size="sm" variant="ghost" onClick={() => patch(acc, { isDefault: true }, `${acc.label} is now the default carrier.`)}>
                          Set as default
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => testConnection(acc)}>
                        Test connection
                      </Button>
                      <Button size="sm" variant="ghost" className="ml-auto text-danger hover:bg-danger-soft" onClick={() => setDisconnecting(acc)}>
                        Disconnect
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </DataState>
      </section>

      <Card className="p-5">
        <CardHeader className="px-0">
          <CardTitle className="flex items-center gap-2 text-ink">
            <PackageCheck className="size-4 text-primary" /> Bulk create shipments
          </CardTitle>
          <CardDescription className="text-ink-soft">
            Select confirmed orders in Orders, then choose <span className="font-medium text-ink">Create shipments</span>. Each one is
            booked with your default carrier, and tracking numbers are written back to the order and sent to the customer.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div>
            <Button variant="outline" asChild>
              <Link to="/orders">Go to orders</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Modal open={connecting} onClose={() => setConnecting(false)} title="Connect carrier" className="max-w-2xl">
        {connecting && (
          <ConnectCarrierForm
            carriers={carriers}
            hasDefault={accounts.some((a) => a.isDefault)}
            onCancel={() => setConnecting(false)}
            onDone={() => {
              setConnecting(false);
              reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={disconnecting !== null}
        title={`Disconnect "${disconnecting?.label ?? ""}"?`}
        description="New shipments can no longer be created with this account. Existing shipments keep their tracking."
        confirmLabel="Disconnect"
        destructive
        onCancel={() => setDisconnecting(null)}
        onConfirm={confirmDisconnect}
      />
    </div>
  );
}

function Capability({ on, icon, label }: { on: boolean; icon: ReactNode; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px]", on ? "text-success" : "text-ink-soft/50 line-through")} title={label}>
      <span className="[&>svg]:size-3">{icon}</span>
      {label}
    </span>
  );
}

function ConnectCarrierForm({
  carriers,
  hasDefault,
  onCancel,
  onDone,
}: {
  carriers: Carrier[];
  hasDefault: boolean;
  onCancel: () => void;
  onDone: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [selected, setSelected] = useState<CarrierKey | null>(null);
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const carrier = carriers.find((c) => c.key === selected) ?? null;

  function pick(c: Carrier) {
    setSelected(c.key);
    setLabel((prev) => (prev.trim() === "" ? c.name : prev));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!carrier) return;
    setSaving(true);
    try {
      await mockApi.saveCarrierAccount(workspaceId, {
        id: `ca-${Date.now().toString(36)}`,
        workspaceId,
        carrierKey: carrier.key,
        label: label.trim() || carrier.name,
        status: "connected",
        isDefault: !hasDefault,
        credentialsSet: true,
        autoCreateShipmentOn: "never",
        codCollection: carrier.supportsCod,
        shipmentsThisMonth: 0,
        connectedAt: new Date().toISOString(),
      });
      toast.success(`${carrier.name} connected.`);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {carriers.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => pick(c)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-[0.6rem] border p-3 text-left transition-colors",
              selected === c.key ? "border-primary bg-primary-soft" : "border-line hover:bg-paper-raised"
            )}
          >
            <div className="flex items-center gap-2">
              <LogoChip text={c.logoText} className="size-8 text-xs" />
              <span className="text-sm font-medium text-ink">{c.name}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Capability on={c.supportsCod} icon={<Banknote />} label="COD" />
              <Capability on={c.supportsTracking} icon={<MapPin />} label="Tracking" />
              <Capability on={c.supportsPickup} icon={<Truck />} label="Pickup" />
            </div>
          </button>
        ))}
      </div>

      {carrier && (
        <div className="space-y-4 rounded-[0.6rem] border border-line p-4">
          <p className="text-sm font-medium text-ink">{carrier.name} credentials</p>
          <TextField label="Label" required value={label} onChange={(e) => setLabel(e.target.value)} placeholder={carrier.name} />
          {carrier.key === "custom" ? (
            <p className="text-xs text-ink-soft">Manual carriers have no API — you will enter tracking numbers yourself.</p>
          ) : (
            <>
              <TextField
                label="API key"
                required
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <TextField
                label="API secret"
                type="password"
                autoComplete="off"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                hint="Optional — only some carriers issue a secret."
              />
            </>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !carrier || (carrier.key !== "custom" && apiKey.trim() === "")}>
          {saving ? "Connecting…" : "Connect"}
        </Button>
      </div>
    </form>
  );
}
