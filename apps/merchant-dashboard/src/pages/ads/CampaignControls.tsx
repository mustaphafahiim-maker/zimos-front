import { useMemo, useState, type ReactNode } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  adsCampaignKey,
  adsConnectionsList,
  adsSetCampaignBudget,
  adsSetCampaignStatus,
  type AdsAccount,
  type AdsCampaignChange,
  type AdsCampaignState,
  type AdsCampaignStatus,
  type AdsConnection,
  type ProfitCampaign,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { majorToMinor, minorToMajorInput } from "@/lib/format";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";
import { Field } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { focusFirstInvalid } from "@/pages/marketing/kit/form";
import { AD_ACCOUNT_STRINGS, type AdAccountText } from "./adAccountStrings";

/** A picked ad account a campaign can be controlled through, with its connection's last-known campaign states. */
interface ControlAccount {
  adapter: string;
  account: AdsAccount;
  campaigns: Record<string, AdsCampaignState>;
}

interface Target {
  campaign: ProfitCampaign & { campaignId: string };
  kind: "status" | "budget";
  accounts: ControlAccount[];
  /** The account the last change went through, and what it set. */
  known: { via: ControlAccount; state: AdsCampaignState } | null;
}

/** What the page may show and do for one campaign row that can be controlled. */
export interface CampaignControl {
  /** The last status set from here, if any — the ad platform stays the source of truth. */
  status: AdsCampaignStatus | undefined;
  paused: boolean;
  /** The last daily budget set from here (minor units of `currency`), if any. */
  dailyBudgetAmount: string | undefined;
  /** When that was. */
  updatedAt: string | undefined;
  currency: string;
  /** Opens the pause / resume question. */
  openStatus: () => void;
  /** Opens the daily budget sheet. */
  openBudget: () => void;
}

/**
 * Pause / resume and the daily budget, per campaign row of the Ad spend page
 * (handoff 261). A row can be controlled when it carries the campaign's id on
 * the ad platform and the store follows an ad account of that platform
 * (Money → Ad accounts). The chip and the amount are the last values set from
 * here — the ad platform stays the source of truth.
 *
 * Returns `of` — what a campaign's row and preview may show and do, or null
 * for a row that cannot be controlled (so without a followed ad account the
 * list looks as it always did) — and the sheets to render once.
 */
