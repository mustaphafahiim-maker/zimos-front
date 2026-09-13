import { useMemo, useState, type FormEvent } from "react";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Label, cn } from "@store-builder/ui";
import { Activity, Check, Copy, Pencil, Radio, Send, ShieldCheck, Trash2 } from "lucide-react";
import type { PixelPlatform, TrackingPixel } from "@/mock/types";
import { mockApi } from "@/mock/api";
import { nowIso, uid } from "@/mock/store";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { Toggle } from "@/components/Toggle";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { HBarList } from "@/components/charts";
import { useToast } from "@/components/Toast";

type PixelEvent = TrackingPixel["events"][number];

const PLATFORM: Record<PixelPlatform, { name: string; initials: string; chip: string; supportsCapi: boolean; idHint: string }> = {
  facebook: { name: "Facebook / Meta", initials: "f", chip: "bg-[#1877F2] text-white", supportsCapi: true, idHint: "15–16 digit Pixel ID from Events Manager" },
  tiktok: { name: "TikTok", initials: "TT", chip: "bg-black text-white", supportsCapi: true, idHint: "Pixel code, e.g. CJ8K2L3M…" },
  snapchat: { name: "Snapchat", initials: "S", chip: "bg-[#FFFC00] text-black", supportsCapi: true, idHint: "Pixel ID from Snap Ads Manager" },
  google_ads: { name: "Google Ads", initials: "G", chip: "bg-gradient-to-br from-[#EA4335] to-[#34A853] text-white", supportsCapi: false, idHint: "Conversion ID, e.g. AW-123456789" },
  ga4: { name: "Google Analytics 4", initials: "GA", chip: "bg-gradient-to-br from-[#EA4335] to-[#34A853] text-white", supportsCapi: false, idHint: "Measurement ID, e.g. G-XXXXXXXXXX" },
};

const EVENTS: Array<{ key: PixelEvent; label: string }> = [
  { key: "page_view", label: "PageView" },
  { key: "view_content", label: "ViewContent" },
  { key: "add_to_cart", label: "AddToCart" },
  { key: "initiate_checkout", label: "InitiateCheckout" },
  { key: "purchase", label: "Purchase" },
  { key: "lead", label: "Lead" },
];

const EVENT_LABEL: Record<PixelEvent, string> = Object.fromEntries(EVENTS.map((e) => [e.key, e.label])) as Record<PixelEvent, string>;

function maskPixelId(id: string): string {
  if (id.length <= 6) return id;
  return `${id.slice(0, 3)}${"•".repeat(Math.min(id.length - 6, 8))}${id.slice(-3)}`;
}

function PlatformChip({ platform, className }: { platform: PixelPlatform; className?: string }) {
  const p = PLATFORM[platform];
  return (
    <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold", p.chip, className)} title={p.name}>
      {p.initials}
    </span>
  );
}

