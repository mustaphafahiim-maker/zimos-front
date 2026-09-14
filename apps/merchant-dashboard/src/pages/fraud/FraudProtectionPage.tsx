import { useMemo, useState, type FormEvent } from "react";
import { Alert, Button, Input, Label, Tabs, TabsList, TabsTrigger, cn } from "@store-builder/ui";
import { Ban, Check, Flag, Info, Phone, ShieldAlert, ShieldCheck, Trash2, Truck } from "lucide-react";
import type { BlockedEntry, FlaggedOrder, FraudRule, FraudRuleKey, FraudSettings } from "@/mock/types";
import { mockApi } from "@/mock/api";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@store-builder/ui";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { useCommon, useLocale, useT, fmt } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Toggle } from "@store-builder/ui";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { ENTRY_TYPE_LABEL, FLAG_STATUS_LABEL, RULE_COPY, STRINGS } from "./FraudProtectionPage.strings";

type TabKey = "rules" | "flagged" | "blocklist";
type FlagFilter = "all" | FlaggedOrder["status"];

const SHIPPING_COST_MINOR = 4500; // 45 EGP average failed-delivery cost

const FLAG_TONE: Record<FlaggedOrder["status"], "warning" | "success" | "danger"> = {
  flagged: "warning",
  approved: "success",
  blocked: "danger",
};

const ENTRY_TYPE_TONE: Record<BlockedEntry["type"], string> = {
  phone: "bg-primary-soft text-primary-dark",
  ip: "bg-accent-soft text-accent-dark",
  email: "bg-zimos-ice text-primary",
};

const EG_PHONE = /^01[0125]\d{8}$/;

const thBase = "px-4 py-3 font-medium text-start";

export function FraudProtectionPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const settings = useAsync(() => mockApi.getFraudSettings(workspaceId), [workspaceId]);
  const flagged = useAsync(() => mockApi.listFlagged(workspaceId), [workspaceId]);
  const blocked = useAsync(() => mockApi.listBlocked(workspaceId), [workspaceId]);

  const [tab, setTab] = useState<TabKey>("rules");

  const awaiting = (flagged.data ?? []).filter((f) => f.status === "flagged").length;
  const blockedToday = settings.data?.blockedToday ?? 0;
  const blockedMonth = settings.data?.blockedThisMonth ?? 0;

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader title={t.title} description={t.description} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t.kpiBlockedToday} value={<bdi>{blockedToday}</bdi>} hint={t.kpiBlockedTodayHint} icon={<Ban />} />
        <KpiCard label={t.kpiBlockedMonth} value={<bdi>{blockedMonth.toLocaleString()}</bdi>} hint={t.kpiBlockedMonthHint} icon={<ShieldCheck />} />
        <KpiCard label={t.kpiAwaiting} value={<bdi>{awaiting}</bdi>} hint={t.kpiAwaitingHint} icon={<Flag />} />
        <KpiCard label={t.kpiSaved} value={<bdi>{formatMoney((blockedMonth + awaiting) * SHIPPING_COST_MINOR)}</bdi>} hint={t.kpiSavedHint} icon={<Truck />} />
      </div>

      <Alert variant="info" className="mb-6 border-primary/30 bg-primary-soft/40">
        <Info />
        <div>
          <p className="font-medium text-ink">{t.phoneTitle}</p>
          <p className="text-sm text-ink-soft">
            {t.phoneHelpA}{" "}
            <span dir="ltr" className="font-mono">
              010 / 011 / 012 / 015
            </span>{" "}
            {t.phoneHelpB}
          </p>
        </div>
      </Alert>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v) as TabKey)} className="mb-4">
        <TabsList variant="line">
          <TabsTrigger value="rules">{t.tabRules}</TabsTrigger>
          <TabsTrigger value="flagged">
            {t.tabFlagged}
            {awaiting > 0 && <span className="ms-1 rounded-full bg-warning-soft px-1.5 text-[10px] tabular-nums text-warning">{awaiting}</span>}
          </TabsTrigger>
          <TabsTrigger value="blocklist">{t.tabBlocklist}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "rules" && (
        <DataState loading={settings.loading} error={settings.error} onRetry={() => settings.refresh()}>
          {settings.data && <RulesTab key={settings.data.workspaceId} initial={settings.data} onSaved={(s) => settings.setData(s)} />}
        </DataState>
      )}
      {tab === "flagged" && <FlaggedTab state={flagged} />}
      {tab === "blocklist" && <BlocklistTab state={blocked} />}
    </div>
  );
}

