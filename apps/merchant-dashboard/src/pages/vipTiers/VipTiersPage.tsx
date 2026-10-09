import { useEffect, useId, useState, type FormEvent } from "react";
import { IconCoins, IconCrown, IconCustomers, IconDelete, IconOrders, IconPlus } from "@/components/icons";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  VIP_LIMITS,
  loyaltyGet,
  shopperAccountsGet,
  vipTierName,
  vipTiersGet,
  vipTiersSave,
  type VipBasis,
  type VipSettings,
  type VipSettingsPayload,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { fmt, getIntlLocale, useT } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { AccordionGroup, AccordionSection } from "@/components/Accordion";
import { EmptyState } from "@/components/EmptyState";
import { Segmented } from "@/components/Segmented";
import { SettingsGroup, SettingsLinkRow, SettingsRow, SettingsSwitch } from "@/components/settings";
import { Field, TextField } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { SaveBar } from "@/components/SaveBar";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { InlineSwitch, NumberControl, ProgrammeExample, ProgrammeNote, ProgrammeSkeleton, focusFirstInvalid } from "@/pages/loyalty/programmeKit";
import { RewardsTabs, REWARDS_PATHS } from "@/pages/loyalty/RewardsTabs";
import { parseWhole, toAsciiDigits } from "@/pages/loyalty/loyaltyStrings";
import { vipPerksText } from "./vipPerks";
import { VIP_STRINGS } from "./vipTierStrings";

interface TierDraft {
  key: string;
  /** The API's id of a saved tier; a new one has none yet. */
  id?: string;
  nameAr: string;
  nameEn: string;
  /** The threshold as an amount, and as a number of orders: each basis keeps its own, so switching back loses nothing. */
  spent: string;
  orders: string;
  percentOff: string;
  freeShipping: boolean;
  multiplier: string;
}

interface Draft {
  enabled: boolean;
  basis: VipBasis;
  window: string;
  tiers: TierDraft[];
}

type TierErrors = Record<string, { name?: string; threshold?: string; percent?: string }>;

let nextKey = 1;
const newKey = () => `tier-${nextKey++}`;

const MULTIPLIERS = [1, 1.5, 2, 2.5, 3, 4, 5];
/** What a new tier is called until the merchant names it: the usual ladder. */
const STARTER_NAMES: ReadonlyArray<{ ar: string; en: string }> = [
  { ar: "برونزي", en: "Bronze" },
  { ar: "فضي", en: "Silver" },
  { ar: "ذهبي", en: "Gold" },
  { ar: "بلاتيني", en: "Platinum" },
  { ar: "ماسي", en: "Diamond" },
  { ar: "النخبة", en: "Elite" },
];

function toDraft(settings: VipSettings): Draft {
  return {
    enabled: settings.enabled,
    basis: settings.basis,
    window: settings.windowDays === null ? "" : String(settings.windowDays),
    tiers: settings.tiers.map((tier) => ({
      key: newKey(),
      id: tier.id,
      nameAr: tier.name?.ar ?? "",
      nameEn: tier.name?.en ?? "",
      spent: settings.basis === "spent" ? minorToMajorInput(tier.threshold) : "",
      orders: settings.basis === "orders" ? String(tier.threshold) : "",
      percentOff: tier.percentOff ? String(tier.percentOff) : "",
      freeShipping: Boolean(tier.freeShipping),
      multiplier: String(tier.pointsMultiplier ?? 1),
    })),
  };
}

/** A draft without its rows' own keys and the other basis's numbers, to tell an edited form from the saved one. */
const fingerprint = (d: Draft) =>
  JSON.stringify([
    d.enabled,
    d.basis,
    d.window.trim(),
    d.tiers.map((tier) => [tier.id ?? "", tier.nameAr.trim(), tier.nameEn.trim(), (d.basis === "spent" ? tier.spent : tier.orders).trim(), tier.percentOff.trim(), tier.freeShipping, tier.multiplier]),
  ]);

/** A tier's threshold as the API takes it — minor units or a count of orders — or null. */
function parseThreshold(tier: TierDraft, basis: VipBasis): number | null {
  if (basis === "orders") return parseWhole(tier.orders, 1, 1_000_000_000);
  const ascii = toAsciiDigits(tier.spent);
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(ascii)) return null;
  const minor = majorToMinor(ascii);
  return Number.isFinite(minor) && minor >= 1 && minor <= VIP_LIMITS.thresholdMax ? minor : null;
}

