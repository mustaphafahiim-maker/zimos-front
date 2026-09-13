import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Copy, Link2, Users } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, cn } from "@store-builder/ui";
import { mockApi } from "@/mock/api";
import type { Affiliate } from "@/mock/types2";
import { slugify, uid } from "@/mock/store";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import {
  basisPointsToPercentInput,
  formatMoney,
  formatPercent,
  majorToMinor,
  minorToMajorInput,
  percentToBasisPoints,
} from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { HBarList } from "@/components/charts";
import { DataState } from "@/components/DataState";
import { Toggle } from "@/components/Toggle";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

// ------------------------------------------------------ Program settings --

type CookieWindow = 7 | 14 | 30;

interface AffiliateSettings {
  publicSignup: boolean;
  cookieDays: CookieWindow;
  countOnlyDelivered: boolean;
}

const DEFAULT_SETTINGS: AffiliateSettings = { publicSignup: true, cookieDays: 14, countOnlyDelivered: true };

function settingsKey(ws: string) {
  return `zimos.mock.${ws}.affiliateSettings`;
}

function readSettings(ws: string): AffiliateSettings {
  try {
    const raw = localStorage.getItem(settingsKey(ws));
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AffiliateSettings>;
    return {
      publicSignup: typeof parsed.publicSignup === "boolean" ? parsed.publicSignup : DEFAULT_SETTINGS.publicSignup,
      cookieDays: parsed.cookieDays === 7 || parsed.cookieDays === 14 || parsed.cookieDays === 30 ? parsed.cookieDays : DEFAULT_SETTINGS.cookieDays,
      countOnlyDelivered: typeof parsed.countOnlyDelivered === "boolean" ? parsed.countOnlyDelivered : DEFAULT_SETTINGS.countOnlyDelivered,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function useAffiliateSettings(ws: string) {
  const [settings, setSettings] = useState<AffiliateSettings>(() => readSettings(ws));
  useEffect(() => {
    setSettings(readSettings(ws));
  }, [ws]);
  const update = (patch: Partial<AffiliateSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(settingsKey(ws), JSON.stringify(next));
      } catch {
        // storage unavailable — keep in memory only
      }
      return next;
    });
  };
  return [settings, update] as const;
}

// ------------------------------------------------------------- Helpers --

function storeHost(name: string): string {
  return `${slugify(name) || "store"}.zimos.test`;
}

function refLink(host: string, code: string) {
  return `https://${host}/?ref=${code}`;
}

function commissionLabel(a: Affiliate): string {
  return a.commissionType === "percentage" ? formatPercent(a.commissionValue) : `${formatMoney(a.commissionValue)} fixed`;
}

function conversionBp(a: Affiliate): number {
  if (a.clicks === 0) return 0;
  return Math.round((a.orders / a.clicks) * 10000);
}

