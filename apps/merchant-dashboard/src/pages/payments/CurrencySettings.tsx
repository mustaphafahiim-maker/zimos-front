import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent } from "@store-builder/ui";
import { currenciesGet, currenciesRefreshRates, currenciesSave, currenciesSetBase, type CurrencySettings as Settings } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Currencies",
    description: "Your store sells and collects in its own currency. You can also show prices in other currencies for visitors from abroad.",
    base: "Store currency",
    baseLocked: "It can't be changed after the first order.",
    baseChange: "Change",
    baseHint: "Until your first order. Your products and offers move to it with the same amounts — check their prices after.",
    baseChanged: "Store currency changed to {code}.",
    display: "Currencies shown to shoppers",
    add: "Add a currency",
    choose: "Choose…",
    none: "Prices are shown in the store currency only.",
    rate: "1 {base} = {rate} {quote}",
    remove: "Remove {code}",
    autoConvert: "Show each visitor their own currency automatically",
    useAll: "Offer every currency that has an exchange rate",
    symbol: "Currency symbol",
    symbolAuto: "As the language writes it",
    symbolBefore: "Before the amount",
    symbolAfter: "After the amount",
    decimals: "Decimals",
    decimalsAuto: "Only when needed",
    decimalsAlways: "Always",
    decimalsNever: "Never",
    ratesAt: "Exchange rates updated {date}.",
    noRates: "Exchange rates have not been loaded yet.",
    refresh: "Update rates",
    refreshing: "Updating…",
    sandbox: "These are test exchange rates, not market rates. Converted prices are for display only — orders are always collected in the store currency.",
    displayOnly: "Converted prices are for display only — orders are always collected in the store currency.",
    save: "Save",
    saved: "Currency settings saved.",
  },
  ar: {
    title: "العملات",
    description: "متجرك يبيع ويحصّل بعملته. ويمكنك أيضًا عرض الأسعار بعملات أخرى للزوار من الخارج.",
    base: "عملة المتجر",
    baseLocked: "لا يمكن تغييرها بعد أول طلب.",
    baseChange: "غيّر",
    baseHint: "لحد أول طلب بس. منتجاتك وعروضك هتتحول لها بنفس الأرقام — راجع أسعارها بعد التغيير.",
    baseChanged: "عملة المتجر بقت {code}.",
    display: "العملات المعروضة للمتسوقين",
    add: "أضف عملة",
    choose: "اختر…",
    none: "الأسعار تُعرض بعملة المتجر فقط.",
    rate: "1 {base} = {rate} {quote}",
    remove: "حذف {code}",
    autoConvert: "اعرض لكل زائر عملته تلقائيًا",
    useAll: "اعرض كل العملات التي لها سعر صرف",
    symbol: "رمز العملة",
    symbolAuto: "كما تكتبه اللغة",
    symbolBefore: "قبل المبلغ",
    symbolAfter: "بعد المبلغ",
    decimals: "الكسور العشرية",
    decimalsAuto: "عند الحاجة فقط",
    decimalsAlways: "دائمًا",
    decimalsNever: "أبدًا",
    ratesAt: "آخر تحديث لأسعار الصرف {date}.",
    noRates: "لم تُحمَّل أسعار الصرف بعد.",
    refresh: "حدّث الأسعار",
    refreshing: "بنحدّث…",
    sandbox: "هذه أسعار صرف تجريبية وليست أسعار السوق. الأسعار المحوَّلة للعرض فقط — التحصيل دائمًا بعملة المتجر.",
    displayOnly: "الأسعار المحوَّلة للعرض فقط — التحصيل دائمًا بعملة المتجر.",
    save: "حفظ",
    saved: "تم حفظ إعدادات العملات.",
  },
} satisfies Messages;

