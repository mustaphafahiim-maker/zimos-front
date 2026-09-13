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
import { fmt, useCommon, useLocale, useT } from "@/i18n/LocaleContext";
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
import {
  EVENT_DESCRIPTION,
  EVENT_KEYS,
  EVENT_LABEL,
  FORM_STRINGS,
  PLATFORM_META,
  PLATFORM_TEXT,
  STRINGS,
  type PixelEvent,
} from "./MarketingPage.strings";

function maskPixelId(id: string): string {
  if (id.length <= 6) return id;
  return `${id.slice(0, 3)}${"•".repeat(Math.min(id.length - 6, 8))}${id.slice(-3)}`;
}

function PlatformChip({ platform, className }: { platform: PixelPlatform; className?: string }) {
  const { locale } = useLocale();
  const meta = PLATFORM_META[platform];
  return (
    <span
      dir="ltr"
      className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold", meta.chip, className)}
      title={PLATFORM_TEXT[locale][platform].name}
    >
      {meta.initials}
    </span>
  );
}

export function MarketingPage() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale, intlLocale } = useLocale();
  const platformText = PLATFORM_TEXT[locale];
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
      toast.success(next ? t.toastEnabled : t.toastDisabled);
    } catch (err) {
      toast.error(getErrorMessage(err));
      reload();
    }
  }

  async function sendTest(px: TrackingPixel) {
    try {
      await mockApi.savePixel(workspaceId, { ...px, lastEventAt: nowIso() });
      toast.success(t.toastTestSent);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    await mockApi.deletePixel(workspaceId, deleting.id);
    toast.success(t.toastRemoved);
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
      toast.error(t.toastCopyFailed);
    }
  }

  const sources = analytics.data?.bySource ?? [];

  const qualityHint =
    kpis.capiCount === 0
      ? t.kpiQualityHintNone
      : kpis.capiCount === 1
        ? t.kpiQualityHintOne
        : fmt(t.kpiQualityHintMany, { n: kpis.capiCount });

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={<Button onClick={() => setFormTarget("new")}>{t.addPixel}</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard
          label={t.kpiEventsSent}
          value={<bdi dir="ltr">{kpis.sent.toLocaleString(intlLocale)}</bdi>}
          hint={t.kpiEventsSentHint}
          icon={<Activity />}
        />
        <KpiCard
          label={t.kpiPurchases}
          value={<bdi dir="ltr">{kpis.purchases.toLocaleString(intlLocale)}</bdi>}
          hint={t.kpiPurchasesHint}
          icon={<Send />}
        />
        <KpiCard
          className="col-span-2 lg:col-span-1"
          label={t.kpiQuality}
          value={
            <bdi dir="ltr">
              {kpis.quality === null ? "—" : fmt(t.kpiQualityValue, { n: kpis.quality.toFixed(1) })}
            </bdi>
          }
          hint={qualityHint}
          icon={<ShieldCheck />}
        />
      </div>

      <DataState loading={list.loading} error={list.error} empty={pixels.length === 0} emptyMessage={t.empty} onRetry={() => list.refresh()}>
        <div className="mb-6 overflow-x-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-start text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 text-start font-medium">{t.colPixel}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colPixelId}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colEvents}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colCapi}</th>
                <th className="px-4 py-3 text-start font-medium">{c.status}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colLastEvent}</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">{c.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pixels.map((px) => (
                <tr key={px.id} className="border-b border-line last:border-0 hover:bg-paper">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <PlatformChip platform={px.platform} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{px.label}</p>
                        <p className="text-xs text-ink-soft">{platformText[px.platform].name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                    <bdi dir="ltr">{maskPixelId(px.pixelId)}</bdi>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-[240px] flex-wrap gap-1">
                      {px.events.map((e) => (
                        <span
                          key={e}
                          dir="ltr"
                          title={EVENT_DESCRIPTION[locale][e]}
                          className="rounded-full border border-line bg-primary-soft px-2 py-0.5 text-[11px] text-primary"
                        >
                          {EVENT_LABEL[e]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {!PLATFORM_META[px.platform].supportsCapi ? (
                      <span className="text-xs text-ink-soft">{t.notApplicable}</span>
                    ) : px.capiEnabled ? (
                      <div className="flex flex-col gap-0.5 text-xs">
                        <span className="inline-flex items-center gap-1 font-medium text-success">
                          <Radio className="size-3" /> {t.serverSideOn}
                        </span>
                        <span className={cn(px.capiTokenSet ? "text-ink-soft" : "font-medium text-danger")}>
                          {px.capiTokenSet ? t.tokenSet : t.tokenMissing}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-soft">{t.browserOnly}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Toggle checked={px.status === "active"} onChange={(next) => toggleStatus(px, next)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-soft">{formatDateTime(px.lastEventAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-end">
                    <Button size="sm" variant="ghost" onClick={() => sendTest(px)} disabled={px.status !== "active"}>
                      {t.testEvent}
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={c.edit} title={c.edit} onClick={() => setFormTarget(px)}>
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={c.delete}
                      title={c.delete}
                      className="text-danger hover:bg-danger-soft"
                      onClick={() => setDeleting(px)}
                    >
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
        <Card className="min-w-0 rounded-2xl">
          <CardHeader>
            <CardTitle className="font-semibold">{t.utmTitle}</CardTitle>
            <CardDescription>{t.utmDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.loading ? (
              <p className="text-sm text-ink-soft">{c.loading}</p>
            ) : analytics.error ? (
              <Alert variant="danger">{getErrorMessage(analytics.error)}</Alert>
            ) : (
              <>
                <div dir="ltr">
                  <HBarList rows={sources.map((s) => ({ label: s.source, value: s.revenueAmount, caption: formatMoney(s.revenueAmount) }))} />
                </div>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-start text-ink-soft">
                        <th className="py-1 text-start font-medium">{t.colSource}</th>
                        <th className="py-1 text-end font-medium">{t.colOrders}</th>
                        <th className="py-1 text-end font-medium">{t.colRevenue}</th>
                        <th className="py-1 text-end font-medium">{t.colAov}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sources.map((s) => (
                        <tr key={s.source} className="border-t border-line">
                          <td className="py-1.5 text-ink">
                            <bdi dir="ltr">{s.source}</bdi>
                          </td>
                          <td className="py-1.5 text-end tabular-nums text-ink-soft">
                            <bdi dir="ltr">{s.orders.toLocaleString(intlLocale)}</bdi>
                          </td>
                          <td className="py-1.5 text-end tabular-nums text-ink-soft">
                            <bdi dir="ltr">{formatMoney(s.revenueAmount)}</bdi>
                          </td>
                          <td className="py-1.5 text-end tabular-nums text-ink-soft">
                            <bdi dir="ltr">{formatMoney(s.orders > 0 ? Math.round(s.revenueAmount / s.orders) : 0)}</bdi>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 rounded-2xl">
          <CardHeader>
            <CardTitle className="font-semibold">{t.scriptTitle}</CardTitle>
            <CardDescription>{t.scriptDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative rounded-2xl border border-line bg-zimos-ice p-3 pe-24">
              <pre dir="ltr" className="overflow-x-auto whitespace-pre-wrap break-all text-start font-mono text-xs text-ink">
                {snippet}
              </pre>
              <Button size="sm" variant="outline" className="absolute end-2 top-2" onClick={copySnippet}>
                {copied ? <Check /> : <Copy />}
                {copied ? c.copied : c.copy}
              </Button>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-ink-soft">
              <li>• {t.scriptNote1}</li>
              <li>• {t.scriptNote2}</li>
              <li>• {t.scriptNote3}</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Modal open={formTarget !== null} onClose={() => setFormTarget(null)} title={formTarget === "new" ? t.addPixel : t.editPixel}>
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
        title={deleting ? fmt(t.confirmTitleNamed, { name: deleting.label }) : t.confirmTitle}
        description={t.confirmDescription}
        confirmLabel={t.confirmLabel}
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
  const t = useT(FORM_STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const platformText = PLATFORM_TEXT[locale];
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

  const supportsCapi = PLATFORM_META[platform].supportsCapi;

  function toggleEvent(e: PixelEvent) {
    setEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const errs: Record<string, string> = {};
    if (!label.trim()) errs.label = t.errLabel;
    if (!pixelId.trim()) errs.pixelId = t.errPixelId;
    if (events.length === 0) errs.events = t.errEvents;
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
      toast.success(isEdit ? t.toastSaved : t.toastAdded);
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

      <Field label={t.platform}>
        {({ id }) => (
          <div className="flex items-center gap-3">
            <PlatformChip platform={platform} />
            <Select id={id} value={platform} onChange={(e) => setPlatform(e.target.value as PixelPlatform)} disabled={isEdit}>
              {(Object.keys(PLATFORM_META) as PixelPlatform[]).map((p) => (
                <option key={p} value={p}>
                  {platformText[p].name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </Field>

      <TextField label={t.label} required value={label} onChange={(e) => setLabel(e.target.value)} error={fieldErrors.label} placeholder={t.labelPlaceholder} />
      <TextField
        label={t.pixelId}
        required
        dir="ltr"
        value={pixelId}
        onChange={(e) => setPixelId(e.target.value)}
        error={fieldErrors.pixelId}
        hint={platformText[platform].idHint}
        className="font-mono"
      />

      {supportsCapi && (
        <div className="space-y-3 rounded-2xl border border-line p-3">
          <Toggle checked={capiEnabled} onChange={setCapiEnabled} label={t.capiLabel} description={t.capiDescription} />
          {capiEnabled && (
            <TextField
              label={t.accessToken}
              type="password"
              dir="ltr"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={pixel?.capiTokenSet ? t.tokenPlaceholderKeep : t.tokenPlaceholderNew}
              hint={t.tokenHint}
            />
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label>{t.eventsToSend}</Label>
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line p-2 sm:grid-cols-3">
          {EVENT_KEYS.map((e) => (
            <label key={e.key} className="flex items-start gap-2 rounded px-1 py-1 text-sm text-ink hover:bg-paper-raised">
              <input type="checkbox" className="mt-1" checked={events.includes(e.key)} onChange={() => toggleEvent(e.key)} />
              <span className="min-w-0">
                <span dir="ltr" className="block">
                  {e.label}
                </span>
                <span className="block text-xs text-ink-muted">{EVENT_DESCRIPTION[locale][e.key]}</span>
              </span>
            </label>
          ))}
        </div>
        {fieldErrors.events && <p className="text-xs font-medium text-danger">{fieldErrors.events}</p>}
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {c.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? c.saving : isEdit ? t.savePixel : t.addPixel}
        </Button>
      </div>
    </form>
  );
}
