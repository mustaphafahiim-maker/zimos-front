import { Link } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { customerReferralsList } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { useCommon, useT } from "@/i18n/LocaleContext";
import { CustomerCard, type CustomerCardFrame } from "@/pages/customers/detail/CardFrame";
import { InviteStatus } from "./InvitesTable";
import { referralRewardText } from "./referralText";
import { REFERRAL_STRINGS } from "./referralStrings";

/**
 * The customer page's invites (handoff 222): the friends this customer
 * invited — each with its order, where the invite stands and what the
 * customer was given — and the invite they themself came in by. A customer
 * with no invites shows nothing at all.
 *
 * `frame` (optional) lets the customer page draw this card as one of its folding
 * sections instead of a pane of its own; left out, the card is the `Section` it
 * always was.
 */
export function CustomerInvitesCard({ customerId, frame }: { customerId: string; frame?: CustomerCardFrame }) {
  const t = useT(REFERRAL_STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const invites = useAsync(() => customerReferralsList(apiClient, workspaceId, { customerId, limit: 50 }), [workspaceId, customerId]);

  const data = invites.data;
  // No role for it: the page's other cards still stand, this one stays out.
  if (isPermissionError(invites.error)) return null;
  // Most customers have none: nothing shows while that is being found out, and nothing after.
  if (!data && !invites.error) return null;
  if (data && data.referrals.length === 0) return null;

  if (!data) {
    return (
      <CustomerCard frame={frame} title={t.cardTitle} description={t.cardHint}>
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-danger">{errorMessage(invites.error)}</p>
          <Button variant="outline" size="sm" className="min-h-11" onClick={() => void invites.refresh()}>
            {common.retry}
          </Button>
        </div>
      </CustomerCard>
    );
  }

  // An order number keeps its own direction inside the Arabic sentence.
  const [orderBefore, orderAfter] = t.orderLink.split("{number}");

  return (
    <CustomerCard frame={frame} title={t.cardTitle} description={t.cardHint} flush>
      <ul className="divide-y divide-line border-t border-line">
        {data.referrals.map((invite) => {
          // The list matches the inviter or the friend: say which one this customer is.
          const sent = invite.referrer?.id === customerId;
          const other = sent ? invite.friend : invite.referrer;
          const name = other ? (
            <Link to={`/customers/${other.id}`} className="font-medium text-primary hover:underline">
              <bdi>{other.name || t.noName}</bdi>
            </Link>
          ) : (
            t.noName
          );
          const [before, after] = (sent ? t.invited : t.invitedBy).split("{name}");
          return (
            <li key={invite.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="text-ink">
                  {before}
                  {name}
                  {after}
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {formatDate(invite.createdAt)}
                  {invite.order && (
                    <>
                      {" · "}
                      <Link to={`/orders/${invite.order.id}`} className="font-medium text-primary hover:underline">
                        {orderBefore}
                        <bdi dir="ltr">{invite.order.orderNumber}</bdi>
                        {orderAfter}
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <InviteStatus invite={invite} t={t} />
                {sent && invite.reward && <span className="text-xs font-medium text-success">{referralRewardText(invite.reward, invite.order?.currency ?? "EGP", t)}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </CustomerCard>
  );
}
