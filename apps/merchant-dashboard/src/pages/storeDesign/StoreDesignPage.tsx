import { StoreLivePreview } from "./StoreLivePreview";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { CheckoutFormTab } from "./CheckoutFormTab";
import { ThankYouTab } from "./ThankYouTab";
import { StoreInfoTab } from "./StoreInfoTab";
import { PoliciesTab } from "./PoliciesTab";
import { PagesTab } from "./PagesTab";
import { GeneralTab } from "./GeneralTab";
import { SeoTab } from "./SeoTab";
import { CustomCodeSection } from "./CustomCodeSection";
import { DomainsTab } from "./DomainsTab";
import { StoreAccessTab } from "./StoreAccessTab";
import { LanguagesTab } from "./LanguagesTab";
import { SectionTabs } from "@/components/SectionTabs";
import { CustomerAccountsTab } from "./CustomerAccountsTab";
import { PrivacyTab } from "./PrivacyTab";

/**
 * Store settings the shopper sees: one page, one tab per area. Each tab is a
 * self-contained form over the workspace settings; a new area is a new tab
 * file plus one entry in TABS.
 */
const TABS = ["general", "checkout-form", "thank-you", "store-info", "policies", "pages", "seo", "languages", "domains", "store-access", "custom-code", "customer-accounts", "privacy"] as const;
type TabKey = (typeof TABS)[number];

const STRINGS = {
  en: {
    title: "Store settings",
    description: "What shoppers fill in, read and see in your store.",
    tabsLabel: "Store settings sections",
    "checkout-form": "Purchase form",
    "thank-you": "Thank-you page",
    "store-info": "Contact details",
    policies: "Policies",
    pages: "Pages",
    general: "General",
    seo: "SEO",
    "custom-code": "Custom code",
    domains: "Domains",
    "store-access": "Store access",
    languages: "Languages",
    "customer-accounts": "Customer accounts",
    privacy: "Privacy",
  },
  ar: {
    title: "إعدادات المتجر",
    description: "اللي العميل بيملاه ويقراه ويشوفه في متجرك.",
    tabsLabel: "أقسام إعدادات المتجر",
    "checkout-form": "نموذج الشراء",
    "thank-you": "صفحة الشكر",
    "store-info": "بيانات التواصل",
    policies: "السياسات",
    pages: "الصفحات",
    general: "عام",
    seo: "SEO",
    "custom-code": "أكواد التخصيص",
    domains: "الدومينات",
    "store-access": "دخول المتجر",
    languages: "اللغات",
    "customer-accounts": "حسابات العملاء",
    privacy: "الخصوصية",
  },
} satisfies Messages;

export function StoreDesignPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const active: TabKey = TABS.includes(tab as TabKey) ? (tab as TabKey) : "general";

  return (
    <div>
      <PageHeader title={t.title} description={t.description} />
      <SectionTabs
        label={t.tabsLabel}
        tabs={TABS.map((value) => ({ value, label: t[value] }))}
        value={active}
        onChange={(value) => navigate(`/store-settings/${value}`)}
      />
      {/* The settings, and beside them (wide screens) the real store to check them against. */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
      {/* Keyed by workspace so a store switch never shows the previous store's draft. */}
      {active === "checkout-form" && <CheckoutFormTab key={workspaceId} />}
      {active === "thank-you" && <ThankYouTab key={workspaceId} />}
      {active === "store-info" && <StoreInfoTab key={workspaceId} />}
      {active === "policies" && <PoliciesTab key={workspaceId} />}
      {active === "pages" && <PagesTab key={workspaceId} />}
      {active === "general" && <GeneralTab key={workspaceId} />}
      {active === "seo" && <SeoTab key={workspaceId} />}
      {active === "custom-code" && <CustomCodeSection key={workspaceId} />}
      {active === "domains" && <DomainsTab key={workspaceId} />}
      {active === "store-access" && <StoreAccessTab key={workspaceId} />}
      {active === "languages" && <LanguagesTab key={workspaceId} />}
      {active === "customer-accounts" && <CustomerAccountsTab key={workspaceId} />}
      {active === "privacy" && <PrivacyTab key={workspaceId} />}
        </div>
        <StoreLivePreview workspaceId={workspaceId} className="sticky top-24 hidden xl:block" />
      </div>
    </div>
  );
}