function codeFromName(name: string): string {
  const latin = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 10);
  if (latin) return latin;
  // Arabic-only names: fall back to a short random code.
  return `REF${Math.floor(1000 + Math.random() * 9000)}`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${label} copied.`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      className="inline-flex size-6 items-center justify-center rounded text-ink-soft transition-colors hover:bg-paper-raised hover:text-ink"
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  );
}

// ---------------------------------------------------------------- Page --

export function AffiliatesPage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const host = storeHost(currentWorkspace?.name ?? "store");
  const toast = useToast();
  const list = useAsync(() => mockApi.listAffiliates(workspaceId), [workspaceId]);
  const [settings, updateSettings] = useAffiliateSettings(workspaceId);

  const [formTarget, setFormTarget] = useState<Affiliate | "new" | null>(null);
  const [paying, setPaying] = useState<Affiliate | null>(null);

  const affiliates = list.data ?? [];
  const reload = () => list.refresh({ silent: true });

  const kpis = useMemo(() => {
    const active = affiliates.filter((a) => a.status === "active").length;
    const orders = affiliates.reduce((s, a) => s + a.orders, 0);
    const delivered = affiliates.reduce((s, a) => s + a.deliveredOrders, 0);
    const owed = affiliates.reduce((s, a) => s + Math.max(a.earnedAmount - a.paidAmount, 0), 0);
    return { active, orders, delivered, owed };
  }, [affiliates]);

  const top = useMemo(
    () =>
      [...affiliates]
        .sort((a, b) => b.deliveredOrders - a.deliveredOrders)
        .slice(0, 5)
        .map((a) => ({ label: a.name, value: a.deliveredOrders, caption: `${a.deliveredOrders} delivered` })),
    [affiliates]
  );

  async function toggleStatus(a: Affiliate, active: boolean) {
    const next: Affiliate = { ...a, status: active ? "active" : "paused" };
    list.setData((prev) => (prev ?? []).map((x) => (x.id === a.id ? next : x)));
    await mockApi.saveAffiliate(workspaceId, next);
    toast.success(active ? `${a.name} is active.` : `${a.name} paused.`);
    reload();
  }

  async function confirmPay() {
    if (!paying) return;
    await mockApi.payAffiliate(workspaceId, paying.id);
    toast.success(`Paid ${formatMoney(paying.earnedAmount - paying.paidAmount)} to ${paying.name}.`);
    setPaying(null);
    reload();
  }

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title="Affiliates & marketers"
        description="Give creators and groups a referral code, track every order they send, and pay commissions on delivered COD."
        actions={<Button onClick={() => setFormTarget("new")}>Add affiliate</Button>}
      />

      <DataState loading={list.loading} error={list.error} onRetry={() => list.refresh()}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Active affiliates" value={kpis.active} hint={`${affiliates.length} total`} icon={<Users />} />
          <KpiCard label="Orders via affiliates" value={kpis.orders.toLocaleString()} hint="All time" />
          <KpiCard label="Delivered" value={kpis.delivered.toLocaleString()} hint={kpis.orders ? `${Math.round((kpis.delivered / kpis.orders) * 100)}% of referred orders` : "—"} />
          <KpiCard label="Commissions owed" value={formatMoney(kpis.owed)} hint="Earned minus paid" className={kpis.owed > 0 ? "border-danger/30" : undefined} />
        </div>

        {affiliates.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-line px-6 py-12 text-center text-sm text-ink-soft">
            No affiliates yet. Add your first marketer to start tracking referrals.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">Affiliate</th>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Commission</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Clicks</th>
                  <th className="px-4 py-3 text-right font-medium">Orders</th>
                  <th className="px-4 py-3 text-right font-medium">Delivered</th>
                  <th className="px-4 py-3 text-right font-medium">Conv.</th>
                  <th className="px-4 py-3 text-right font-medium">Earned</th>
                  <th className="px-4 py-3 text-right font-medium">Paid</th>
                  <th className="px-4 py-3 text-right font-medium">Owed</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {affiliates.map((a) => {
                  const owed = Math.max(a.earnedAmount - a.paidAmount, 0);
                  const link = refLink(host, a.code);
                  return (
                    <tr key={a.id} className="border-b border-line last:border-0 hover:bg-paper-raised/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink" dir="auto">{a.name}</p>
                        <p className="text-xs text-ink-soft" dir="ltr">{a.phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="rounded bg-paper-raised px-1.5 py-0.5 font-mono text-xs font-medium text-ink">{a.code}</span>
                          <CopyButton text={a.code} label="Code" />
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-soft">
                          <Link2 className="size-3" />
                          <span className="max-w-[180px] truncate" title={link}>{link}</span>
                          <CopyButton text={link} label="Link" />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-ink">{commissionLabel(a)}</p>
                        <p className="text-xs text-ink-soft">on {a.payOn}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Toggle checked={a.status === "active"} onChange={(v) => toggleStatus(a, v)} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{a.clicks.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink">{a.orders.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink">{a.deliveredOrders.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{formatPercent(conversionBp(a))}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink">{formatMoney(a.earnedAmount)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{formatMoney(a.paidAmount)}</td>
                      <td className={cn("px-4 py-3 text-right tabular-nums font-medium", owed > 0 ? "bg-danger-soft/60 text-danger" : "text-ink-soft")}>
                        {formatMoney(owed)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Button size="sm" variant="outline" disabled={owed === 0} onClick={() => setPaying(a)}>
                          Pay
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setFormTarget(a)}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Program settings</CardTitle>
              <CardDescription>How referrals are attributed and counted.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Toggle
                  label="Public signup page"
                  description="Let marketers apply themselves and get a code instantly."
                  checked={settings.publicSignup}
                  onChange={(v) => updateSettings({ publicSignup: v })}
                />
                {settings.publicSignup && (
                  <div className="mt-2 flex items-center gap-1 rounded bg-paper-raised px-2 py-1.5 text-xs text-ink-soft">
                    <span className="truncate" dir="ltr">{`https://${host}/affiliates/join`}</span>
                    <CopyButton text={`https://${host}/affiliates/join`} label="Signup link" />
                  </div>
                )}
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">Cookie window</p>
                  <p className="mt-0.5 text-xs text-ink-soft">Orders within this many days of the click count for the affiliate.</p>
                </div>
                <Select
                  className="w-32"
                  value={String(settings.cookieDays)}
                  onChange={(e) => updateSettings({ cookieDays: Number(e.target.value) as CookieWindow })}
                  aria-label="Cookie window"
                >
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                </Select>
              </div>
              <Toggle
                label="Count only delivered orders"
                description="Commissions accrue after the courier confirms delivery, not on confirmation."
                checked={settings.countOnlyDelivered}
                onChange={(v) => updateSettings({ countOnlyDelivered: v })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top affiliates</CardTitle>
              <CardDescription>By delivered orders.</CardDescription>
            </CardHeader>
            <CardContent>
              {top.length === 0 ? (
                <p className="text-sm text-ink-soft">Nothing to rank yet.</p>
              ) : (
                <HBarList rows={top} />
              )}
            </CardContent>
          </Card>
        </div>
      </DataState>

      <Modal
        open={formTarget !== null}
        onClose={() => setFormTarget(null)}
        title={formTarget === "new" ? "Add affiliate" : "Edit affiliate"}
        description={`Their link: ${refLink(host, "CODE")}`}
      >
        {formTarget !== null && (
          <AffiliateForm
            key={formTarget === "new" ? "new" : formTarget.id}
            affiliate={formTarget === "new" ? undefined : formTarget}
            onCancel={() => setFormTarget(null)}
            onDone={() => {
              setFormTarget(null);
              reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={paying !== null}
        title={`Pay ${paying?.name ?? ""}?`}
        description={paying ? `Marks ${formatMoney(Math.max(paying.earnedAmount - paying.paidAmount, 0))} as paid. Send the transfer via InstaPay or Vodafone Cash first.` : undefined}
        confirmLabel="Mark as paid"
        onCancel={() => setPaying(null)}
        onConfirm={confirmPay}
      />
    </div>
  );
}

// ---------------------------------------------------------------- Form --

function AffiliateForm({ affiliate, onDone, onCancel }: { affiliate?: Affiliate; onDone: () => void; onCancel: () => void }) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const toast = useToast();
  const isEdit = Boolean(affiliate);

  const [name, setName] = useState(affiliate?.name ?? "");
  const [phone, setPhone] = useState(affiliate?.phone ?? "");
  const [code, setCode] = useState(affiliate?.code ?? "");
  const [codeTouched, setCodeTouched] = useState(isEdit);
  const [commissionType, setCommissionType] = useState<Affiliate["commissionType"]>(affiliate?.commissionType ?? "percentage");
  const [value, setValue] = useState(() => {
    if (!affiliate) return "10";
    return affiliate.commissionType === "percentage" ? basisPointsToPercentInput(affiliate.commissionValue) : minorToMajorInput(affiliate.commissionValue);
  });
  const [payOn, setPayOn] = useState<Affiliate["payOn"]>(affiliate?.payOn ?? "delivered");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onNameChange(next: string) {
    setName(next);
    if (!codeTouched) setCode(codeFromName(next));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required.";
    if (!phone.trim()) errs.phone = "Phone is required.";
    const codeValue = code.trim().toUpperCase().replace(/\s+/g, "");
    if (!codeValue) errs.code = "Code is required.";
    const num = commissionType === "percentage" ? percentToBasisPoints(value) : majorToMinor(value);
    if (!Number.isFinite(num) || num <= 0) errs.value = commissionType === "percentage" ? "Enter a percentage above 0." : "Enter a valid amount.";
    else if (commissionType === "percentage" && num > 10000) errs.value = "Can't exceed 100%.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const next: Affiliate = affiliate
        ? { ...affiliate, name: name.trim(), phone: phone.trim(), code: codeValue, commissionType, commissionValue: num, payOn }
        : {
            id: uid(),
            name: name.trim(),
            phone: phone.trim(),
            code: codeValue,
            commissionType,
            commissionValue: num,
            payOn,
            status: "active",
            clicks: 0,
            orders: 0,
            deliveredOrders: 0,
            earnedAmount: 0,
            paidAmount: 0,
            joinedAt: new Date().toISOString(),
          };
      await mockApi.saveAffiliate(workspaceId, next);
      toast.success(isEdit ? "Affiliate saved." : `${next.name} added with code ${next.code}.`);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name" required error={errors.name}>
        {({ id, ...aria }) => <Input id={id} {...aria} value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g. Nour — TikTok" dir="auto" />}
      </Field>
      <Field label="Phone" required error={errors.phone} hint="Used for payouts and WhatsApp updates.">
        {({ id, ...aria }) => <Input id={id} {...aria} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" inputMode="tel" dir="ltr" />}
      </Field>
      <Field label="Referral code" required error={errors.code} hint="Auto-generated from the name; customers type it at checkout or use the link.">
        {({ id, ...aria }) => (
          <div className="flex gap-2">
            <Input
              id={id}
              {...aria}
              value={code}
              onChange={(e) => {
                setCodeTouched(true);
                setCode(e.target.value.toUpperCase());
              }}
              className="font-mono uppercase"
            />
            <Button type="button" variant="outline" onClick={() => { setCodeTouched(true); setCode(codeFromName(name)); }}>
              Regenerate
            </Button>
          </div>
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Commission type">
          {({ id }) => (
            <Select id={id} value={commissionType} onChange={(e) => setCommissionType(e.target.value as Affiliate["commissionType"])}>
              <option value="percentage">Percentage of order</option>
              <option value="fixed">Fixed per order</option>
            </Select>
          )}
        </Field>
        {commissionType === "percentage" ? (
          <Field label="Percentage" required error={errors.value}>
            {({ id, ...aria }) => (
              <div className="relative">
                <Input id={id} {...aria} type="number" min={0} max={100} step="0.5" value={value} onChange={(e) => setValue(e.target.value)} className="pr-8" />
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-ink-soft">%</span>
              </div>
            )}
          </Field>
        ) : (
          <MoneyInput label="Amount per order" required value={value} onChange={setValue} error={errors.value} />
        )}
      </div>
      <Field label="Pay on" hint="Delivered is safer for COD — no commission on returned orders.">
        {({ id }) => (
          <Select id={id} value={payOn} onChange={(e) => setPayOn(e.target.value as Affiliate["payOn"])}>
            <option value="delivered">Delivered order</option>
            <option value="confirmed">Confirmed order</option>
          </Select>
        )}
      </Field>
      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save affiliate" : "Add affiliate"}
        </Button>
      </div>
    </form>
  );
}
