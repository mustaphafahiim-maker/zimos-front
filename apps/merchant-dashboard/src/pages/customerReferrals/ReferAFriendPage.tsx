import { useEffect, useId, useState, type FormEvent } from "react";
import { IconAward, IconUserAdd, IconWallet } from "@/components/icons";
import { Alert, Button } from "@store-builder/ui";
import {
  CUSTOMER_REFERRAL_LIMITS,
  customerReferralProblemOf,
  customerReferralsGet,
  customerReferralsSave,
  loyaltyGet,
  shopperAccountsGet,
  type CustomerReferralSettings,
  type ReferralRewardType,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { majorToMinor, minorToMajorInput } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Segmented } from "@/components/Segmented";
import { SettingsGroup, SettingsRow, SettingsSwitch } from "@/components/settings";
import { ViewLink } from "@/components/ViewLink";
import { SaveBar } from "@/components/SaveBar";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { MoneyControl, NumberControl, ProgrammeExample, ProgrammeNote, ProgrammeSkeleton, focusFirstInvalid } from "@/pages/loyalty/programmeKit";
import { RewardsTabs, REWARDS_PATHS } from "@/pages/loyalty/RewardsTabs";
import { parseWhole, toAsciiDigits } from "@/pages/loyalty/loyaltyStrings";
import { InvitesTable } from "./InvitesTable";
import { referralFriendText, referralRewardText } from "./referralText";
import { REFERRAL_STRINGS } from "./referralStrings";

interface Draft {
  enabled: boolean;
  percentOff: string;
  freeShipping: boolean;
  rewardType: ReferralRewardType;
  /** The reward as credit and as points: each kind keeps its own number, so switching back loses nothing. */
  credit: string;
  points: string;
  minOrder: string;
  maxRewards: string;
}

type FieldKey = "friend" | "reward" | "minOrder" | "maxRewards";

const toDraft = (s: CustomerReferralSettings): Draft => ({
  enabled: s.enabled,
  percentOff: s.friend.percentOff ? String(s.friend.percentOff) : "",
  freeShipping: s.friend.freeShipping,
  rewardType: s.referrer.type,
  credit: s.referrer.type === "store_credit" && s.referrer.amount > 0 ? minorToMajorInput(s.referrer.amount) : "",
  points: s.referrer.type === "points" && s.referrer.amount > 0 ? String(s.referrer.amount) : "",
  minOrder: s.minOrderAmount ? minorToMajorInput(s.minOrderAmount) : "",
  maxRewards: s.maxRewardsPerReferrer ? String(s.maxRewardsPerReferrer) : "",
});

/** What is typed for the reward kind in use, with the rest: to tell an edited form from the saved one. */
const fingerprint = (d: Draft) =>
  JSON.stringify([d.enabled, d.percentOff.trim(), d.freeShipping, d.rewardType, (d.rewardType === "points" ? d.points : d.credit).trim(), d.minOrder.trim(), d.maxRewards.trim()]);

/** A typed amount in minor units within [min, max] (two decimals at most), or null. */
function parseAmount(raw: string, min: number, max: number): number | null {
  const ascii = toAsciiDigits(raw);
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(ascii)) return null;
  const minor = majorToMinor(ascii);
  return Number.isFinite(minor) && minor >= min && minor <= max ? minor : null;
}

/**
 * Customers → Loyalty & rewards → Refer a friend (GET
 * customers.view, PUT discounts.manage): the switch, what the invited friend
 * gets on a first order, what the inviter is given once it is delivered, the
 * limits — and every invite with where it stands.
 *
 * The rules are settings groups; a change shows the save bar, and leaving with
 * one unsaved asks first. The invites are the list under them.
 */