export function useCampaignControls(
  workspaceId: string,
  storeCurrency: string
): { of: (campaign: ProfitCampaign) => CampaignControl | null; any: boolean; dialogs: ReactNode } {
  const t = useT(AD_ACCOUNT_STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  // A teammate who may not read the connections simply gets no controls.
  const connections = useAsync(() => adsConnectionsList(apiClient, workspaceId).catch(() => [] as AdsConnection[]), [workspaceId]);
  const [target, setTarget] = useState<Target | null>(null);

  const followed = useMemo<ControlAccount[]>(
    () =>
      (connections.data ?? []).flatMap((c) =>
        c.accounts.filter((a) => a.selected).map((account) => ({ adapter: c.adapter, account, campaigns: c.campaigns }))
      ),
    [connections.data]
  );

  const targetOf = (campaign: ProfitCampaign, kind: Target["kind"]): Target | null => {
    const campaignId = campaign.campaignId;
    if (!campaignId) return null;
    const accounts = followed.filter((f) => f.account.platform === campaign.platform);
    if (accounts.length === 0) return null;
    let known: Target["known"] = null;
    for (const via of accounts) {
      const state = via.campaigns[adsCampaignKey(via.account.accountId, campaignId)];
      if (state) {
        known = { via, state };
        break;
      }
    }
    return { campaign: { ...campaign, campaignId }, kind, accounts, known };
  };

  const of = (campaign: ProfitCampaign): CampaignControl | null => {
    const row = targetOf(campaign, "status");
    if (!row) return null;
    const state = row.known?.state;
    return {
      status: state?.status,
      paused: state?.status === "paused",
      dailyBudgetAmount: state?.dailyBudgetAmount || undefined,
      updatedAt: state?.updatedAt,
      currency: row.known?.via.account.currency ?? row.accounts[0].account.currency ?? storeCurrency,
      openStatus: () => setTarget(row),
      openBudget: () => setTarget({ ...row, kind: "budget" }),
    };
  };

  /** The row shows what was just set, without asking the server again. */
  const remember = (adapter: string, change: AdsCampaignChange) => {
    const { campaignId, accountId, ...state } = change;
    const key = adsCampaignKey(accountId, campaignId);
    connections.setData((prev) =>
      (prev ?? []).map((c) => (c.adapter === adapter ? { ...c, campaigns: { ...c.campaigns, [key]: { ...c.campaigns[key], ...state } } } : c))
    );
  };

  /** Undo of a pause or a resume: the same request with the other status. */
  async function putBack(adapter: string, change: AdsCampaignChange) {
    const status: AdsCampaignStatus = change.status === "paused" ? "active" : "paused";
    try {
      remember(adapter, await adsSetCampaignStatus(apiClient, workspaceId, change.campaignId, { adapter, accountId: change.accountId, status }));
    } catch (err) {
      toast.error(errorMessage(err, { ADS_CHANGE_REFUSED: t.refused, ADS_PLATFORM_UNREACHABLE: t.unreachable }));
    }
  }

  const dialogs = target ? (
    <CampaignControlDialog
      key={`${target.kind}:${target.campaign.platform}:${target.campaign.campaignId}`}
      t={t}
      workspaceId={workspaceId}
      storeCurrency={storeCurrency}
      target={target}
      onClose={() => setTarget(null)}
      onChanged={(adapter, change) => {
        remember(adapter, change);
        if (target.kind === "budget") toast.success(t.budgetSaved);
        else toast.undo(change.status === "paused" ? t.pausedToast : t.resumedToast, () => putBack(adapter, change));
        setTarget(null);
      }}
    />
  ) : null;

  return { of, any: followed.length > 0, dialogs };
}

/** Confirms one change. Whatever it is, the merchant is told it happens on the ad platform itself. */
function CampaignControlDialog({
  t,
  workspaceId,
  storeCurrency,
  target,
  onClose,
  onChanged,
}: {
  t: AdAccountText;
  workspaceId: string;
  storeCurrency: string;
  target: Target;
  onClose: () => void;
  onChanged: (adapter: string, change: AdsCampaignChange) => void;
}) {
  const common = useCommon();
  const errorMessage = useErrorMessage();
  const { campaign, kind, accounts, known } = target;
  const [accountId, setAccountId] = useState((known?.via ?? accounts[0]).account.accountId);
  const via = accounts.find((a) => a.account.accountId === accountId) ?? accounts[0];
  const state = via.campaigns[adsCampaignKey(via.account.accountId, campaign.campaignId)];
  const currency = via.account.currency ?? storeCurrency;
  const nextStatus = state?.status === "paused" ? "active" : "paused";
  const [amount, setAmount] = useState(() => minorToMajorInput(state?.dailyBudgetAmount));
  const [amountError, setAmountError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(form: HTMLElement | null) {
    const where = { adapter: via.adapter, accountId: via.account.accountId };
    let dailyBudgetAmount = 0;
    if (kind === "budget") {
      dailyBudgetAmount = majorToMinor(amount);
      if (!Number.isFinite(dailyBudgetAmount) || dailyBudgetAmount < 1) {
        setAmountError(t.budgetInvalid);
        focusFirstInvalid(form);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const change =
        kind === "budget"
          ? await adsSetCampaignBudget(apiClient, workspaceId, campaign.campaignId, { ...where, dailyBudgetAmount })
          : await adsSetCampaignStatus(apiClient, workspaceId, campaign.campaignId, { ...where, status: nextStatus });
      onChanged(via.adapter, change);
    } catch (err) {
      setError(
        getFieldErrors(err).accountId ? t.notPicked : errorMessage(err, { ADS_CHANGE_REFUSED: t.refused, ADS_PLATFORM_UNREACHABLE: t.unreachable })
      );
      setBusy(false);
    }
  }

  const title = kind === "budget" ? t.budgetTitle : nextStatus === "active" ? t.resumeTitle : t.pauseTitle;
  const action = kind === "budget" ? common.save : nextStatus === "active" ? t.resume : t.pause;

  return (
    <Modal
      open
      onClose={onClose}
      title={fmt(title, { name: campaign.campaignName })}
      description={t.confirmNote}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose} disabled={busy}>
            {common.cancel}
          </Button>
          <Button type="submit" form="campaign-control-form" className="rounded-full px-5" disabled={busy}>
            {busy ? t.working : action}
          </Button>
        </>
      }
    >
      <form
        id="campaign-control-form"
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void confirm(e.currentTarget);
        }}
      >
        {error && <Alert variant="danger">{error}</Alert>}
        {accounts.length > 1 ? (
          <Field label={t.account}>
            {({ id }) => (
              <Select id={id} value={accountId} disabled={busy} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={`${a.adapter}:${a.account.accountId}`} value={a.account.accountId}>
                    {a.account.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <p className="text-sm text-ink-soft">
            {t.account}: <bdi className="font-medium text-ink">{via.account.name}</bdi>
          </p>
        )}
        {kind === "budget" && (
          <MoneyInput
            label={t.budget}
            required
            value={amount}
            currency={currency}
            disabled={busy}
            error={amountError}
            onChange={(next) => {
              setAmount(next);
              setAmountError(undefined);
            }}
          />
        )}
      </form>
    </Modal>
  );
}