/** "" reads as no discount. */
const parsePercent = (raw: string) => (toAsciiDigits(raw) === "" ? 0 : parseWhole(raw, 0, VIP_LIMITS.percentMax));

const NUMBER_INPUT = "h-11 w-24 text-center text-base tabular-nums md:text-sm";
const TEXT_INPUT = "[&_input]:h-11 [&_input]:text-base md:[&_input]:text-sm";

/**
 * Customers → Loyalty & rewards → VIP tiers (handoff 218; GET customers.view,
 * PUT discounts.manage): whether customers move up by what they spent or by
 * how many orders, over how long, and the tiers with what each one gives.
 *
 * The switch and the way up are settings groups. Each tier is a section that
 * folds to one line — its name, where it starts and what it gives — so six
 * tiers still fit a phone; a tier with a problem opens by itself on save.
 */
export function VipTiersPage() {
  const t = useT(VIP_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const phone = useIsPhone();
  const formId = useId();

  const settings = useAsync(() => vipTiersGet(apiClient, workspaceId), [workspaceId]);
  // Perks need a signed-in shopper, and the multiplier needs the points programme: say so when either is off.
  // A role that may not read those settings simply sees no hint.
  const accounts = useAsync(() => shopperAccountsGet(apiClient, workspaceId).catch(() => null), [workspaceId]);
  const loyalty = useAsync(() => loyaltyGet(apiClient, workspaceId).catch(() => null), [workspaceId]);

  const [saved, setSaved] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [windowError, setWindowError] = useState<string | null>(null);
  const [tierErrors, setTierErrors] = useState<TierErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // The tiers that are unfolded, by their row key. A saved tier starts folded; a new one starts open.
  const [openTiers, setOpenTiers] = useState<ReadonlySet<string>>(() => new Set());

  const data = settings.data;
  // The form starts from what is saved, and again after each save.
  useEffect(() => {
    if (!data) return;
    const next = toDraft(data);
    setSaved(next);
    setDraft(next);
    setOpenTiers(new Set());
  }, [data]);

  const dirty = Boolean(draft && saved && fingerprint(draft) !== fingerprint(saved));
  // Leaving the page with a change not saved asks first.
  useReportDirty(dirty);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setFailure(null);
    if (key === "window") setWindowError(null);
    if (key === "basis") setTierErrors({});
  }

  function patchTier(key: string, change: Partial<TierDraft>) {
    setDraft((d) => (d ? { ...d, tiers: d.tiers.map((tier) => (tier.key === key ? { ...tier, ...change } : tier)) } : d));
    setFailure(null);
    setTierErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function setTierOpen(key: string, open: boolean) {
    setOpenTiers((prev) => {
      const next = new Set(prev);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function addTier() {
    if (!draft || draft.tiers.length >= VIP_LIMITS.tiersMax) return;
    const name = STARTER_NAMES[draft.tiers.length] ?? { ar: "", en: "" };
    const key = newKey();
    setDraft((d) => (d ? { ...d, tiers: [...d.tiers, { key, nameAr: name.ar, nameEn: name.en, spent: "", orders: "", percentOff: "", freeShipping: false, multiplier: "1" }] } : d));
    setTierOpen(key, true);
    setFailure(null);
  }

  /** Takes a tier out of the draft at once; the toast puts it back where it was. Nothing is saved until Save. */
  function removeTier(tier: TierDraft, index: number, name: string) {
    setDraft((d) => (d ? { ...d, tiers: d.tiers.filter((other) => other.key !== tier.key) } : d));
    setFailure(null);
    toast.undo(fmt(t.tierRemoved, { name }), () => {
      setDraft((d) => {
        if (!d || d.tiers.some((other) => other.key === tier.key)) return d;
        const tiers = [...d.tiers];
        tiers.splice(Math.min(index, tiers.length), 0, tier);
        return { ...d, tiers };
      });
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft || saving) return;
    const noWindow = toAsciiDigits(draft.window) === "";
    const windowDays = noWindow ? null : parseWhole(draft.window, VIP_LIMITS.windowMin, VIP_LIMITS.windowMax);
    const windowProblem = !noWindow && windowDays === null ? t.windowError : null;

    const found: TierErrors = {};
    const seen = new Set<number>();
    const tiers: VipSettingsPayload["tiers"] = [];
    for (const tier of draft.tiers) {
      const problems: TierErrors[string] = {};
      const ar = tier.nameAr.trim();
      const en = tier.nameEn.trim();
      if (!ar && !en) problems.name = t.nameError;
      const threshold = parseThreshold(tier, draft.basis);
      if (threshold === null) problems.threshold = draft.basis === "spent" ? t.thresholdSpentError : t.thresholdOrdersError;
      else if (seen.has(threshold)) problems.threshold = t.thresholdDuplicate;
      else seen.add(threshold);
      const percentOff = parsePercent(tier.percentOff);
      if (percentOff === null) problems.percent = t.percentError;
      if (problems.name || problems.threshold || problems.percent) found[tier.key] = problems;
      tiers.push({
        ...(tier.id ? { id: tier.id } : {}),
        name: { ar, en },
        threshold: threshold ?? 0,
        percentOff: percentOff ?? 0,
        freeShipping: tier.freeShipping,
        pointsMultiplier: Number(tier.multiplier) || 1,
      });
    }
    const noTiers = draft.enabled && draft.tiers.length === 0;

    setWindowError(windowProblem);
    setTierErrors(found);
    if (windowProblem || Object.keys(found).length > 0 || noTiers) {
      setFailure(noTiers ? t.tiersRequired : t.fixFields);
      // A tier with a problem unfolds, then the first field at fault comes into view and takes the focus.
      setOpenTiers((prev) => new Set([...prev, ...Object.keys(found)]));
      window.requestAnimationFrame(() => focusFirstInvalid(document.getElementById(formId)));
      return;
    }

    setSaving(true);
    setFailure(null);
    try {
      const next = await vipTiersSave(apiClient, workspaceId, { enabled: draft.enabled, basis: draft.basis, windowDays, tiers });
      settings.setData(next);
      toast.success(next.enabled ? t.savedOn : draft.enabled !== saved?.enabled ? t.savedOff : t.saved);
    } catch (err) {
      setFailure(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const badge = data ? (
    data.enabled ? (
      <StatusBadge value="active" tone="success" text={t.stateOn} />
    ) : (
      <StatusBadge value="disabled" tone="neutral" text={t.stateOff} />
    )
  ) : undefined;

  const liveWindow = draft ? parseWhole(draft.window, VIP_LIMITS.windowMin, VIP_LIMITS.windowMax) : null;
  const windowText = liveWindow ? fmt(t.summaryWindow, { days: countOf("day", liveWindow) }) : "";
  const multiplies = Boolean(draft?.tiers.some((tier) => Number(tier.multiplier) > 1));
  const full = Boolean(draft && draft.tiers.length >= VIP_LIMITS.tiersMax);

  const addButton = (
    <Button type="button" variant="outline" className="min-h-11 gap-2 rounded-full px-5" disabled={saving || full} onClick={addTier}>
      <IconPlus className="size-4" weight="bold" aria-hidden />
      {t.addTier}
    </Button>
  );

  return (
    <div>
      {/* A phone keeps the first screen for the switch and the tiers: the sentence is said by the first group. */}
      <PageHeader title={t.title} description={phone ? undefined : t.description} titleBadge={badge} />
      <RewardsTabs active="vip" />

      <DataState loading={settings.loading} error={settings.error} onRetry={() => void settings.refresh()} skeleton={<ProgrammeSkeleton groups={[1, 2, 3]} />}>
        {data && draft && (
          <form id={formId} onSubmit={submit} noValidate className="max-w-3xl space-y-5">
            {accounts.data && !accounts.data.enabled && (data.enabled || draft.enabled) && (
              <ProgrammeNote to="/store-settings/customer-accounts" action={t.accountsOffAction}>
                {t.accountsOff}
              </ProgrammeNote>
            )}

            <SettingsGroup description={phone ? t.customerGets : undefined}>
              <SettingsSwitch
                checked={draft.enabled}
                onChange={(next) => set("enabled", next)}
                label={t.enable}
                hint={draft.enabled ? t.enableHintOn : t.enableHintOff}
                disabled={saving}
              />
            </SettingsGroup>

            <SettingsGroup title={t.settingsTitle}>
              <SettingsRow
                label={t.basis}
                hint={draft.basis === "spent" ? t.basisSpentHint : t.basisOrdersHint}
                stacked
                control={
                  <Segmented
                    label={t.basis}
                    value={draft.basis}
                    onChange={(next) => set("basis", next)}
                    options={[
                      { value: "spent", label: t.basisSpent, icon: IconCoins },
                      { value: "orders", label: t.basisOrders, icon: IconOrders },
                    ]}
                  />
                }
              />
              <SettingsRow
                label={t.window}
                hint={t.windowHint}
                htmlFor={`${formId}-window`}
                error={windowError ?? undefined}
                control={
                  <NumberControl
                    id={`${formId}-window`}
                    maxLength={4}
                    placeholder="365"
                    value={draft.window}
                    disabled={saving}
                    invalid={Boolean(windowError)}
                    unit={t.windowUnit}
                    onChange={(v) => set("window", v)}
                  />
                }
              />
            </SettingsGroup>

            <section aria-labelledby={`${formId}-tiers`} className="space-y-3">
              <div className="px-4">
                <h2 id={`${formId}-tiers`} className="text-[13px] leading-5 font-semibold text-ink-soft">
                  {t.tiersTitle}
                </h2>
                <p className="mt-0.5 text-[13px] leading-5 text-ink-soft">{fmt(t.tiersHint, { max: VIP_LIMITS.tiersMax })}</p>
              </div>

              {draft.tiers.length === 0 ? (
                <EmptyState icon={<IconCrown aria-hidden />} title={t.tiersTitle} description={t.noTiers} action={addButton} />
              ) : (
                <AccordionGroup>
                  {draft.tiers.map((tier, index) => {
                    const problems = tierErrors[tier.key];
                    const threshold = parseThreshold(tier, draft.basis);
                    const percentOff = parsePercent(tier.percentOff);
                    const perks = vipPerksText({ percentOff: percentOff ?? 0, freeShipping: tier.freeShipping, pointsMultiplier: Number(tier.multiplier) || 1 }, t) || t.perkNone;
                    const multipliers = MULTIPLIERS.includes(Number(tier.multiplier)) ? MULTIPLIERS : [...MULTIPLIERS, Number(tier.multiplier)].sort((a, b) => a - b);
                    const name = vipTierName({ ar: tier.nameAr, en: tier.nameEn }, getIntlLocale()) || fmt(t.tierN, { n: index + 1 });
                    const summary =
                      threshold === null
                        ? t.tierNoThreshold
                        : draft.basis === "spent"
                          ? fmt(t.tierSummarySpent, { amount: formatMoney(threshold, currency), perks })
                          : fmt(t.tierSummaryOrders, { orders: countOf("order", threshold), perks });
                    return (
                      <AccordionSection
                        key={tier.key}
                        title={name}
                        summary={summary}
                        icon={IconCrown}
                        badge={problems ? <StatusBadge value="failed" tone="danger" text={t.tierNeedsFix} /> : undefined}
                        open={openTiers.has(tier.key)}
                        onOpenChange={(open) => setTierOpen(tier.key, open)}
                        // A folded tier keeps what was typed in it.
                        keepMounted
                        actions={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-11 shrink-0 rounded-full text-ink-soft hover:text-danger"
                            disabled={saving}
                            aria-label={fmt(t.removeTier, { n: index + 1 })}
                            title={fmt(t.removeTier, { n: index + 1 })}
                            onClick={() => removeTier(tier, index, name)}
                          >
                            <IconDelete className="size-5" aria-hidden />
                          </Button>
                        }
                      >
                        <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
                          <TextField
                            label={t.nameAr}
                            dir="rtl"
                            lang="ar"
                            autoComplete="off"
                            maxLength={VIP_LIMITS.nameMax}
                            value={tier.nameAr}
                            disabled={saving}
                            onChange={(e) => patchTier(tier.key, { nameAr: e.target.value })}
                            error={problems?.name}
                            className={TEXT_INPUT}
                          />
                          <TextField
                            label={t.nameEn}
                            dir="ltr"
                            lang="en"
                            autoComplete="off"
                            maxLength={VIP_LIMITS.nameMax}
                            value={tier.nameEn}
                            disabled={saving}
                            onChange={(e) => patchTier(tier.key, { nameEn: e.target.value })}
                            className={TEXT_INPUT}
                          />
                          {draft.basis === "spent" ? (
                            <MoneyInput
                              label={t.thresholdSpent}
                              required
                              currency={currency}
                              value={tier.spent}
                              disabled={saving}
                              onChange={(value) => patchTier(tier.key, { spent: value })}
                              error={problems?.threshold}
                              className={TEXT_INPUT}
                            />
                          ) : (
                            <Field label={t.thresholdOrders} required error={problems?.threshold}>
                              {(props) => (
                                <Input
                                  {...props}
                                  type="text"
                                  inputMode="numeric"
                                  dir="ltr"
                                  autoComplete="off"
                                  maxLength={6}
                                  placeholder="3"
                                  value={tier.orders}
                                  disabled={saving}
                                  onChange={(e) => patchTier(tier.key, { orders: e.target.value })}
                                  className={NUMBER_INPUT}
                                />
                              )}
                            </Field>
                          )}
                          <Field label={t.percentOff} error={problems?.percent} hint={t.percentHint}>
                            {(props) => (
                              <div className="flex items-center gap-2">
                                <Input
                                  {...props}
                                  type="text"
                                  inputMode="numeric"
                                  dir="ltr"
                                  autoComplete="off"
                                  maxLength={2}
                                  placeholder="0"
                                  value={tier.percentOff}
                                  disabled={saving}
                                  onChange={(e) => patchTier(tier.key, { percentOff: e.target.value })}
                                  className={NUMBER_INPUT}
                                />
                                <span aria-hidden className="text-sm text-ink-soft">
                                  {t.percentUnit}
                                </span>
                              </div>
                            )}
                          </Field>
                          <Field label={t.multiplier} hint={t.multiplierHint}>
                            {(props) => (
                              <Select
                                {...props}
                                value={tier.multiplier}
                                disabled={saving}
                                onChange={(e) => patchTier(tier.key, { multiplier: e.target.value })}
                                className="h-11 text-base md:text-sm"
                              >
                                {multipliers.map((n) => (
                                  <option key={n} value={String(n)}>
                                    {n === 1 ? t.multiplierNone : fmt(t.multiplierOption, { n })}
                                  </option>
                                ))}
                              </Select>
                            )}
                          </Field>
                          <div className="self-end">
                            <InlineSwitch checked={tier.freeShipping} onChange={(next) => patchTier(tier.key, { freeShipping: next })} label={t.freeShipping} disabled={saving} />
                          </div>
                        </div>

                        {threshold !== null && (
                          <div className="mt-4">
                            <ProgrammeExample>
                              {draft.basis === "spent"
                                ? fmt(t.summarySpent, { amount: formatMoney(threshold, currency), window: windowText, perks })
                                : fmt(t.summaryOrders, { orders: countOf("order", threshold), window: windowText, perks })}
                            </ProgrammeExample>
                          </div>
                        )}
                      </AccordionSection>
                    );
                  })}
                </AccordionGroup>
              )}

              {draft.tiers.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {addButton}
                  {full && <p className="text-[13px] leading-5 text-ink-soft">{fmt(t.tiersFull, { max: VIP_LIMITS.tiersMax })}</p>}
                </div>
              )}
            </section>

            {multiplies && loyalty.data && !loyalty.data.active && (
              <ProgrammeNote to={REWARDS_PATHS.loyalty} action={t.loyaltyOffAction}>
                {t.loyaltyOff}
              </ProgrammeNote>
            )}

            <SettingsGroup>
              <SettingsLinkRow to="/customers" icon={IconCustomers} label={t.membersLink} hint={t.membersLinkHint} />
            </SettingsGroup>

            {failure && <Alert variant="danger">{failure}</Alert>}

            <SaveBar
              dirty={dirty}
              saving={saving}
              saveLabel={t.save}
              savingLabel={t.saving}
              onDiscard={() => {
                if (saved) setDraft(saved);
                setWindowError(null);
                setTierErrors({});
                setFailure(null);
              }}
            />
          </form>
        )}
      </DataState>
    </div>
  );
}