// ----------------------------------------------------------------- Rules --

function RulesTab({ initial, onSaved }: { initial: FraudSettings; onSaved: (s: FraudSettings) => void }) {
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [rules, setRules] = useState<FraudRule[]>(initial.rules);
  const [action, setAction] = useState<FraudSettings["action"]>(initial.action);
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(() => JSON.stringify(rules) !== JSON.stringify(initial.rules) || action !== initial.action, [rules, action, initial]);

  function update(key: FraudRuleKey, patch: Partial<FraudRule>) {
    setRules((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function save() {
    setSaving(true);
    try {
      const next: FraudSettings = { ...initial, rules, action };
      await mockApi.saveFraudSettings(workspaceId, next);
      onSaved(next);
      toast.success(t.savedToast);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 rounded-2xl border border-line bg-paper-raised">
        {rules.map((r) => {
          const copy = RULE_COPY[locale][r.key];
          const label = copy?.label ?? r.label;
          const description = copy?.description ?? r.description;
          const unit = copy ? copy.unit ?? r.valueLabel : r.valueLabel;
          return (
            <div key={r.key} className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{label}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{description}</p>
              </div>
              <div className="flex items-center gap-3">
                {r.valueLabel && (
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      dir="ltr"
                      value={r.value ?? ""}
                      disabled={!r.enabled}
                      onChange={(e) => update(r.key, { value: e.target.value === "" ? null : Number(e.target.value) })}
                      className="h-8 w-20 px-2 text-sm tabular-nums"
                      aria-label={fmt(t.valueAria, { label })}
                    />
                    <span className="text-xs text-ink-soft">{unit}</span>
                  </div>
                )}
                <Toggle checked={r.enabled} onChange={(next) => update(r.key, { enabled: next })} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-paper-raised p-4">
          <p className="text-sm font-medium text-ink">{t.whenMatches}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{t.whenMatchesHint}</p>
          <div className="mt-3 space-y-2">
            <label className={cn("flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors", action === "flag_for_review" ? "border-primary bg-primary-soft/40" : "border-line")}>
              <input type="radio" name="fraud-action" checked={action === "flag_for_review"} onChange={() => setAction("flag_for_review")} className="mt-0.5" />
              <div>
                <p className="flex items-center gap-1 text-sm font-medium text-ink">
                  <Flag className="size-3.5" /> {t.flagForReview}
                </p>
                <p className="text-xs text-ink-soft">{t.flagForReviewHint}</p>
              </div>
            </label>
            <label className={cn("flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors", action === "block" ? "border-danger bg-danger-soft/40" : "border-line")}>
              <input type="radio" name="fraud-action" checked={action === "block"} onChange={() => setAction("block")} className="mt-0.5" />
              <div>
                <p className="flex items-center gap-1 text-sm font-medium text-ink">
                  <ShieldAlert className="size-3.5" /> {t.blockNow}
                </p>
                <p className="text-xs text-ink-soft">{t.blockNowHint}</p>
              </div>
            </label>
          </div>
        </div>
        <Button className="w-full" onClick={save} disabled={saving || !dirty}>
          {saving ? c.saving : t.saveRules}
        </Button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- Flagged --

function FlaggedTab({ state }: { state: ReturnType<typeof useAsync<FlaggedOrder[]>> }) {
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [filter, setFilter] = useState<FlagFilter>("flagged");
  const [busy, setBusy] = useState<string | null>(null);

  const rows = (state.data ?? []).filter((f) => filter === "all" || f.status === filter);

  async function resolve(f: FlaggedOrder, status: "approved" | "blocked") {
    setBusy(f.id);
    try {
      await mockApi.resolveFlagged(workspaceId, f.id, status);
      state.setData((prev) => (prev ?? []).map((x) => (x.id === f.id ? { ...x, status } : x)));
      toast.success(status === "approved" ? fmt(t.approvedToast, { order: f.orderNumber }) : fmt(t.blockedToast, { order: f.orderNumber }));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs text-ink-soft">{c.status}</Label>
        <Select value={filter} onChange={(e) => setFilter(e.target.value as FlagFilter)} className="h-8 w-44 py-1">
          <option value="flagged">{t.filterAwaiting}</option>
          <option value="approved">{t.filterApproved}</option>
          <option value="blocked">{t.filterBlocked}</option>
          <option value="all">{c.all}</option>
        </Select>
      </div>
      <DataState loading={state.loading} error={state.error} empty={rows.length === 0} emptyMessage={t.emptyFlagged} onRetry={() => state.refresh()}>
        <div className="max-h-[70vh] overflow-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="sticky top-0 z-10 bg-paper-raised">
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <th className={thBase}>{t.colOrder}</th>
                <th className={thBase}>{t.colCustomer}</th>
                <th className={thBase}>{t.colPhone}</th>
                <th className={cn(thBase, "text-end")}>{t.colTotal}</th>
                <th className={thBase}>{t.colTriggered}</th>
                <th className={thBase}>{c.status}</th>
                <th className={thBase}>{t.colFlagged}</th>
                <th className={thBase}>
                  <span className="sr-only">{c.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => {
                const validPhone = EG_PHONE.test(f.phone);
                return (
                  <tr key={f.id} className="border-b border-line bg-paper last:border-0 hover:bg-paper-raised">
                    <td className="px-4 py-3 text-start font-medium text-ink">
                      <span dir="ltr">{f.orderNumber}</span>
                    </td>
                    <td className="px-4 py-3 text-start text-ink" dir="auto">
                      {f.customerName}
                    </td>
                    <td className="px-4 py-3 text-start">
                      <span className={cn("inline-flex items-center gap-1 font-mono text-xs", validPhone ? "text-ink-soft" : "text-danger")} title={validPhone ? undefined : t.invalidPhone}>
                        <Phone className="size-3" /> <span dir="ltr">{f.phone}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-end tabular-nums text-ink">
                      <bdi>{formatMoney(f.totalAmount, f.currency)}</bdi>
                    </td>
                    <td className="px-4 py-3 text-start">
                      <div className="flex max-w-[240px] flex-wrap gap-1">
                        {f.triggeredRules.map((r) => (
                          <span key={r} className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
                            {RULE_COPY[locale][r]?.short ?? r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-start">
                      <StatusBadge value={f.status} tone={FLAG_TONE[f.status]} label={FLAG_STATUS_LABEL[locale][f.status]} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-start text-xs text-ink-soft">
                      <bdi>{formatDateTime(f.createdAt)}</bdi>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-end">
                      {f.status === "flagged" ? (
                        <>
                          <Button size="sm" variant="ghost" className="text-success" disabled={busy === f.id} onClick={() => resolve(f, "approved")}>
                            <Check /> {t.approve}
                          </Button>
                          <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" disabled={busy === f.id} onClick={() => resolve(f, "blocked")}>
                            <Ban /> {t.block}
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-ink-soft">{t.resolved}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DataState>
    </div>
  );
}

// ------------------------------------------------------------- Blocklist --

function BlocklistTab({ state }: { state: ReturnType<typeof useAsync<BlockedEntry[]>> }) {
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<BlockedEntry | null>(null);

  const entries = state.data ?? [];

  async function confirmRemove() {
    if (!removing) return;
    await mockApi.removeBlocked(workspaceId, removing.id);
    toast.success(t.removedToast);
    setRemoving(null);
    state.refresh({ silent: true });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-sm text-ink-soft">{fmt(t.entriesSummary, { n: entries.length })}</p>
        <Button size="sm" onClick={() => setAdding(true)}>
          {t.addToBlocklist}
        </Button>
      </div>
      <DataState loading={state.loading} error={state.error} empty={entries.length === 0} emptyMessage={t.emptyBlocklist} onRetry={() => state.refresh()}>
        <div className="max-h-[70vh] overflow-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="sticky top-0 z-10 bg-paper-raised">
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <th className={thBase}>{t.colType}</th>
                <th className={thBase}>{t.colValue}</th>
                <th className={thBase}>{t.colReason}</th>
                <th className={thBase}>{t.colSource}</th>
                <th className={cn(thBase, "text-end")}>{t.colHits}</th>
                <th className={thBase}>{t.colAdded}</th>
                <th className={thBase}>
                  <span className="sr-only">{c.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-line bg-paper last:border-0 hover:bg-paper-raised">
                  <td className="px-4 py-3 text-start">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium uppercase", ENTRY_TYPE_TONE[e.type])}>{ENTRY_TYPE_LABEL[locale][e.type] ?? e.type}</span>
                  </td>
                  <td className="px-4 py-3 text-start font-mono text-xs text-ink">
                    <span dir="ltr">{e.value}</span>
                  </td>
                  <td className="max-w-[260px] truncate px-4 py-3 text-start text-ink-soft" dir="auto">
                    {e.reason || "—"}
                  </td>
                  <td className="px-4 py-3 text-start">
                    <StatusBadge
                      value={e.source}
                      tone={e.source === "rule" ? "info" : "neutral"}
                      label={e.source === "rule" ? t.sourceRule : e.source === "manual" ? t.sourceManual : undefined}
                    />
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums text-ink-soft">{e.hits}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-start text-xs text-ink-soft">
                    <bdi>{formatDate(e.createdAt)}</bdi>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-end">
                    <Button size="icon-sm" variant="ghost" aria-label={t.remove} title={t.remove} className="text-danger hover:bg-danger-soft" onClick={() => setRemoving(e)}>
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>

      <Modal open={adding} onClose={() => setAdding(false)} title={t.addToBlocklist}>
        {adding && (
          <BlockForm
            onCancel={() => setAdding(false)}
            onDone={() => {
              setAdding(false);
              state.refresh({ silent: true });
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        title={removing ? fmt(t.unblockTitle, { value: removing.value }) : t.removeEntryTitle}
        description={t.unblockDescription}
        confirmLabel={t.remove}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}

function BlockForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const t = useT(STRINGS);
  const c = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [type, setType] = useState<BlockedEntry["type"]>("phone");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    const v = value.trim();
    if (!v) return t.errEmpty;
    if (type === "phone" && !EG_PHONE.test(v)) return t.errPhone;
    if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return t.errEmail;
    if (type === "ip" && !/^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/.test(v)) return t.errIp;
    return null;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const err = validate();
    setError(err);
    if (err) return;
    setSaving(true);
    try {
      await mockApi.addBlocked(workspaceId, { type, value: value.trim(), reason: reason.trim(), source: "manual" });
      toast.success(t.addedToast);
      onDone();
    } catch (err2) {
      setError(getErrorMessage(err2));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t.colType}>
        {({ id }) => (
          <Select id={id} value={type} onChange={(e) => setType(e.target.value as BlockedEntry["type"])}>
            <option value="phone">{t.typePhone}</option>
            <option value="ip">{t.typeIp}</option>
            <option value="email">{t.typeEmail}</option>
          </Select>
        )}
      </Field>
      <TextField
        label={t.colValue}
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
        error={error ?? undefined}
        placeholder={type === "phone" ? "01012345678" : type === "ip" ? "197.54.12.0/24" : "spam@example.com"}
        className="font-mono"
        dir="ltr"
        autoFocus
      />
      <Field label={t.colReason} hint={t.reasonHint}>
        {({ id }) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} dir="auto" placeholder={t.reasonPlaceholder} />}
      </Field>
      <div className="flex flex-wrap justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {c.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t.adding : t.block}
        </Button>
      </div>
    </form>
  );
}
