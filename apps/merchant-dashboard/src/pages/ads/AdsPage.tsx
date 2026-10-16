import { useRef, useState, type ChangeEvent } from "react";
import { Megaphone, Plus, Trash2, Upload } from "lucide-react";
import { Alert, Button, cn } from "@store-builder/ui";
import {
  PROFIT_AD_PLATFORMS,
  profitAddAdSpend,
  profitDeleteAdSpend,
  profitGetCampaigns,
  profitImportAdSpend,
  profitListAdSpend,
  type ProfitAdPlatform,
  type ProfitAdSpendEntry,
  type ProfitAdSpendImport,
  type ProfitCampaign,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatMoney, majorToMinor } from "@/lib/format";
import { formatCount, rangeWindows, type AnalyticsRange } from "@/lib/analytics";
import { PageHeader } from "@/components/PageHeader";
import { CopyButton } from "@/components/CopyButton";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Field, TextField } from "@/components/Field";
import { FilterTabs } from "@/components/FilterTabs";
import { KpiCard } from "@/components/KpiCard";
import { Modal } from "@/components/Modal";
import { MoneyInput } from "@/components/MoneyInput";
import { RangeSwitch } from "@/components/RangeSwitch";
import { Section } from "@/components/Section";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Ad spend",
    description: "Your ad spend against the orders it really delivered: real cost per delivered order and real return on spend.",
    addSpend: "Add spend",
    importCsv: "Import CSV",
    tabCampaigns: "Campaigns",
    tabEntries: "Spend entries",
    tabsLabel: "Ads view",
    spend: "Spend",
    orders: "Orders",
    confirmed: "Confirmed",
    delivered: "Delivered",
    deliveredSales: "Delivered sales",
    realCpa: "Real CPA",
    realCpaHint: "Spend ÷ delivered orders",
    realRoas: "Real ROAS",
    realRoasHint: "Delivered sales ÷ spend",
    campaign: "Campaign",
    platform: "Platform",
    meta: "Meta",
    tiktok: "TikTok",
    snapchat: "Snapchat",
    google: "Google",
    other: "Other",
    emptyTitle: "No ad spend recorded for this period",
    emptyDesc: "Type in what you spent per campaign, or import the CSV your ads manager exports. Orders are matched by utm_campaign, or by the ad_id in the ad's link.",
    withoutSpendTitle: "Campaigns with orders but no spend",
    withoutSpendDesc: "These utm_campaign values brought orders. Add their spend to see their real return.",
    urlTitle: "URL parameters for your ads",
    urlDesc: "Paste into the URL parameters field of each ad so orders are matched to the campaign by name.",
    day: "Date",
    source: "Entered",
    manual: "By hand",
    csv: "CSV",
    sync: "Sync",
    impressions: "Impressions",
    clicks: "Clicks",
    noEntries: "No spend entries yet.",
    deleted: "Entry deleted.",
    addTitle: "Add ad spend",
    addDesc: "One amount per day and campaign. Saving the same day and campaign again replaces it.",
    campaignName: "Campaign name",
    campaignHint: "Exactly as in utm_campaign",
    amount: "Amount spent",
    invalidAmount: "Enter a valid amount",
    required: "Required",
    saved: "Spend saved.",
    importTitle: "Import ad spend",
    importDesc: "A CSV with the columns: Date, Platform, Campaign name, Amount spent. Impressions, Clicks, Campaign ID and Ad ID are optional. An export at ad level (with Ad ID) is added up per campaign and day, and its ads let orders that carry ad_id find their campaign.",
    chooseFile: "Choose a CSV file",
    defaultPlatform: "Platform (when the file has no platform column)",
    fromFile: "From the file",
    check: "Check file",
    importNow: "Import {n} rows",
    checkResult: "{valid} of {rows} rows are ready — total {total}.",
    rejected: "{n} rows will be skipped:",
    line: "Line {n}: {problems}",
    imported: "Imported {created} new and updated {updated}.",
    fileTooBig: "The file is larger than 1 MB.",
    template: "Example",
  },
  ar: {
    title: "مصاريف الإعلانات",
    description: "إنفاقك الإعلاني مقابل الطلبات التي سُلّمت فعلًا: التكلفة الحقيقية لكل طلب مسلَّم والعائد الحقيقي على الإنفاق.",
    addSpend: "أضف إنفاقًا",
    importCsv: "استيراد CSV",
    tabCampaigns: "الحملات",
    tabEntries: "سجل الإنفاق",
    tabsLabel: "عرض الإعلانات",
    spend: "الإنفاق",
    orders: "الطلبات",
    confirmed: "المؤكَّد",
    delivered: "المسلَّم",
    deliveredSales: "مبيعات مسلَّمة",
    realCpa: "التكلفة الحقيقية للطلب",
    realCpaHint: "الإنفاق ÷ الطلبات المسلَّمة",
    realRoas: "العائد الحقيقي",
    realRoasHint: "المبيعات المسلَّمة ÷ الإنفاق",
    campaign: "الحملة",
    platform: "المنصة",
    meta: "ميتا",
    tiktok: "تيك توك",
    snapchat: "سناب شات",
    google: "جوجل",
    other: "أخرى",
    emptyTitle: "لا يوجد إنفاق إعلاني مسجَّل في هذه الفترة",
    emptyDesc: "اكتب ما أنفقته على كل حملة، أو استورد ملف CSV من مدير الإعلانات. تُطابَق الطلبات عبر utm_campaign أو عبر ad_id في رابط الإعلان.",
    withoutSpendTitle: "حملات جلبت طلبات بلا إنفاق مسجَّل",
    withoutSpendDesc: "قيم utm_campaign هذه جلبت طلبات. أضف إنفاقها لترى عائدها الحقيقي.",
    urlTitle: "معاملات الرابط لإعلاناتك",
    urlDesc: "الصقها في خانة معاملات الرابط لكل إعلان حتى تُنسب الطلبات إلى الحملة باسمها.",
    day: "التاريخ",
    source: "الإدخال",
    manual: "يدوي",
    csv: "CSV",
    sync: "مزامنة",
    impressions: "مرات الظهور",
    clicks: "النقرات",
    noEntries: "لا توجد إدخالات إنفاق بعد.",
    deleted: "تم حذف الإدخال.",
    addTitle: "إضافة إنفاق إعلاني",
    addDesc: "مبلغ واحد لكل يوم وحملة. حفظ نفس اليوم والحملة مرة أخرى يستبدل المبلغ.",
    campaignName: "اسم الحملة",
    campaignHint: "كما هو في utm_campaign تمامًا",
    amount: "المبلغ المنفَق",
    invalidAmount: "أدخل مبلغًا صحيحًا",
    required: "مطلوب",
    saved: "تم حفظ الإنفاق.",
    importTitle: "استيراد الإنفاق الإعلاني",
    importDesc: "ملف CSV بالأعمدة: Date, Platform, Campaign name, Amount spent. والأعمدة Impressions و Clicks و Campaign ID و Ad ID اختيارية. الملف على مستوى الإعلان (فيه Ad ID) يُجمَع لكل حملة ويوم، وإعلاناته تربط الطلبات التي تحمل ad_id بحملتها.",
    chooseFile: "اختر ملف CSV",
    defaultPlatform: "المنصة (إذا لم يكن في الملف عمود للمنصة)",
    fromFile: "من الملف",
    check: "افحص الملف",
    importNow: "استورد {n} صفًا",
    checkResult: "{valid} من {rows} صفًا جاهزة — الإجمالي {total}.",
    rejected: "سيتم تخطي {n} صفًا:",
    line: "السطر {n}: {problems}",
    imported: "تم استيراد {created} جديدًا وتحديث {updated}.",
    fileTooBig: "الملف أكبر من 1 ميجابايت.",
    template: "مثال",
  },
} satisfies Messages;

