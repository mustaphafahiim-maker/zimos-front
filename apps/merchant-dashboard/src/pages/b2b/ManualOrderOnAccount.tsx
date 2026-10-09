import { useEffect } from "react";
import {
  ON_ACCOUNT_LIMITS,
  ON_ACCOUNT_METHOD,
  customerBusinessGet,
  onAccountStatementGet,
  type CustomerBusiness,
  type OnAccountStatement,
  type OrderDraftCustomer,
  type PaymentMethod,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney, parseMoney } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { fmt, useT } from "@/i18n/LocaleContext";
import { B2B_STRINGS } from "./b2bStrings";

/**
 * The manual order screen's part of handoff 228 and 229: the team may enter an
 * order for a customer the store approved to pay later (`on_account`), and an
 * order the team enters for a tax-exempt customer carries no added tax.
 *
 *   useManualOrderB2b(customerId)   what the store set for the customer found by phone
 *   manualDraftContact(customer)    their contact for the price preview, so it is priced for them
 *                                   (their exemption, their credit limit) and not for a blank customer
 *   <ManualOnAccountOption>         the payment method's option, for an approved customer only
 *   <ManualOrderB2bNote>            what is left of their limit, and the exemption
 */

export interface ManualOrderB2b {
  statement: OnAccountStatement | null;
  business: CustomerBusiness | null;
}

/** null until the customer is known, while their terms load, and for a role that may not read them. */
export function useManualOrderB2b(customerId: string | null | undefined): ManualOrderB2b | null {
  const workspaceId = useWorkspaceId();
  const state = useAsync(async () => {
    if (!customerId) return null;
    // Either may be refused on its own (no customers.view): the order form goes on without it.
    const [statement, business] = await Promise.all([
      onAccountStatementGet(apiClient, workspaceId, customerId).catch(() => null),
      customerBusinessGet(apiClient, workspaceId, customerId).catch(() => null),
    ]);
    return { customerId, statement, business };
  }, [workspaceId, customerId]);
  // Never the previous customer's answer while the next one loads.
  return customerId && state.data && state.data.customerId === customerId ? state.data : null;
}

/** The found customer's contact, for the draft the server prices; nothing for a number new to the store. */
export function manualDraftContact(customer: OrderDraftCustomer | null | undefined): { contact?: { fullName: string; phone: string } } {
  if (!customer || !customer.phone) return {};
  return { contact: { fullName: customer.fullName || "—", phone: customer.phone } };
}

function daysOf(statement: OnAccountStatement): number {
  return statement.paymentTermsDays ?? ON_ACCOUNT_LIMITS.termsDaysDefault;
}

/** Inside the payment method's select: «دفع آجل (خلال 30 يوم)», only for a customer the store approved. */
export function ManualOnAccountOption({ state }: { state: ManualOrderB2b | null }) {
  const t = useT(B2B_STRINGS);
  if (!state?.statement?.enabled) return null;
  const days = daysOf(state.statement);
  return <option value={ON_ACCOUNT_METHOD}>{days > 0 ? fmt(t.manualOption, { days: countOf("day", days) }) : t.manualOptionSameDay}</option>;
}

/**
 * Under the payment method: with «دفع آجل» chosen, what the customer has left
 * of their limit and what they owe now; and, whatever the method, that a
 * tax-exempt customer's order carries no added tax. A method left on «دفع آجل»
 * when the customer changes to one who is not approved goes back to cash on
 * delivery.
 */
export function ManualOrderB2bNote({
  state,
  paymentMethod,
  onMethodChange,
  currency,
}: {
  state: ManualOrderB2b | null;
  paymentMethod: string;
  onMethodChange: (method: PaymentMethod) => void;
  currency: string;
}) {
  const t = useT(B2B_STRINGS);
  const statement = state?.statement ?? null;
  const approved = Boolean(statement?.enabled);
  const onAccount = paymentMethod === ON_ACCOUNT_METHOD;

  useEffect(() => {
    if (onAccount && !approved) onMethodChange("cod");
  }, [onAccount, approved, onMethodChange]);

  const exempt = Boolean(state?.business?.taxExempt);
  const showTerms = onAccount && approved && statement !== null;
  if (!showTerms && !exempt) return null;

  const owed = statement ? parseMoney(statement.owed) : 0;
  return (
    <div className="mt-3 space-y-1 rounded-[0.5rem] bg-paper px-3 py-2 text-sm text-ink-soft" aria-live="polite">
      {showTerms && statement && (
        <p>
          <span className="font-medium text-ink">
            {statement.available === null ? t.manualNoLimit : fmt(t.manualAvailable, { amount: formatMoney(statement.available, currency) })}
          </span>
          {owed > 0 && <> · {fmt(t.manualOwes, { amount: formatMoney(owed, currency) })}</>}
        </p>
      )}
      {exempt && <p>{t.manualExempt}</p>}
    </div>
  );
}
