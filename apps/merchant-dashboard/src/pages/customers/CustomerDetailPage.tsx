import { useParams } from "react-router-dom";
import { contactsGet, type Customer } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { UnsavedGuardProvider } from "@/lib/useUnsavedGuard";
import { AccordionSection } from "@/components/Accordion";
import { DataState } from "@/components/DataState";
import { IconBuilding, IconCoins, IconCrown, IconLoyalty, IconPlace, IconReferrals, IconSale, IconStoreCredit, IconTag, IconUser } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { useT, type Messages } from "@/i18n/LocaleContext";
// Business customers and paying later on account (handoffs 228, 229).
import { CustomerBusinessCard } from "@/pages/b2b/CustomerBusinessCard";
import { CustomerOnAccountCard } from "@/pages/b2b/CustomerOnAccountCard";
// The customer's invites (handoff 222), points (203), price lists (205), store credit (204) and VIP tier (218).
import { CustomerInvitesCard } from "@/pages/customerReferrals/CustomerInvitesCard";
import { dialablePhone } from "@/pages/home/today/OrderQuickLook";
import { CustomerLoyaltyCard } from "@/pages/loyalty/CustomerLoyaltyCard";
import { CustomerPriceListHint } from "@/pages/priceLists/CustomerPriceListHint";
import { CustomerStoreCreditCard } from "@/pages/storeCredit/CustomerStoreCreditCard";
import { CustomerVipCard } from "@/pages/vipTiers/CustomerVipCard";
import { ContactInsights } from "./ContactInsights";
// Everything under the hero (handoffs 209, 250, 237, 248, 235): the sections, the notes, the timeline, `?tab=`.
import { CustomerCrmTabs } from "./crm/CustomerCrmTabs";
import { isErasedCustomer } from "./crm/CustomerPrivacyCard";
import { foldingFrame } from "./detail/CardFrame";
import { ContactDetailsForm } from "./detail/ContactDetailsForm";
import type { CustomerContactState } from "./detail/contactState";
import { CustomerAddresses } from "./detail/CustomerAddresses";
import { CustomerCallBar } from "./detail/CustomerCallBar";
import { CustomerHero } from "./detail/CustomerHero";
import { CustomerSuppressionBanner } from "./suppressions/CustomerSuppressionBanner";
import { CustomerMoreMenu } from "./detail/CustomerMoreMenu";
import { CustomerOrders } from "./detail/CustomerOrders";
import { CustomerPageSkeleton } from "./detail/CustomerPageSkeleton";
import { SECTION_STRINGS, addressesLineOf, contactLineOf } from "./detail/sectionStrings";
import { useCustomerBlacklist } from "./detail/useCustomerBlacklist";

const STRINGS = {
  en: {
    customer: "Customer",
    back: "Contacts",
  },
  ar: {
    customer: "العميل",
    back: "جهات الاتصال",
  },
} satisfies Messages;

/**
 * One customer (/customers/:customerId).
 *
 * What used to be three tabs and fifteen always-open cards is a hero, the
 * customer's orders, and folding sections (docs/ux/REDESIGN_PROMPT.md §6):
 *
 *   header   back · «…» with what is done rarely — copy the number, their
 *            WhatsApp thread, block / unblock          detail/CustomerMoreMenu
 *   hero     who · the number · call and WhatsApp · their history with the
 *            store as four facts · the block, when there is one
 *                                                      detail/CustomerHero
 *   below    their orders (each opens the order's Quick Look), then notes and
 *            follow-ups, addresses, contact details, the timeline and the
 *            rest, each folded to one line that says what is inside
 *                                                      crm/CustomerCrmTabs
 *   phone    call and WhatsApp as the bar above the dock
 *                                                      detail/CustomerCallBar
 *
 * This file loads the customer and the contact record of the same person
 * (one request each, as before — the hero and the tags section now share the
 * second) and composes those. Each customer gets a page of its own (the key),
 * so nothing opened or typed on one follows the merchant to the next; a
 * customer already seen in this session is on screen from the first frame
 * (lib/useCachedAsync), refreshed behind. Unsaved edits in the page's forms
 * arm the browser's own "leave?" question (lib/useUnsavedGuard).
 */
export function CustomerDetailPage() {
  const { customerId = "" } = useParams<{ customerId: string }>();
  const workspaceId = useWorkspaceId();
  return (
    <UnsavedGuardProvider key={`${workspaceId}:${customerId}`}>
      <CustomerPage workspaceId={workspaceId} customerId={customerId} />
    </UnsavedGuardProvider>
  );
}

