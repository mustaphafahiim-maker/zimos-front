import { Link } from "react-router-dom";
import { IconCrown } from "@/components/icons";
import { Button } from "@store-builder/ui";
import { vipCustomerGet, vipTierName } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney } from "@/lib/format";
import { countOf, pluralOf } from "@/lib/plural";
import { fmt, getLocale, useCommon, useT } from "@/i18n/LocaleContext";
import { CustomerCard, type CustomerCardFrame } from "@/pages/customers/detail/CardFrame";
import { REWARDS_PATHS } from "@/pages/loyalty/RewardsTabs";
import { vipPerksText } from "./vipPerks";
import { VIP_STRINGS } from "./vipTierStrings";

/**
 * The customer page's VIP card: the tier's badge, what it
 * gives, what the customer's delivered orders come to, and «فاضل 3 طلبات لـ
 * Platinum» with a bar. A store that runs no tiers shows nothing at all.
 *
 * `frame` (optional) lets the customer page draw this card as one of its folding
 * sections instead of a pane of its own; left out, the card is the `Section` it
 * always was.
 */
export function CustomerVipCard({ customerId, frame }: { customerId: string; frame?: CustomerCardFrame }) {
  const t = useT(VIP_STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  const errorMessage = useErrorMessage();
  const vip = useAsync(() => vipCustomerGet(apiClient, workspaceId, customerId), [workspaceId, customerId]);

  const data = vip.data;
  // No role for it: the page's other cards still stand, this one stays out.
  if (isPermissionError(vip.error)) return null;
  // Most stores run no tiers: nothing shows while that is being found out, and nothing after.
  if (!data && !vip.error) return null;
  if (data && !data.standing) return null;

  if (!data || !data.standing) {
    return (
      <CustomerCard frame={frame} title={t.cardTitle} description={t.cardHint}>
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-danger">{errorMessage(vip.error)}</p>
          <Button variant="outline" size="sm" className="min-h-11" onClick={() => void vip.refresh()}>
            {common.retry}
          </Button>
        </div>
      </CustomerCard>
    );
  }

  const { tier, next, standing } = data;
  const language = getLocale();
  const perks = tier ? vipPerksText(tier, t) : "";
  const nextName = next ? vipTierName(next.name, language) : "";
  // How far along the way to the next tier: what they have, over what that tier asks for.
  const target = next ? standing.value + next.missing : 0;
  const percent = next && target > 0 ? Math.max(0, Math.min(100, Math.round((standing.value / target) * 100))) : 100;

  return (
    <CustomerCard
      frame={frame}
      title={t.cardTitle}
      description={t.cardHint}
      // The folded line of the customer page: the tier they stand at.
      summary={tier ? vipTierName(tier.name, language) : t.noTier}
      actions={
        <Link to={REWARDS_PATHS.vip} className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
          {t.manage}
        </Link>
      }
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={
            tier
              ? "inline-flex min-h-8 items-center gap-1.5 rounded-full bg-primary-soft px-3 text-sm font-semibold text-primary-dark dark:text-primary"
              : "inline-flex min-h-8 items-center gap-1.5 rounded-full bg-paper-sunken px-3 text-sm font-medium text-ink-soft"
          }
        >
          <IconCrown className="size-4" aria-hidden />
          <bdi>{tier ? vipTierName(tier.name, language) : t.noTier}</bdi>
        </span>
        {tier && <span className="text-sm text-ink">{perks ? fmt(t.perks, { perks }) : t.noPerks}</span>}
      </div>

      <p className="mt-3 text-sm text-ink-soft">{fmt(t.standingSpent, { amount: formatMoney(standing.spent, currency), orders: countOf("order", standing.orders) })}</p>

      {next ? (
        <div className="mt-3">
          <p className="text-sm font-medium text-ink">
            {standing.basis === "orders"
              ? fmt(pluralOf(t, "nextOrders", next.missing), { name: nextName })
              : fmt(t.nextSpent, { amount: formatMoney(next.missing, currency), name: nextName })}
          </p>
          <div
            role="progressbar"
            aria-label={fmt(t.progress, { name: nextName })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="mt-2 h-2 max-w-sm overflow-hidden rounded-full bg-paper-sunken"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm font-medium text-ink">{t.topTier}</p>
      )}
    </CustomerCard>
  );
}