/** Display currencies and exchange rates (SPEC §11.5), on the Payments page. */
export function CurrencySettings({ workspaceId, canManage }: { workspaceId: string; canManage: boolean }) {
  const t = useT(STRINGS);
  const common = useCommon();
  const toast = useToast();
  const state = useAsync(() => currenciesGet(apiClient, workspaceId).catch(() => null), [workspaceId]);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [busy, setBusy] = useState<"save" | "refresh" | "base" | null>(null);
  const [nextBase, setNextBase] = useState("");

  useEffect(() => {
    if (state.data) setDraft(state.data.settings);
  }, [state.data]);

  const data = state.data;
  if (!data || !draft) return null;
  const addable = data.availableCurrencies.filter((c) => c !== data.baseCurrency && !draft.display.includes(c));

  async function run(kind: "save" | "refresh") {
    if (!draft) return;
    setBusy(kind);
    try {
      state.setData(kind === "save" ? await currenciesSave(apiClient, workspaceId, draft) : await currenciesRefreshRates(apiClient, workspaceId));
      if (kind === "save") toast.success(t.saved);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function changeBase() {
    if (!nextBase) return;
    setBusy("base");
    try {
      state.setData(await currenciesSetBase(apiClient, workspaceId, nextBase));
      toast.success(fmt(t.baseChanged, { code: nextBase }));
      setNextBase("");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const check = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
    <label className="flex min-h-9 items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        className="size-4 accent-[var(--color-primary)]"
        checked={checked}
        disabled={!canManage}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
      </div>
      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-ink-soft">{t.base}</span>
            <Badge variant="secondary">{data.baseCurrency}</Badge>
            {data.baseCurrencyLocked && <span className="text-xs text-ink-soft">{t.baseLocked}</span>}
            {!data.baseCurrencyLocked && canManage && (
              <>
                <Select
                  aria-label={t.base}
                  value={nextBase}
                  onChange={(e) => setNextBase(e.target.value)}
                  className="w-auto min-w-28"
                  disabled={busy !== null}
                >
                  <option value="">{t.choose}</option>
                  {data.availableCurrencies
                    .filter((c) => c !== data.baseCurrency)
                    .map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                </Select>
                <Button size="sm" variant="outline" disabled={!nextBase || busy !== null} onClick={() => void changeBase()}>
                  {t.baseChange}
                </Button>
              </>
            )}
          </div>
          {!data.baseCurrencyLocked && canManage && <p className="-mt-3 text-xs text-ink-soft">{t.baseHint}</p>}

          <div>
            <p className="mb-2 text-sm font-medium text-ink">{t.display}</p>
            {draft.display.length === 0 ? (
              <p className="text-sm text-ink-soft">{t.none}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {draft.display.map((code) => (
                  <li key={code} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm">
                    <span className="font-medium text-ink">{code}</span>
                    {data.rates[code] !== undefined && (
                      <bdi dir="ltr" className="text-xs text-ink-soft">
                        {fmt(t.rate, { base: data.baseCurrency, rate: Number(data.rates[code].toFixed(4)), quote: code })}
                      </bdi>
                    )}
                    {canManage && (
                      <button
                        type="button"
                        aria-label={fmt(t.remove, { code })}
                        className="text-ink-soft hover:text-danger"
                        onClick={() => setDraft({ ...draft, display: draft.display.filter((c) => c !== code) })}
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canManage && addable.length > 0 && (
              <Select
                aria-label={t.add}
                className="mt-3 h-9 w-auto"
                value=""
                onChange={(e) => e.target.value && setDraft({ ...draft, display: [...draft.display, e.target.value] })}
              >
                <option value="">{t.add}</option>
                {addable.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {check(t.autoConvert, draft.autoConvert, (v) => setDraft({ ...draft, autoConvert: v }))}
            {check(t.useAll, draft.useAll, (v) => setDraft({ ...draft, useAll: v }))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t.symbol}>
              {({ id }) => (
                <Select
                  id={id}
                  value={draft.symbolPosition}
                  disabled={!canManage}
                  onChange={(e) => setDraft({ ...draft, symbolPosition: e.target.value as Settings["symbolPosition"] })}
                >
                  <option value="auto">{t.symbolAuto}</option>
                  <option value="before">{t.symbolBefore}</option>
                  <option value="after">{t.symbolAfter}</option>
                </Select>
              )}
            </Field>
            <Field label={t.decimals}>
              {({ id }) => (
                <Select
                  id={id}
                  value={draft.decimals}
                  disabled={!canManage}
                  onChange={(e) => setDraft({ ...draft, decimals: e.target.value as Settings["decimals"] })}
                >
                  <option value="auto">{t.decimalsAuto}</option>
                  <option value="always">{t.decimalsAlways}</option>
                  <option value="never">{t.decimalsNever}</option>
                </Select>
              )}
            </Field>
          </div>

          <Alert variant="info" className="text-sm">
            {data.provider === "sandbox" ? t.sandbox : t.displayOnly}
          </Alert>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-ink-soft">
              {data.ratesFetchedAt ? fmt(t.ratesAt, { date: formatDateTime(data.ratesFetchedAt) }) : t.noRates}
            </span>
            {canManage && (
              <div className="flex gap-2">
                <Button variant="outline" disabled={busy !== null} onClick={() => void run("refresh")}>
                  <RefreshCw className="size-4" aria-hidden />
                  {busy === "refresh" ? t.refreshing : t.refresh}
                </Button>
                <Button disabled={busy !== null} onClick={() => void run("save")}>
                  {busy === "save" ? common.saving : t.save}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
