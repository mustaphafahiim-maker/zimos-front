import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  adminCatalogue,
  adminUpdateCatalogueApp,
  type AdminCatalogueApp,
  type AdminCatalogueAppUpdate,
} from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { SelectField, TextField } from "@/components/forms";
import { Mono, Panel } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { apiClient } from "@/lib/apiClient";
import { formatNumber } from "@/lib/format";

/**
 * The app catalogue merchants see under Apps. Names and descriptions come
 * with the code; what is decided here is whether an app is offered, where it
 * sits in the list, and its price. An app without a price is shown as free.
 */

function priceLabel(app: AdminCatalogueApp): string {
  if (app.priceAmount === null) return "Free";
  const amount = (Number(app.priceAmount) / 100).toLocaleString();
  return `${amount} ${app.currency ?? ""}${app.billing === "monthly" ? " / month" : " once"}`.trim();
}

export function AppsPage() {
  const toast = useToast();
  const { data, loading, error, refresh, setData } = useAsync(() => adminCatalogue(apiClient), []);
  const [editing, setEditing] = useState<AdminCatalogueApp | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const replace = (app: AdminCatalogueApp) =>
    setData((prev) => {
      if (!prev) throw new Error("Catalogue not loaded.");
      return { ...prev, apps: prev.apps.map((a) => (a.key === app.key ? app : a)).sort((a, b) => a.displayOrder - b.displayOrder) };
    });

  async function save(app: AdminCatalogueApp, changes: AdminCatalogueAppUpdate) {
    setBusy(app.key);
    try {
      replace(await adminUpdateCatalogueApp(apiClient, app.key, changes));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const category = (key: string) => data?.categories.find((c) => c.key === key)?.name.en ?? key;

  return (
    <div>
      <PageHeader title="Apps" description="What merchants can install from their Apps page." />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        {data && (
          <>
            <p className="mb-4 text-sm text-ink-soft">
              {data.apps.filter((a) => a.isActive).length} of {data.apps.length} offered ·{" "}
              {formatNumber(data.externalInstalls)} outside service(s) connected through an install link
            </p>
            <Panel flush>
              <ul className="divide-y divide-line">
                {data.apps.map((app) => (
                  <li key={app.key} className="flex flex-wrap items-center gap-4 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                        {app.name.en}
                        <Mono>{app.key}</Mono>
                        {app.isTest && <StatusBadge tone="warning">Test</StatusBadge>}
                        {app.availability === "coming_soon" && <StatusBadge tone="neutral">Coming soon</StatusBadge>}
                        {app.availability === "removed" && <StatusBadge tone="danger">No longer in the code</StatusBadge>}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {category(app.category)} · {app.kind} · {formatNumber(app.installs)} install(s) · {priceLabel(app)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setEditing(app)}>
                      Price and order
                    </Button>
                    <Toggle
                      label={`Offer ${app.name.en}`}
                      hideLabel
                      checked={app.isActive}
                      disabled={busy === app.key}
                      onChange={(next) => save(app, { isActive: next })}
                    />
                  </li>
                ))}
              </ul>
            </Panel>
          </>
        )}
      </DataState>

      {editing && (
        <EditAppModal
          app={editing}
          onClose={() => setEditing(null)}
          onSaved={(app) => {
            replace(app);
            toast.success(`${app.name.en} updated.`);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EditAppModal({ app, onClose, onSaved }: { app: AdminCatalogueApp; onClose: () => void; onSaved: (app: AdminCatalogueApp) => void }) {
  const [price, setPrice] = useState(app.priceAmount === null ? "" : String(Number(app.priceAmount) / 100));
  const [currency, setCurrency] = useState(app.currency ?? "EGP");
  const [billing, setBilling] = useState<"once" | "monthly">(app.billing ?? "monthly");
  const [order, setOrder] = useState(String(app.displayOrder));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const amount = price.trim() === "" ? null : Math.round(Number(price) * 100);
      if (amount !== null && (!Number.isFinite(amount) || amount < 0)) throw new Error("Enter a price of zero or more, or leave it empty for free.");
      const changes: AdminCatalogueAppUpdate = {
        displayOrder: Math.max(0, Math.round(Number(order) || 0)),
        priceAmount: amount,
        ...(amount === null ? {} : { currency: currency.trim().toUpperCase(), billing }),
      };
      onSaved(await adminUpdateCatalogueApp(apiClient, app.key, changes));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={app.name.en} description="Leave the price empty to offer the app for free.">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-3">
          <TextField label="Price" inputMode="decimal" placeholder="Free" value={price} onChange={(e) => setPrice(e.target.value)} />
          <TextField label="Currency" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={price.trim() === ""} />
          <SelectField label="Charged" value={billing} onChange={(e) => setBilling(e.target.value as "once" | "monthly")} disabled={price.trim() === ""}>
            <option value="monthly">Every month</option>
            <option value="once">Once</option>
          </SelectField>
        </div>
        <TextField label="Position in the list" hint="Lower comes first." inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