export function MarketingPage() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const list = useAsync(() => mockApi.listPixels(workspaceId), [workspaceId]);
  const analytics = useAsync(() => mockApi.getAnalytics(workspaceId, "30d"), [workspaceId]);

  const [formTarget, setFormTarget] = useState<TrackingPixel | "new" | null>(null);
  const [deleting, setDeleting] = useState<TrackingPixel | null>(null);
  const [copied, setCopied] = useState(false);

  const pixels = list.data ?? [];
  const reload = () => list.refresh({ silent: true });

  // Fabricated from pixel config: active pixels × events × a per-event daily volume.
  const kpis = useMemo(() => {
    const active = pixels.filter((p) => p.status === "active");
    const perEvent: Record<PixelEvent, number> = { page_view: 3120, view_content: 1840, add_to_cart: 412, initiate_checkout: 268, purchase: 94, lead: 31 };
    const sent = active.reduce((a, p) => a + p.events.reduce((b, e) => b + perEvent[e], 0), 0);
    const purchases = active.filter((p) => p.events.includes("purchase")).length * perEvent.purchase;
    const capiPixels = active.filter((p) => p.capiEnabled && p.capiTokenSet);
    const quality = capiPixels.length === 0 ? null : Math.min(9.4, 6.2 + capiPixels.length * 1.1);
    return { sent, purchases, quality, capiCount: capiPixels.length };
  }, [pixels]);

  async function toggleStatus(px: TrackingPixel, next: boolean) {
    const status: TrackingPixel["status"] = next ? "active" : "disabled";
    list.setData((prev) => (prev ?? []).map((p) => (p.id === px.id ? { ...p, status } : p)));
    try {
      await mockApi.savePixel(workspaceId, { ...px, status });
      toast.success(next ? "Pixel enabled." : "Pixel disabled.");
    } catch (err) {
      toast.error(getErrorMessage(err));
      reload();
    }
  }

  async function sendTest(px: TrackingPixel) {
    try {
      await mockApi.savePixel(workspaceId, { ...px, lastEventAt: nowIso() });
      toast.success("Test purchase event sent.");
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    await mockApi.deletePixel(workspaceId, deleting.id);
    toast.success("Pixel removed.");
    setDeleting(null);
    reload();
  }

  const snippet = `<script src="https://cdn.zimos.app/px.js" data-store="${workspaceId}"></script>`;

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — select the snippet and copy it manually.");
    }
  }

  const sources = analytics.data?.bySource ?? [];

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Marketing & pixels"
        description="Track ad performance across Facebook, TikTok, Snap and Google, with server-side events that survive browser blocking."
        actions={<Button onClick={() => setFormTarget("new")}>Add pixel</Button>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <KpiCard label="Events sent today" value={kpis.sent.toLocaleString()} hint="Browser + server-side" icon={<Activity />} />
        <KpiCard label="Purchase events" value={kpis.purchases.toLocaleString()} hint="Today, across active pixels" icon={<Send />} />
        <KpiCard
          label="CAPI match quality"
          value={kpis.quality === null ? "—" : `${kpis.quality.toFixed(1)} / 10`}
          hint={kpis.capiCount === 0 ? "Enable Conversions API to improve attribution" : `${kpis.capiCount} pixel${kpis.capiCount > 1 ? "s" : ""} sending server events`}
          icon={<ShieldCheck />}
        />
      </div>

      <DataState loading={list.loading} error={list.error} empty={pixels.length === 0} emptyMessage="No pixels yet. Add your Facebook or TikTok pixel to start tracking." onRetry={() => list.refresh()}>
        <div className="mb-6 overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-medium">Pixel</th>
                <th className="px-4 py-3 font-medium">Pixel ID</th>
                <th className="px-4 py-3 font-medium">Events</th>
                <th className="px-4 py-3 font-medium">Conversions API</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last event</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {pixels.map((px) => (
                <tr key={px.id} className="border-b border-line last:border-0 hover:bg-paper-raised">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <PlatformChip platform={px.platform} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{px.label}</p>
                        <p className="text-xs text-ink-soft">{PLATFORM[px.platform].name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-soft">{maskPixelId(px.pixelId)}</td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-[240px] flex-wrap gap-1">
                      {px.events.map((e) => (
                        <span key={e} className="rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] text-ink-soft">
                          {EVENT_LABEL[e]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {!PLATFORM[px.platform].supportsCapi ? (
                      <span className="text-xs text-ink-soft">n/a</span>
                    ) : px.capiEnabled ? (
                      <div className="flex flex-col gap-0.5 text-xs">
                        <span className="inline-flex items-center gap-1 font-medium text-success">
                          <Radio className="size-3" /> Server-side on
                        </span>
                        <span className={cn(px.capiTokenSet ? "text-ink-soft" : "font-medium text-danger")}>{px.capiTokenSet ? "Token set" : "Token missing"}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-soft">Browser only</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Toggle checked={px.status === "active"} onChange={(next) => toggleStatus(px, next)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-soft">{formatDateTime(px.lastEventAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => sendTest(px)} disabled={px.status !== "active"}>
                      Test event
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => setFormTarget(px)}>
                      <Pencil />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label="Delete" className="text-danger hover:bg-danger-soft" onClick={() => setDeleting(px)}>
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>UTM & attribution</CardTitle>
            <CardDescription>Orders by traffic source, last 30 days. Sources come from utm_source on the landing visit.</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.loading ? (
              <p className="text-sm text-ink-soft">Loading…</p>
            ) : analytics.error ? (
              <Alert variant="danger">{getErrorMessage(analytics.error)}</Alert>
            ) : (
              <>
                <HBarList rows={sources.map((s) => ({ label: s.source, value: s.revenueAmount, caption: formatMoney(s.revenueAmount) }))} />
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-ink-soft">
                        <th className="py-1 font-medium">Source</th>
                        <th className="py-1 text-right font-medium">Orders</th>
                        <th className="py-1 text-right font-medium">Revenue</th>
                        <th className="py-1 text-right font-medium">AOV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sources.map((s) => (
                        <tr key={s.source} className="border-t border-line">
                          <td className="py-1.5 text-ink">{s.source}</td>
                          <td className="py-1.5 text-right tabular-nums text-ink-soft">{s.orders.toLocaleString()}</td>
                          <td className="py-1.5 text-right tabular-nums text-ink-soft">{formatMoney(s.revenueAmount)}</td>
                          <td className="py-1.5 text-right tabular-nums text-ink-soft">{formatMoney(s.orders > 0 ? Math.round(s.revenueAmount / s.orders) : 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tracking script</CardTitle>
            <CardDescription>Already installed on Zimos-hosted stores and funnels. Paste this on any external landing page to fire the same pixels.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative rounded-[var(--radius-card)] border border-line bg-paper p-3">
              <pre className="overflow-x-auto whitespace-pre-wrap break-all pr-20 font-mono text-xs text-ink">{snippet}</pre>
              <Button size="sm" variant="outline" className="absolute right-2 top-2" onClick={copySnippet}>
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <ul className="space-y-1 text-xs text-ink-soft">
              <li>• Fires PageView on load and ViewContent / AddToCart from the product buttons.</li>
              <li>• Purchase events are deduplicated between browser and server using the order number.</li>
              <li>• UTM parameters are stored for 30 days and attached to the order.</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Modal open={formTarget !== null} onClose={() => setFormTarget(null)} title={formTarget === "new" ? "Add pixel" : "Edit pixel"}>
        {formTarget !== null && (
          <PixelForm
            key={formTarget === "new" ? "new" : formTarget.id}
            pixel={formTarget === "new" ? undefined : formTarget}
            onCancel={() => setFormTarget(null)}
            onDone={() => {
              setFormTarget(null);
              reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Remove "${deleting.label}"?` : "Remove pixel?"}
        description="Events stop firing immediately. Your ad account keeps its historical data."
        confirmLabel="Remove pixel"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function PixelForm({ pixel, onDone, onCancel }: { pixel?: TrackingPixel; onDone: () => void; onCancel: () => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const isEdit = Boolean(pixel);

  const [platform, setPlatform] = useState<PixelPlatform>(pixel?.platform ?? "facebook");
  const [label, setLabel] = useState(pixel?.label ?? "");
  const [pixelId, setPixelId] = useState(pixel?.pixelId ?? "");
  const [capiEnabled, setCapiEnabled] = useState(pixel?.capiEnabled ?? false);
  const [token, setToken] = useState("");
  const [events, setEvents] = useState<PixelEvent[]>(pixel?.events ?? ["page_view", "view_content", "add_to_cart", "initiate_checkout", "purchase"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const supportsCapi = PLATFORM[platform].supportsCapi;

  function toggleEvent(e: PixelEvent) {
    setEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const errs: Record<string, string> = {};
    if (!label.trim()) errs.label = "Give the pixel a label.";
    if (!pixelId.trim()) errs.pixelId = "Enter the pixel ID from your ad platform.";
    if (events.length === 0) errs.events = "Select at least one event.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const next: TrackingPixel = {
      id: pixel?.id ?? uid(),
      workspaceId,
      platform,
      label: label.trim(),
      pixelId: pixelId.trim(),
      capiEnabled: supportsCapi && capiEnabled,
      capiTokenSet: supportsCapi && capiEnabled ? Boolean(token.trim()) || (pixel?.capiTokenSet ?? false) : false,
      events,
      status: pixel?.status ?? "active",
      lastEventAt: pixel?.lastEventAt ?? null,
      createdAt: pixel?.createdAt ?? nowIso(),
    };
    setSaving(true);
    try {
      await mockApi.savePixel(workspaceId, next);
      toast.success(isEdit ? "Pixel saved." : "Pixel added.");
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert variant="danger">{error}</Alert>}

      <Field label="Platform">
        {({ id }) => (
          <div className="flex items-center gap-3">
            <PlatformChip platform={platform} />
            <Select id={id} value={platform} onChange={(e) => setPlatform(e.target.value as PixelPlatform)} disabled={isEdit}>
              {(Object.keys(PLATFORM) as PixelPlatform[]).map((p) => (
                <option key={p} value={p}>
                  {PLATFORM[p].name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </Field>

      <TextField label="Label" required value={label} onChange={(e) => setLabel(e.target.value)} error={fieldErrors.label} placeholder="Main FB Pixel" />
      <TextField label="Pixel ID" required value={pixelId} onChange={(e) => setPixelId(e.target.value)} error={fieldErrors.pixelId} hint={PLATFORM[platform].idHint} className="font-mono" />

      {supportsCapi && (
        <div className="space-y-3 rounded-[var(--radius-card)] border border-line p-3">
          <Toggle
            checked={capiEnabled}
            onChange={setCapiEnabled}
            label="Conversions API (server-side)"
            description="Send events from our servers too — more accurate attribution when browsers block the pixel."
          />
          {capiEnabled && (
            <TextField
              label="Access token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={pixel?.capiTokenSet ? "•••••••• (leave blank to keep the current token)" : "Paste the system user token"}
              hint="Stored encrypted. Generate it in Events Manager → Settings → Conversions API."
            />
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Events to send</Label>
        <div className="grid grid-cols-2 gap-1 rounded-[var(--radius-card)] border border-line p-2 sm:grid-cols-3">
          {EVENTS.map((e) => (
            <label key={e.key} className="flex items-center gap-2 rounded px-1 py-1 text-sm text-ink hover:bg-paper-raised">
              <input type="checkbox" checked={events.includes(e.key)} onChange={() => toggleEvent(e.key)} />
              {e.label}
            </label>
          ))}
        </div>
        {fieldErrors.events && <p className="text-xs font-medium text-danger">{fieldErrors.events}</p>}
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save pixel" : "Add pixel"}
        </Button>
      </div>
    </form>
  );
}
