import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Copy, Link2, Plus, Users } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, cn } from "@store-builder/ui";
import { mockApi } from "@/mock/api";
import type { Affiliate } from "@/mock/types2";
import { slugify, uid } from "@/mock/store";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import {
  basisPointsToPercentInput,
  formatMoney,
  formatNumber,
  formatPercent,
  majorToMinor,
  minorToMajorInput,
  percentToBasisPoints,
} from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { HBarList } from "@/components/charts";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Toggle } from "@/components/Toggle";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";
import { STRINGS } from "./affiliates.strings";

type T = (typeof STRINGS)["en"];

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

const COOKIE_WINDOWS: CookieWindow[] = [7, 14, 30];

function storeHost(name: string): string {
  return `${slugify(name) || "store"}.zimos.test`;
}

function refLink(host: string, code: string) {
  return `https://${host}/?ref=${code}`;
}

function commissionLabel(a: Affiliate, t: T): string {
  return a.commissionType === "percentage" ? formatPercent(a.commissionValue) : fmt(t.fixed, { amount: formatMoney(a.commissionValue) });
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
  const t = useT(STRINGS);
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(fmt(t.copiedToast, { label }));
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t.copyFailed);
    }
  }
  const aria = fmt(t.copyAria, { label });
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={aria}
      title={aria}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded text-ink-soft transition-colors hover:bg-paper hover:text-ink"
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  );
}

// ---------------------------------------------------------------- Page --

