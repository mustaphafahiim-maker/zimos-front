import { useEffect, useId, useRef, useState } from "react";
import { Alert, Badge, Button } from "@store-builder/ui";
import {
  currenciesGet,
  currenciesRefreshRates,
  currenciesSave,
  currenciesSetBase,
  type CurrencySettings as Settings,
} from "@store-builder/api-client";
import { IconClose, IconRefresh } from "@/components/icons";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { SaveBar } from "@/components/SaveBar";
import { Select } from "@/components/Select";
import { SettingsGroup, SettingsRow, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { FIELD, PaneSkeleton } from "./sections/paneParts";

const STRINGS = {
  en: {
    title: "Currencies",
    description: "Your store sells and collects in its own currency. You can also show prices in other currencies for visitors from abroad.",
    base: "Store currency",
    baseLocked: "It can't be changed after the first order.",
    baseChange: "Change",
    baseNew: "New store currency",
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
    format: "How prices are written",
    symbol: "Currency symbol",
    symbolAuto: "As the language writes it",
    symbolBefore: "Before the amount",
    symbolAfter: "After the amount",
    decimals: "Decimals",
    decimalsAuto: "Only when needed",
    decimalsAlways: "Always",
    decimalsNever: "Never",
    rates: "Exchange rates",
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
    description: "متجرك بيبيع ويحصّل بعملته. وتقدر كمان تعرض الأسعار بعملات تانية للزوار من برّه.",
    base: "عملة المتجر",
    baseLocked: "مش بتتغيّر بعد أول أوردر.",
    baseChange: "غيّر",
    baseNew: "عملة المتجر الجديدة",
    baseHint: "لحد أول أوردر بس. منتجاتك وعروضك هتتحول لها بنفس الأرقام — راجع أسعارها بعد التغيير.",
    baseChanged: "عملة المتجر بقت {code}.",
    display: "العملات اللي العملاء بيشوفوها",
    add: "ضيف عملة",
    choose: "اختار…",
    none: "الأسعار بتتعرض بعملة المتجر بس.",
    rate: "1 {base} = {rate} {quote}",
    remove: "امسح {code}",
    autoConvert: "اعرض لكل زائر عملته لوحده",
    useAll: "اعرض كل العملات اللي ليها سعر صرف",
    format: "شكل كتابة الأسعار",
    symbol: "رمز العملة",
    symbolAuto: "زي ما اللغة بتكتبه",
    symbolBefore: "قبل المبلغ",
    symbolAfter: "بعد المبلغ",
    decimals: "الكسور العشرية",
    decimalsAuto: "لما نحتاجها بس",
    decimalsAlways: "دايمًا",
    decimalsNever: "أبدًا",
    rates: "أسعار الصرف",
    ratesAt: "آخر تحديث لأسعار الصرف {date}.",
    noRates: "أسعار الصرف لسه ما اتحمّلتش.",
    refresh: "حدّث الأسعار",
    refreshing: "بنحدّث…",
    sandbox: "دي أسعار صرف تجريبية مش أسعار السوق. الأسعار المحوَّلة للعرض بس — التحصيل دايمًا بعملة المتجر.",
    displayOnly: "الأسعار المحوَّلة للعرض بس — التحصيل دايمًا بعملة المتجر.",
    save: "حفظ",
    saved: "اتحفظت إعدادات العملات.",
  },
} satisfies Messages;

/**
 * Payments → Currencies (SPEC §11.5): the store's own currency (changed at
 * once, until the first order), the currencies shoppers can view prices in,
 * how prices are written, and the exchange rates. The display settings are
 * saved together from the save bar.
 */
export function CurrencySettings({ workspaceId, canManage }: { workspaceId: string; canManage: boolean }) {
  const t = useT(STRINGS);
  const toast = useToast();
  const baseId = useId();
  const addId = useId();
  const symbolId = useId();
  const decimalsId = useId();
  const state = useAsync(() => currenciesGet(apiClient, workspaceId), [workspaceId]);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [busy, setBusy] = useState<"save" | "refresh" | "base" | null>(null);
  const [nextBase, setNextBase] = useState("");
  // Fresh rates must not wipe edits that are not saved yet.
  const keepDraft = useRef(false);

  useEffect(() => {
    if (!state.data) return;
    if (keepDraft.current) {
      keepDraft.current = false;
      return;
    }
    setDraft(state.data.settings);
  }, [state.data]);

  const data = state.data;
  const dirty = data !== null && draft !== null && JSON.stringify(draft) !== JSON.stringify(data.settings);
  useReportDirty(dirty);

  async function run(kind: "save" | "refresh") {
    if (!draft) return;
    setBusy(kind);
    try {
      if (kind === "save") {
        state.setData(await currenciesSave(apiClient, workspaceId, draft));
        toast.success(t.saved);
      } else {
        const next = await currenciesRefreshRates(apiClient, workspaceId);
        keepDraft.current = dirty;
        state.setData(next);
      }
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
      const next = await currenciesSetBase(apiClient, workspaceId, nextBase);
      keepDraft.current = dirty;
      state.setData(next);
      toast.success(fmt(t.baseChanged, { code: nextBase }));
      setNextBase("");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <DataState loading={state.loading} error={state.error} onRetry={() => void state.refresh()} skeleton={<PaneSkeleton rows={5} />}>
      {data && draft && (
        <>
          <SettingsGroup>
            <SettingsRow
              label={t.base}
              hint={data.baseCurrencyLocked ? t.baseLocked : canManage ? t.baseHint : undefined}
              control={<Badge variant="secondary">{data.baseCurrency}</Badge>}
            />
            {!data.baseCurrencyLocked && canManage && (
              <SettingsRow
                label={t.baseNew}
                htmlFor={baseId}
                control={
                  <div className="flex items-center gap-2">
                    <Select
                      id={baseId}
                      value={nextBase}
                      onChange={(e) => setNextBase(e.target.value)}
                      className={`${FIELD} w-auto min-w-28`}
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
                    <Button
                      variant="outline"
                      className="min-h-11 rounded-full px-4"
                      disabled={!nextBase || busy !== null}
                      onClick={() => void changeBase()}
                    >
                      {t.baseChange}
                    </Button>
                  </div>
                }
              />
            )}
          </SettingsGroup>

          <SettingsGroup>
            <SettingsRow
              label={t.display}
              hint={draft.display.length === 0 ? t.none : undefined}
              stacked
              control={
                <CurrencyChips
                  codes={draft.display}
                  base={data.baseCurrency}
                  rates={data.rates}
                  canManage={canManage}
                  onRemove={(code) => setDraft({ ...draft, display: draft.display.filter((c) => c !== code) })}
                />
              }
            />
            {canManage && <AddCurrencyRow id={addId} draft={draft} data={data} onAdd={(code) => setDraft({ ...draft, display: [...draft.display, code] })} />}
            <SettingsSwitch
              label={t.autoConvert}
              checked={draft.autoConvert}
              disabled={!canManage}
              onChange={(v) => setDraft({ ...draft, autoConvert: v })}
            />
            <SettingsSwitch label={t.useAll} checked={draft.useAll} disabled={!canManage} onChange={(v) => setDraft({ ...draft, useAll: v })} />
          </SettingsGroup>

          <SettingsGroup title={t.format}>
            <SettingsRow
              label={t.symbol}
              htmlFor={symbolId}
              control={
                <Select
                  id={symbolId}
                  className={FIELD}
                  value={draft.symbolPosition}
                  disabled={!canManage}
                  onChange={(e) => setDraft({ ...draft, symbolPosition: e.target.value as Settings["symbolPosition"] })}
                >
                  <option value="auto">{t.symbolAuto}</option>
                  <option value="before">{t.symbolBefore}</option>
                  <option value="after">{t.symbolAfter}</option>
                </Select>
              }
            />
            <SettingsRow
              label={t.decimals}
              htmlFor={decimalsId}
              control={
                <Select
                  id={decimalsId}
                  className={FIELD}
                  value={draft.decimals}
                  disabled={!canManage}
                  onChange={(e) => setDraft({ ...draft, decimals: e.target.value as Settings["decimals"] })}
                >
                  <option value="auto">{t.decimalsAuto}</option>
                  <option value="always">{t.decimalsAlways}</option>
                  <option value="never">{t.decimalsNever}</option>
                </Select>
              }
            />
          </SettingsGroup>

          <SettingsGroup>
            <SettingsRow
              label={t.rates}
              hint={data.ratesFetchedAt ? fmt(t.ratesAt, { date: formatDateTime(data.ratesFetchedAt) }) : t.noRates}
              control={
                canManage ? (
                  <Button variant="outline" className="min-h-11 rounded-full px-4" disabled={busy !== null} onClick={() => void run("refresh")}>
                    <IconRefresh className="size-4" aria-hidden />
                    {busy === "refresh" ? t.refreshing : t.refresh}
                  </Button>
                ) : null
              }
            />
          </SettingsGroup>

          <Alert variant="info" className="text-sm">
            {data.provider === "sandbox" ? t.sandbox : t.displayOnly}
          </Alert>

          {canManage && (
            <SaveBar
              dirty={dirty}
              saving={busy === "save"}
              disabled={busy !== null}
              onSave={() => void run("save")}
              onDiscard={() => setDraft(data.settings)}
              saveLabel={t.save}
            />
          )}
        </>
      )}
    </DataState>
  );
}

/** The display currencies as chips: the code, its rate, and a cross to take it off the list. */
function CurrencyChips({
  codes,
  base,
  rates,
  canManage,
  onRemove,
}: {
  codes: string[];
  base: string;
  rates: Record<string, number>;
  canManage: boolean;
  onRemove: (code: string) => void;
}) {
  const t = useT(STRINGS);
  if (codes.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {codes.map((code) => {
        const rate = rates[code];
        return (
          <li key={code} className="flex min-h-11 items-center gap-2 rounded-full border border-line ps-3.5 pe-1 text-sm">
            <span className="font-medium text-ink">{code}</span>
            {rate !== undefined && (
              <bdi dir="ltr" className="text-xs text-ink-soft">
                {fmt(t.rate, { base, rate: Number(rate.toFixed(4)), quote: code })}
              </bdi>
            )}
            {canManage ? (
              <button
                type="button"
                aria-label={fmt(t.remove, { code })}
                className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-primary"
                onClick={() => onRemove(code)}
              >
                <IconClose className="size-4" aria-hidden />
              </button>
            ) : (
              <span className="w-2" aria-hidden />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function AddCurrencyRow({
  id,
  draft,
  data,
  onAdd,
}: {
  id: string;
  draft: Settings;
  data: { baseCurrency: string; availableCurrencies: string[] };
  onAdd: (code: string) => void;
}) {
  const t = useT(STRINGS);
  const addable = data.availableCurrencies.filter((c) => c !== data.baseCurrency && !draft.display.includes(c));
  if (addable.length === 0) return null;
  return (
    <SettingsRow
      label={t.add}
      htmlFor={id}
      control={
        <Select id={id} className={`${FIELD} w-auto min-w-28`} value="" onChange={(e) => e.target.value && onAdd(e.target.value)}>
          <option value="">{t.choose}</option>
          {addable.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      }
    />
  );
}