type Tab = "campaigns" | "entries";
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Campaigns (SPEC §15.4): spend per campaign against real orders, the spend
 * entries behind it, manual entry and CSV import.
 */
export function AdsPage() {
  const t = useT(STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [tab, setTab] = useState<Tab>("campaigns");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);

  const window = rangeWindows(range).current;
  const report = useAsync(() => profitGetCampaigns(apiClient, workspaceId, window), [workspaceId, range]);
  const entries = useAsync(
    () => profitListAdSpend(apiClient, workspaceId, { from: window.from.slice(0, 10), to: window.to.slice(0, 10) }),
    [workspaceId, range]
  );
  const refresh = () => {
    void report.refresh({ silent: true });
    void entries.refresh({ silent: true });
  };

  const data = report.data;
  const currency = data?.currency ?? "EGP";
  const money = (v: number | null) => (v === null ? "—" : formatMoney(v, currency));
  const roas = (v: number | null) => (v === null ? "—" : `${v.toFixed(2)}×`);
  const num = (v: number | null) => <bdi dir="ltr">{formatCount(v)}</bdi>;

  const campaignColumns: Column<ProfitCampaign>[] = [
    {
      key: "name",
      header: t.campaign,
      cell: (c) => (
        <span>
          <span className="block font-medium text-ink" dir="auto">
            {c.campaignName}
          </span>
          <span className="text-xs text-ink-soft">{t[c.platform]}</span>
        </span>
      ),
    },
    { key: "spend", header: t.spend, align: "end", cell: (c) => <bdi dir="ltr">{money(c.spendAmount)}</bdi> },
    { key: "orders", header: t.orders, align: "end", cell: (c) => num(c.orders) },
    { key: "confirmed", header: t.confirmed, align: "end", cell: (c) => num(c.confirmed) },
    { key: "delivered", header: t.delivered, align: "end", cell: (c) => num(c.delivered) },
    { key: "sales", header: t.deliveredSales, align: "end", cell: (c) => <bdi dir="ltr">{money(c.deliveredSalesAmount)}</bdi> },
    { key: "cpa", header: t.realCpa, align: "end", cell: (c) => <bdi dir="ltr">{money(c.realCpa)}</bdi> },
    {
      key: "roas",
      header: t.realRoas,
      align: "end",
      cell: (c) => (
        <bdi dir="ltr" className={cn("font-medium", c.realRoas !== null && (c.realRoas >= 1 ? "text-success" : "text-danger"))}>
          {roas(c.realRoas)}
        </bdi>
      ),
    },
  ];

  const entryColumns: Column<ProfitAdSpendEntry>[] = [
    { key: "day", header: t.day, cell: (e) => formatDate(e.day) },
    { key: "platform", header: t.platform, cell: (e) => t[e.platform] },
    { key: "campaign", header: t.campaign, cell: (e) => <span dir="auto">{e.campaignName}</span> },
    { key: "spend", header: t.spend, align: "end", cell: (e) => <bdi dir="ltr">{money(e.spendAmount)}</bdi> },
    { key: "impressions", header: t.impressions, align: "end", cell: (e) => num(e.impressions) },
    { key: "clicks", header: t.clicks, align: "end", cell: (e) => num(e.clicks) },
    { key: "source", header: t.source, cell: (e) => <span className="text-ink-soft">{t[e.source]}</span> },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (e) => (
        <Button
          size="sm"
          variant="ghost"
          aria-label={`${t.deleted} ${e.campaignName}`}
          onClick={async () => {
            try {
              await profitDeleteAdSpend(apiClient, workspaceId, e.id);
              toast.success(t.deleted);
              refresh();
            } catch (err) {
              toast.error(getErrorMessage(err));
            }
          }}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      ),
    },
  ];

  const actions = (
    <>
      <Button variant="outline" size="sm" onClick={() => setImporting(true)}>
        <Upload className="size-4" aria-hidden />
        {t.importCsv}
      </Button>
      <Button size="sm" onClick={() => setAdding(true)}>
        <Plus className="size-4" aria-hidden />
        {t.addSpend}
      </Button>
    </>
  );

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader title={t.title} description={t.description} actions={actions} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <RangeSwitch value={range} onChange={setRange} />
        <FilterTabs
          label={t.tabsLabel}
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "campaigns", label: t.tabCampaigns },
            { value: "entries", label: t.tabEntries },
          ]}
        />
      </div>

      <DataState loading={report.loading && !data} error={report.error} onRetry={() => void report.refresh()}>
        {data && (
          <div className="space-y-4">
            {data.campaigns.length > 0 && (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard label={t.spend} value={<bdi dir="ltr">{money(data.totals.spendAmount)}</bdi>} />
                <KpiCard label={t.delivered} value={num(data.totals.delivered)} hint={`${formatCount(data.totals.orders)} ${t.orders}`} />
                <KpiCard label={t.realCpa} value={<bdi dir="ltr">{money(data.totals.realCpa)}</bdi>} hint={t.realCpaHint} />
                <KpiCard label={t.realRoas} value={<bdi dir="ltr">{roas(data.totals.realRoas)}</bdi>} hint={t.realRoasHint} />
              </div>
            )}

            {tab === "campaigns" ? (
              data.campaigns.length === 0 ? (
                <EmptyState icon={<Megaphone />} title={t.emptyTitle} description={t.emptyDesc} action={<div className="flex gap-2">{actions}</div>} />
              ) : (
                <Section title={t.tabCampaigns} flush>
                  <DataTable
                    columns={campaignColumns}
                    rows={data.campaigns}
                    rowKey={(c) => `${c.platform}:${c.campaignName}`}
                    minWidth="60rem"
                  />
                </Section>
              )
            ) : (
              <Section title={t.tabEntries} flush>
                <DataTable
                  columns={entryColumns}
                  rows={entries.data?.entries ?? []}
                  rowKey={(e) => e.id}
                  minWidth="52rem"
                  empty={<p className="px-4 pb-4 text-sm text-ink-soft">{t.noEntries}</p>}
                />
              </Section>
            )}

            {tab === "campaigns" && data.withoutSpend.length > 0 && (
              <Section title={t.withoutSpendTitle} description={t.withoutSpendDesc}>
                <ul className="divide-y divide-line text-sm">
                  {data.withoutSpend.map((c) => (
                    <li key={c.campaign} className="flex flex-wrap items-center justify-between gap-3 py-2">
                      <span className="font-medium text-ink" dir="ltr">
                        {c.campaign}
                      </span>
                      <span className="text-ink-soft">
                        {formatCount(c.orders)} {t.orders} · {formatCount(c.delivered)} {t.delivered} ·{" "}
                        <bdi dir="ltr">{money(c.salesAmount)}</bdi>
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {tab === "campaigns" && (
              <Section title={t.urlTitle} description={t.urlDesc}>
                <ul className="space-y-3">
                  {(["meta", "tiktok", "snapchat", "google"] as const).map((p) => (
                    <li key={p}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-ink">{t[p]}</span>
                        <CopyButton value={data.suggestedUrlParameters[p]} />
                      </div>
                      <code dir="ltr" className="mt-1 block overflow-x-auto rounded-lg bg-paper px-3 py-2 text-start text-xs text-ink-soft">
                        {data.suggestedUrlParameters[p]}
                      </code>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        )}
      </DataState>

      {adding && (
        <AddSpendModal
          workspaceId={workspaceId}
          currency={currency}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            refresh();
          }}
        />
      )}
      {importing && (
        <ImportModal
          workspaceId={workspaceId}
          onClose={() => setImporting(false)}
          onImported={() => {
            setImporting(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function PlatformSelect({
  id,
  value,
  onChange,
  emptyLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  emptyLabel?: string;
}) {
  const t = useT(STRINGS);
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {emptyLabel && <option value="">{emptyLabel}</option>}
      {PROFIT_AD_PLATFORMS.map((p) => (
        <option key={p} value={p}>
          {t[p]}
        </option>
      ))}
    </Select>
  );
}

function AddSpendModal({
  workspaceId,
  currency,
  onClose,
  onSaved,
}: {
  workspaceId: string;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const toast = useToast();
  const [day, setDay] = useState(today());
  const [platform, setPlatform] = useState<ProfitAdPlatform>("meta");
  const [campaignName, setCampaignName] = useState("");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<{ campaign?: string; amount?: string }>({});
  const [busy, setBusy] = useState(false);

  async function save() {
    const spendAmount = majorToMinor(amount);
    const next = {
      campaign: campaignName.trim() ? undefined : t.required,
      amount: Number.isFinite(spendAmount) && spendAmount >= 0 ? undefined : t.invalidAmount,
    };
    setErrors(next);
    if (next.campaign || next.amount || !day) return;
    setBusy(true);
    try {
      await profitAddAdSpend(apiClient, workspaceId, { day, platform, campaignName: campaignName.trim(), spendAmount });
      toast.success(t.saved);
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t.addTitle}
      description={t.addDesc}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {common.cancel}
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? common.saving : common.save}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label={t.day} type="date" required value={day} max={today()} onChange={(e) => setDay(e.target.value)} />
        <Field label={t.platform} required>
          {({ id }) => <PlatformSelect id={id} value={platform} onChange={(v) => setPlatform(v as ProfitAdPlatform)} />}
        </Field>
        <TextField
          label={t.campaignName}
          hint={t.campaignHint}
          required
          dir="ltr"
          value={campaignName}
          error={errors.campaign}
          onChange={(e) => setCampaignName(e.target.value)}
          className="sm:col-span-2"
        />
        <MoneyInput label={t.amount} required value={amount} onChange={setAmount} currency={currency} error={errors.amount} />
      </div>
    </Modal>
  );
}

function ImportModal({ workspaceId, onClose, onImported }: { workspaceId: string; onClose: () => void; onImported: () => void }) {
  const t = useT(STRINGS);
  const common = useCommon();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [platform, setPlatform] = useState("");
  const [check, setCheck] = useState<ProfitAdSpendImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCheck(null);
    setError(null);
    if (file.size > 1_000_000) return setError(t.fileTooBig);
    setFileName(file.name);
    setCsv(await file.text());
  }

  async function run(dryRun: boolean) {
    setBusy(true);
    setError(null);
    try {
      const result = await profitImportAdSpend(apiClient, workspaceId, {
        csv,
        defaultPlatform: (platform || undefined) as ProfitAdPlatform | undefined,
        dryRun,
      });
      if (dryRun) setCheck(result);
      else {
        toast.success(fmt(t.imported, { created: result.created, updated: result.updated }));
        onImported();
        return;
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
    setBusy(false);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t.importTitle}
      description={t.importDesc}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {common.cancel}
          </Button>
          {check && check.valid > 0 ? (
            <Button onClick={() => void run(false)} disabled={busy}>
              {fmt(t.importNow, { n: check.valid })}
            </Button>
          ) : (
            <Button onClick={() => void run(true)} disabled={busy || !csv}>
              {t.check}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-ink-soft">{t.template}</p>
          <code dir="ltr" className="mt-1 block overflow-x-auto whitespace-pre rounded-lg bg-paper px-3 py-2 text-start text-xs text-ink-soft">
            {"Date,Platform,Campaign name,Amount spent\n2026-10-01,meta,ramadan_sale,1250.50"}
          </code>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void onFile(e)} />
          <Button variant="outline" onClick={() => input.current?.click()}>
            <Upload className="size-4" aria-hidden />
            {t.chooseFile}
          </Button>
          {fileName && (
            <span className="truncate text-sm text-ink-soft" dir="ltr">
              {fileName}
            </span>
          )}
        </div>
        <Field label={t.defaultPlatform}>
          {({ id }) => (
            <PlatformSelect
              id={id}
              value={platform}
              emptyLabel={t.fromFile}
              onChange={(v) => {
                setPlatform(v);
                setCheck(null);
              }}
            />
          )}
        </Field>
        {error && <Alert variant="destructive">{error}</Alert>}
        {check && (
          <div className="rounded-lg border border-line p-3 text-sm">
            <p className="font-medium text-ink">
              {fmt(t.checkResult, { valid: check.valid, rows: check.rows, total: formatMoney(check.totalSpendAmount, check.currency) })}
            </p>
            {check.errorCount > 0 && (
              <>
                <p className="mt-2 text-danger">{fmt(t.rejected, { n: check.errorCount })}</p>
                <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-ink-soft">
                  {check.errors.map((e) => (
                    <li key={e.line} dir="ltr" className="text-start">
                      {fmt(t.line, { n: e.line, problems: e.problems.join(", ") })}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