function CustomerPage({ workspaceId, customerId }: { workspaceId: string; customerId: string }) {
  const t = useT(STRINGS);
  const detail = useCachedAsync(`customer-page:${workspaceId}:${customerId}`, () => apiClient.getCustomer(workspaceId, customerId), [workspaceId, customerId]);
  // The contact side of the same person: what they spent, how many parcels they received, their tags.
  const contact = useCachedAsync(`customer-contact:${workspaceId}:${customerId}`, () => contactsGet(apiClient, workspaceId, customerId), [workspaceId, customerId]);
  const customer = detail.data;

  if (!customer || detail.error) {
    return (
      <div className="max-w-6xl">
        <PageHeader title={t.customer} back={{ to: "/customers", label: t.back }} />
        {/* Not found, no permission and a dropped connection each get DataState's own pane. */}
        <DataState loading={detail.loading} error={detail.error} onRetry={() => void detail.refresh()} skeleton={<CustomerPageSkeleton />}>
          {null}
        </DataState>
      </div>
    );
  }

  return (
    <LoadedCustomer
      customer={customer}
      contact={contact}
      reload={() => detail.refresh({ silent: true })}
      reloadAll={() => {
        void contact.refresh({ silent: true });
        return detail.refresh({ silent: true });
      }}
    />
  );
}

function LoadedCustomer({
  customer,
  contact,
  reload,
  reloadAll,
}: {
  customer: Customer;
  contact: CustomerContactState;
  /** Reads the customer again after a save on the page. */
  reload: () => Promise<void>;
  /** After a merge or an erase: the contact record is another person's worth of figures too. */
  reloadAll: () => Promise<void>;
}) {
  const t = useT(STRINGS);
  const s = useT(SECTION_STRINGS);
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  const blacklist = useCustomerBlacklist(customer, () => void reload());

  // An erased customer has no number: what stands in its place is not shown, dialled or copied.
  const phoneText = isErasedCustomer(customer) ? null : customer.phoneRaw || customer.phoneNormalized || null;
  // A number sent masked to this role is shown as it came, and never dialled.
  const phone = dialablePhone(phoneText);
  const saved = () => void reload();

  return (
    <div className="zimos-customer-page max-w-6xl">
      {/* The name is the part a row of the customers list travels into (lib/viewTransition.ts). */}
      <div data-vt-target>
        <PageHeader
          title={t.customer}
          back={{ to: "/customers", label: t.back }}
          actions={
            <CustomerMoreMenu
              customer={customer}
              phone={phone}
              conversationId={contact.data?.conversationId ?? null}
              onBlock={blacklist.askBlock}
              onUnblock={blacklist.askUnblock}
            />
          }
        />
        <CustomerHero
          customer={customer}
          contact={contact.data?.contact ?? null}
          contactLoading={contact.loading}
          currency={currency}
          phoneText={phoneText}
          phone={phone}
          onUnblock={blacklist.askUnblock}
        />
        {/* No email reaches this address: it bounced, or the customer marked one as spam (handoff 386). */}
        <CustomerSuppressionBanner email={isErasedCustomer(customer) ? null : customer.email} />
      </div>

      <div className="mt-[var(--bento-gap)]">
        <CustomerCrmTabs
          customer={customer}
          onChanged={reloadAll}
          orders={<CustomerOrders customer={customer} />}
          lead={
            <>
              <AccordionSection title={s.addressesTitle} icon={IconPlace} summary={addressesLineOf(customer, s)} persistKey="customer:addresses">
                <CustomerAddresses customer={customer} onChanged={saved} />
              </AccordionSection>

              {/* Kept in the page while folded: a half-typed edit survives a fold. */}
              <AccordionSection title={s.contactTitle} icon={IconUser} summary={contactLineOf(customer, s)} persistKey="customer:contact" keepMounted>
                <ContactDetailsForm
                  // What is saved is the form's starting point: a save (or a fresher answer behind a cached one) starts it again.
                  key={`${customer.fullName ?? ""}|${customer.email ?? ""}|${customer.alternatePhone ?? ""}|${customer.marketingConsent}`}
                  customer={customer}
                  onSaved={saved}
                />
              </AccordionSection>
            </>
          }
        >
          {/* Each of these reads its own data and decides for itself whether it has anything to show: no data, no section. */}
          <ContactInsights customerId={customer.id} state={contact} frame={foldingFrame({ key: "tags", icon: IconTag, title: s.tagsTitle })} />
          <CustomerStoreCreditCard customerId={customer.id} frame={foldingFrame({ key: "store-credit", icon: IconStoreCredit })} />
          <CustomerLoyaltyCard customerId={customer.id} frame={foldingFrame({ key: "loyalty", icon: IconLoyalty })} />
          <CustomerVipCard customerId={customer.id} frame={foldingFrame({ key: "vip", icon: IconCrown })} />
          <CustomerInvitesCard customerId={customer.id} frame={foldingFrame({ key: "invites", icon: IconReferrals })} />
          <CustomerPriceListHint customerId={customer.id} frame={foldingFrame({ key: "price-lists", icon: IconSale, title: s.priceListsTitle })} />
          {/* Forms: kept in the page while folded. */}
          <CustomerOnAccountCard customerId={customer.id} frame={foldingFrame({ key: "on-account", icon: IconCoins, keepMounted: true })} />
          <CustomerBusinessCard customerId={customer.id} frame={foldingFrame({ key: "business", icon: IconBuilding, keepMounted: true })} />
        </CustomerCrmTabs>
      </div>

      {/* On a phone calling is the bar above the dock: where the thumb is. No number that can be dialled, no bar. */}
      <CustomerCallBar phone={phone} name={customer.fullName} />

      {blacklist.dialogs}
    </div>
  );
}