export function AffiliatesPage() {
  const t = useT(STRINGS);
  const c = useCommon();
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
        .map((a) => ({ label: a.name, value: a.deliveredOrders, caption: fmt(t.deliveredCaption, { n: formatNumber(a.deliveredOrders) }) })),
    [affiliates, t]
  );

  async function toggleStatus(a: Affiliate, active: boolean) {
    const next: Affiliate = { ...a, status: active ? "active" : "paused" };
    list.setData((prev) => (prev ?? []).map((x) => (x.id === a.id ? next : x)));
    await mockApi.saveAffiliate(workspaceId, next);
    toast.success(fmt(active ? t.toastActive : t.toastPaused, { name: a.name }));
    reload();
  }

  async function confirmPay() {
    if (!paying) return;
    await mockApi.payAffiliate(workspaceId, paying.id);
    toast.success(fmt(t.toastPaid, { amount: formatMoney(paying.earnedAmount - paying.paidAmount), name: paying.name }));
    setPaying(null);
    reload();
  }

  const signupUrl = `https://${host}/affiliates/join`;
  const thNum = "px-4 py-3 text-end font-medium";

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button onClick={() => setFormTarget("new")}>
            <Plus /> {t.addAffiliate}
          </Button>
        }
      />

      <DataState loading={list.loading} error={list.error} onRetry={() => list.refresh()}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label={t.kpiActive} value={<bdi dir="ltr">{formatNumber(kpis.active)}</bdi>} hint={fmt(t.kpiActiveHint, { n: formatNumber(affiliates.length) })} icon={<Users />} />
          <KpiCard label={t.kpiOrders} value={<bdi dir="ltr">{formatNumber(kpis.orders)}</bdi>} hint={t.kpiOrdersHint} />
          <KpiCard
            label={t.kpiDelivered}
            value={<bdi dir="ltr">{formatNumber(kpis.delivered)}</bdi>}
            hint={kpis.orders ? fmt(t.kpiDeliveredHint, { pct: formatNumber(Math.round((kpis.delivered / kpis.orders) * 100)) }) : "—"}
          />
          <KpiCard label={t.kpiOwed} value={<bdi dir="ltr">{formatMoney(kpis.owed)}</bdi>} hint={t.kpiOwedHint} className={kpis.owed > 0 ? "border-danger/30" : undefined} />
        </div>

        {affiliates.length === 0 ? (
          <EmptyState
            title={t.emptyTitle}
            description={t.emptyDescription}
            icon={<Users />}
            action={
              <Button variant="outline" onClick={() => setFormTarget("new")}>
                <Plus /> {t.addAffiliate}
              </Button>
            }
            className="rounded-2xl"
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-line bg-paper text-start text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 text-start font-medium">{t.colAffiliate}</th>
                  <th className="px-4 py-3 text-start font-medium">{t.colCode}</th>
                  <th className="px-4 py-3 text-start font-medium">{t.colCommission}</th>
                  <th className="px-4 py-3 text-start font-medium">{c.status}</th>
                  <th className={thNum}>{t.colClicks}</th>
                  <th className={thNum}>{t.colOrders}</th>
                  <th className={thNum}>{t.colDelivered}</th>
                  <th className={thNum}>{t.colConv}</th>
                  <th className={thNum}>{t.colEarned}</th>
                  <th className={thNum}>{t.colPaid}</th>
                  <th className={thNum}>{t.colOwed}</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">{c.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {affiliates.map((a) => {
                  const owed = Math.max(a.earnedAmount - a.paidAmount, 0);
                  const link = refLink(host, a.code);
                  return (
                    <tr key={a.id} className="border-b border-line last:border-0 hover:bg-paper/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink" dir="auto">
                          {a.name}
                        </p>
                        <p className="text-start text-xs text-ink-soft">
                          <bdi dir="ltr">{a.phone}</bdi>
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <bdi dir="ltr" className="rounded bg-paper px-1.5 py-0.5 font-mono text-xs font-medium text-ink">
                            {a.code}
                          </bdi>
                          <CopyButton text={a.code} label={t.code} />
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-soft">
                          <Link2 className="size-3 shrink-0" />
                          <span className="max-w-[180px] truncate" title={link} dir="ltr">
                            {link}
                          </span>
                          <CopyButton text={link} label={t.link} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-ink">
                          <bdi dir="ltr">{commissionLabel(a, t)}</bdi>
                        </p>
                        <p className="text-xs text-ink-soft">{a.payOn === "delivered" ? t.payOnDeliveredShort : t.payOnConfirmedShort}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Toggle checked={a.status === "active"} onChange={(v) => toggleStatus(a, v)} />
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums text-ink-soft">
                        <bdi dir="ltr">{formatNumber(a.clicks)}</bdi>
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums text-ink">
                        <bdi dir="ltr">{formatNumber(a.orders)}</bdi>
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums text-ink">
                        <bdi dir="ltr">{formatNumber(a.deliveredOrders)}</bdi>
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums text-ink-soft">
                        <bdi dir="ltr">{formatPercent(conversionBp(a))}</bdi>
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums text-ink">
                        <bdi dir="ltr">{formatMoney(a.earnedAmount)}</bdi>
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums text-ink-soft">
                        <bdi dir="ltr">{formatMoney(a.paidAmount)}</bdi>
                      </td>
                      <td className={cn("px-4 py-3 text-end tabular-nums font-medium", owed > 0 ? "bg-danger-soft/60 text-danger" : "text-ink-soft")}>
                        <bdi dir="ltr">{formatMoney(owed)}</bdi>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-end">
                        <Button size="sm" variant="outline" disabled={owed === 0} onClick={() => setPaying(a)}>
                          {t.pay}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setFormTarget(a)}>
                          {c.edit}
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
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="font-semibold">{t.programSettings}</CardTitle>
              <CardDescription>{t.programSettingsDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Toggle label={t.publicSignup} description={t.publicSignupDesc} checked={settings.publicSignup} onChange={(v) => updateSettings({ publicSignup: v })} />
                {settings.publicSignup && (
                  <div className="mt-2 flex min-w-0 items-center gap-1 rounded bg-paper-raised px-2 py-1.5 text-xs text-ink-soft">
                    <span className="min-w-0 truncate" dir="ltr">
                      {signupUrl}
                    </span>
                    <CopyButton text={signupUrl} label={t.signupLink} />
                  </div>
                )}
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{t.cookieWindow}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">{t.cookieWindowDesc}</p>
                </div>
                <Select
                  className="w-32 shrink-0"
                  value={String(settings.cookieDays)}
                  onChange={(e) => updateSettings({ cookieDays: Number(e.target.value) as CookieWindow })}
                  aria-label={t.cookieWindow}
                >
                  {COOKIE_WINDOWS.map((d) => (
                    <option key={d} value={String(d)}>
                      {fmt(t.daysOption, { n: formatNumber(d) })}
                    </option>
                  ))}
                </Select>
              </div>
              <Toggle
                label={t.countDelivered}
                description={t.countDeliveredDesc}
                checked={settings.countOnlyDelivered}
                onChange={(v) => updateSettings({ countOnlyDelivered: v })}
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="font-semibold">{t.topAffiliates}</CardTitle>
              <CardDescription>{t.topAffiliatesDesc}</CardDescription>
            </CardHeader>
            <CardContent>{top.length === 0 ? <p className="text-sm text-ink-soft">{t.nothingToRank}</p> : <HBarList rows={top} />}</CardContent>
          </Card>
        </div>
      </DataState>

      <Modal
        open={formTarget !== null}
        onClose={() => setFormTarget(null)}
        title={formTarget === "new" ? t.addAffiliate : t.editAffiliate}
        description={`${t.theirLink} ⁦${refLink(host, "CODE")}⁩`}
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
        title={fmt(t.payTitle, { name: paying?.name ?? "" })}
        description={
          paying ? fmt(t.payDescription, { amount: `⁦${formatMoney(Math.max(paying.earnedAmount - paying.paidAmount, 0))}⁩` }) : undefined
        }
        confirmLabel={t.markPaid}
        onCancel={() => setPaying(null)}
        onConfirm={confirmPay}
      />
    </div>
  );
}

// ---------------------------------------------------------------- Form --

function AffiliateForm({ affiliate, onDone, onCancel }: { affiliate?: Affiliate; onDone: () => void; onCancel: () => void }) {
  const t = useT(STRINGS);
  const c = useCommon();
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
    if (!name.trim()) errs.name = t.errName;
    if (!phone.trim()) errs.phone = t.errPhone;
    const codeValue = code.trim().toUpperCase().replace(/\s+/g, "");
    if (!codeValue) errs.code = t.errCode;
    const num = commissionType === "percentage" ? percentToBasisPoints(value) : majorToMinor(value);
    if (!Number.isFinite(num) || num <= 0) errs.value = commissionType === "percentage" ? t.errPercent : t.errAmount;
    else if (commissionType === "percentage" && num > 10000) errs.value = t.errMaxPercent;
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
      toast.success(isEdit ? t.toastSaved : fmt(t.toastAdded, { name: next.name, code: next.code }));
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t.name} required error={errors.name}>
        {({ id, ...aria }) => <Input id={id} {...aria} value={name} onChange={(e) => onNameChange(e.target.value)} placeholder={t.namePlaceholder} dir="auto" />}
      </Field>
      <Field label={t.phone} required error={errors.phone} hint={t.phoneHint}>
        {({ id, ...aria }) => <Input id={id} {...aria} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" inputMode="tel" dir="ltr" className="text-start" />}
      </Field>
      <Field label={t.referralCode} required error={errors.code} hint={t.referralCodeHint}>
        {({ id, ...aria }) => (
          <div className="flex gap-2">
            <Input
              id={id}
              {...aria}
              value={code}
              dir="ltr"
              onChange={(e) => {
                setCodeTouched(true);
                setCode(e.target.value.toUpperCase());
              }}
              className="font-mono uppercase"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCodeTouched(true);
                setCode(codeFromName(name));
              }}
            >
              {t.regenerate}
            </Button>
          </div>
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.commissionType}>
          {({ id }) => (
            <Select id={id} value={commissionType} onChange={(e) => setCommissionType(e.target.value as Affiliate["commissionType"])}>
              <option value="percentage">{t.percentageOfOrder}</option>
              <option value="fixed">{t.fixedPerOrder}</option>
            </Select>
          )}
        </Field>
        {commissionType === "percentage" ? (
          <Field label={t.percentage} required error={errors.value}>
            {({ id, ...aria }) => (
              <div className="relative" dir="ltr">
                <Input id={id} {...aria} type="number" min={0} max={100} step="0.5" value={value} onChange={(e) => setValue(e.target.value)} className="pe-8" />
                <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-sm text-ink-soft">%</span>
              </div>
            )}
          </Field>
        ) : (
          <MoneyInput label={t.amountPerOrder} required value={value} onChange={setValue} error={errors.value} />
        )}
      </div>
      <Field label={t.payOn} hint={t.payOnHint}>
        {({ id }) => (
          <Select id={id} value={payOn} onChange={(e) => setPayOn(e.target.value as Affiliate["payOn"])}>
            <option value="delivered">{t.deliveredOrder}</option>
            <option value="confirmed">{t.confirmedOrder}</option>
          </Select>
        )}
      </Field>
      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {c.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? c.saving : isEdit ? t.saveAffiliate : t.addAffiliate}
        </Button>
      </div>
    </form>
  );
}
