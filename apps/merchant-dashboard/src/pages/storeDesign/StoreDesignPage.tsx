import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { FilterTabs } from "@/components/FilterTabs";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { CheckoutFormTab } from "./CheckoutFormTab";
import { ThankYouTab } from "./ThankYouTab";

/**
 * Store settings the shopper sees: one page, one tab per area. Each tab is a
 * self-contained form over the workspace settings; a new area is a new tab
 * file plus one entry in TABS.
 */
const TABS = ["checkout-form", "thank-you"] as const;
type TabKey = (typeof TABS)[number];

const STRINGS = {
  en: {
    title: "Store settings",
    description: "What shoppers fill in, read and see in your store.",
    tabsLabel: "Store settings sections",
    "checkout-form": "Purchase form",
    "thank-you": "Thank-you page",
  },
  ar: {
    title: "إعدادات المتجر",
    description: "ما يملؤه المشتري وما يقرؤه ويراه في متجرك.",
    tabsLabel: "أقسام إعدادات المتجر",
    "checkout-form": "نموذج الشراء",
    "thank-you": "صفحة الشكر",
  },
} satisfies Messages;

export function StoreDesignPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const active: TabKey = TABS.includes(tab as TabKey) ? (tab as TabKey) : "checkout-form";

  return (
    <div>
      <PageHeader title={t.title} description={t.description} />
      <FilterTabs
        label={t.tabsLabel}
        tabs={TABS.map((value) => ({ value, label: t[value] }))}
        value={active}
        onChange={(value) => navigate(`/store-settings/${value}`)}
        className="mb-5"
      />
      {/* Keyed by workspace so a store switch never shows the previous store's draft. */}
      {active === "checkout-form" && <CheckoutFormTab key={workspaceId} />}
      {active === "thank-you" && <ThankYouTab key={workspaceId} />}
    </div>
  );
}