export function ReferAFriendPage() {
  const t = useT(REFERRAL_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const phone = useIsPhone();
  const formId = useId();

  const settings = useAsync(() => customerReferralsGet(apiClient, workspaceId), [workspaceId]);
  // The link lives in the shopper's account, and a points reward needs the points programme: say so when either is off.
  // A role that may not read those settings simply sees no hint.
  const accounts = useAsync(() => shopperAccountsGet(apiClient, workspaceId).catch(() => null), [workspaceId]);
  const loyalty = useAsync(() => loyaltyGet(apiClient, workspaceId).catch(() => null), [workspaceId]);

  const [saved, setSaved] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const data = settings.data;
  // The form starts from what is saved, and again after each save.
  useEffect(() => {
    if (!data) return;
    const next = toDraft(data);
    setSaved(next);
    setDraft(next);
  }, [data]);

  const dirty = Boolean(draft && saved && fingerprint(draft) !== fingerprint(saved));
  // Leaving the page with a change not saved asks first.
  useReportDirty(dirty);
  // The API refuses points as the reward of a running programme while loyalty is switched off.
  const loyaltyOff = loyalty.data ? !loyalty.data.settings.enabled : false;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setFailure(null);
    const field: FieldKey | null =
      key === "percentOff" || key === "freeShipping" ? "friend" : key === "credit" || key === "points" || key === "rewardType" ? "reward" : key === "minOrder" ? "minOrder" : key === "maxRewards" ? "maxRewards" : null;
    if (field) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  /** The form as the API takes it, or what is wrong with it by field. */
  function read(d: Draft): { body: CustomerReferralSettings | null; found: Partial<Record<FieldKey, string>> } {
    const found: Partial<Record<FieldKey, string>> = {};
    const percentOff = toAsciiDigits(d.percentOff) === "" ? 0 : parseWhole(d.percentOff, 0, CUSTOMER_REFERRAL_LIMITS.percentMax);
    if (percentOff === null) found.friend = t.friendPercentError;
    else if (d.enabled && percentOff === 0 && !d.freeShipping) found.friend = t.friendRequired;

    const amount =
      d.rewardType === "points"
        ? parseWhole(d.points, CUSTOMER_REFERRAL_LIMITS.rewardMin, CUSTOMER_REFERRAL_LIMITS.rewardMax)
        : parseAmount(d.credit, CUSTOMER_REFERRAL_LIMITS.rewardMin, CUSTOMER_REFERRAL_LIMITS.rewardMax);
    if (amount === null) found.reward = d.rewardType === "points" ? t.rewardPointsError : t.rewardAmountError;
    else if (d.enabled && d.rewardType === "points" && loyaltyOff) found.reward = t.rewardPointsNeedsLoyalty;

    const noMinimum = toAsciiDigits(d.minOrder) === "";
    const minOrderAmount = noMinimum ? null : parseAmount(d.minOrder, 1, CUSTOMER_REFERRAL_LIMITS.minOrderMax);
    if (!noMinimum && minOrderAmount === null) found.minOrder = t.minOrderError;

    const noLimit = toAsciiDigits(d.maxRewards) === "";
    const maxRewardsPerReferrer = noLimit ? null : parseWhole(d.maxRewards, 1, CUSTOMER_REFERRAL_LIMITS.maxRewardsMax);
    if (!noLimit && maxRewardsPerReferrer === null) found.maxRewards = t.maxRewardsError;

    if (Object.keys(found).length > 0 || percentOff === null || amount === null) return { body: null, found };
    return {
      body: {
        enabled: d.enabled,
        friend: { percentOff, freeShipping: d.freeShipping },
        referrer: { type: d.rewardType, amount },
        minOrderAmount,
        maxRewardsPerReferrer,
      },
      found,
    };
  }

  /** After the rows have drawn their problems: the first one comes into view and takes the focus. */
  const showFirstProblem = () => window.requestAnimationFrame(() => focusFirstInvalid(document.getElementById(formId)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft || saving) return;
    const { body, found } = read(draft);
    setErrors(found);
    if (!body) {
      setFailure(t.fixFields);
      showFirstProblem();
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      const next = await customerReferralsSave(apiClient, workspaceId, body);
      settings.setData(next);
      toast.success(next.enabled ? t.savedOn : draft.enabled !== saved?.enabled ? t.savedOff : t.saved);
    } catch (err) {
      const problem = customerReferralProblemOf(err);
      if (problem === "friend_offer") setErrors((prev) => ({ ...prev, friend: t.friendRequired }));
      if (problem === "loyalty_off") {
        setErrors((prev) => ({ ...prev, reward: t.rewardPointsNeedsLoyalty }));
        // The programme was switched off since this page read it.
        void loyalty.refresh({ silent: true });
      }
      setFailure(problem ? t.fixFields : errorMessage(err));
      if (problem) showFirstProblem();
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

  // The sentence shoppers read, on the numbers being typed.
  const live = draft ? read({ ...draft, enabled: false }).body : null;
  const friendText = live ? referralFriendText(live.friend, t) : "";
  const field = (key: string) => `${formId}-${key}`;
  // "Points need the loyalty programme" belongs to the choice of reward; any other problem to its amount.
  const needsLoyalty = errors.reward === t.rewardPointsNeedsLoyalty;
  const amountError = errors.reward && !needsLoyalty ? errors.reward : undefined;

  return (
    <div>
      {/* A phone keeps the first screen for the switch and the rules: the sentence is said by the first group. */}
      <PageHeader title={t.title} description={phone ? undefined : t.description} titleBadge={badge} />
      <RewardsTabs active="referrals" />

      <DataState loading={settings.loading} error={settings.error} onRetry={() => void settings.refresh()} skeleton={<ProgrammeSkeleton groups={[1, 2, 2, 2]} />}>
        {data && draft && (
          <div className="space-y-8">
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

              <SettingsGroup title={t.friendTitle}>
                <SettingsRow
                  label={t.friendPercent}
                  hint={t.friendPercentHint}
                  htmlFor={field("percent")}
                  error={errors.friend}
                  control={
                    <NumberControl
                      id={field("percent")}
                      maxLength={2}
                      placeholder="0"
                      value={draft.percentOff}
                      disabled={saving}
                      invalid={Boolean(errors.friend)}
                      unit={t.percentUnit}
                      unitHidden
                      onChange={(v) => set("percentOff", v)}
                    />
                  }
                />
                <SettingsSwitch checked={draft.freeShipping} onChange={(next) => set("freeShipping", next)} label={t.friendShipping} disabled={saving} />
              </SettingsGroup>

              <SettingsGroup
                title={t.rewardTitle}
                description={t.settingsHint}
                footer={
                  draft.rewardType === "points" && loyaltyOff && !needsLoyalty ? (
                    <span className="flex flex-wrap items-center gap-x-3 font-medium text-accent-dark">
                      {t.rewardPointsNeedsLoyalty}
                      <ViewLink to={REWARDS_PATHS.loyalty} className="inline-flex min-h-11 items-center text-primary hover:underline">
                        {t.openLoyalty}
                      </ViewLink>
                    </span>
                  ) : undefined
                }
              >
                <SettingsRow
                  label={t.rewardKind}
                  hint={draft.rewardType === "points" ? t.rewardPointsHint : t.rewardCreditHint}
                  stacked
                  error={needsLoyalty ? errors.reward : undefined}
                  control={
                    <>
                      <Segmented
                        label={t.rewardKind}
                        value={draft.rewardType}
                        onChange={(next) => set("rewardType", next)}
                        options={[
                          { value: "store_credit", label: t.rewardCredit, icon: IconWallet },
                          { value: "points", label: t.rewardPoints, icon: IconAward },
                        ]}
                      />
                      {needsLoyalty && (
                        <ViewLink to={REWARDS_PATHS.loyalty} className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary hover:underline">
                          {t.openLoyalty}
                        </ViewLink>
                      )}
                    </>
                  }
                />
                {draft.rewardType === "points" ? (
                  <SettingsRow
                    label={t.rewardPointsAmount}
                    htmlFor={field("points")}
                    error={amountError}
                    control={
                      <NumberControl
                        id={field("points")}
                        maxLength={9}
                        value={draft.points}
                        disabled={saving}
                        invalid={Boolean(amountError)}
                        onChange={(v) => set("points", v)}
                      />
                    }
                  />
                ) : (
                  <SettingsRow
                    label={t.rewardAmount}
                    htmlFor={field("credit")}
                    error={amountError}
                    control={
                      <MoneyControl
                        id={field("credit")}
                        currency={currency}
                        value={draft.credit}
                        disabled={saving}
                        invalid={Boolean(amountError)}
                        onChange={(v) => set("credit", v)}
                      />
                    }
                  />
                )}
              </SettingsGroup>

              <SettingsGroup title={t.groupLimits}>
                <SettingsRow
                  label={t.minOrder}
                  hint={t.minOrderHint}
                  htmlFor={field("minOrder")}
                  error={errors.minOrder}
                  control={
                    <MoneyControl
                      id={field("minOrder")}
                      currency={currency}
                      value={draft.minOrder}
                      disabled={saving}
                      invalid={Boolean(errors.minOrder)}
                      onChange={(v) => set("minOrder", v)}
                    />
                  }
                />
                <SettingsRow
                  label={t.maxRewards}
                  hint={t.maxRewardsHint}
                  htmlFor={field("maxRewards")}
                  error={errors.maxRewards}
                  control={
                    <NumberControl
                      id={field("maxRewards")}
                      maxLength={4}
                      value={draft.maxRewards}
                      disabled={saving}
                      invalid={Boolean(errors.maxRewards)}
                      onChange={(v) => set("maxRewards", v)}
                    />
                  }
                />
              </SettingsGroup>

              {live && friendText && (
                <ProgrammeExample icon={IconUserAdd} label={t.preview}>
                  {fmt(t.previewLine, { friend: friendText, reward: referralRewardText(live.referrer, currency, t) })}
                </ProgrammeExample>
              )}

              {failure && <Alert variant="danger">{failure}</Alert>}

              <SaveBar
                dirty={dirty}
                saving={saving}
                saveLabel={t.save}
                savingLabel={t.saving}
                onDiscard={() => {
                  if (saved) setDraft(saved);
                  setErrors({});
                  setFailure(null);
                }}
              />
            </form>

            <InvitesTable
              emptyAction={
                // With the programme off nobody has a link to share: the one thing to do is turn it on (the save bar follows).
                !draft.enabled ? (
                  <Button
                    type="button"
                    className="rounded-full px-5"
                    onClick={() => {
                      set("enabled", true);
                      document.getElementById(formId)?.scrollIntoView({ block: "start" });
                    }}
                  >
                    {t.enable}
                  </Button>
                ) : undefined
              }
            />
          </div>
        )}
      </DataState>
    </div>
  );
}
