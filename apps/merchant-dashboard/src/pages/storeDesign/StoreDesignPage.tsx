import { StoreLivePreview } from "./StoreLivePreview";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { FilterTabs } from "@/components/FilterTabs";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { CheckoutFormTab } from "./CheckoutFormTab";
import { ThankYouTab } from "./ThankYouTab";
import { StoreInfoTab } from "./StoreInfoTab";
import { PoliciesTab } from "./PoliciesTab";
import { PagesTab } from "./PagesTab";
import { GeneralTab } from "./GeneralTab";
import { SeoTab } from "./SeoTab";
import { DomainsTab } from "./DomainsTab";
import { CUSTOM_DOMAINS_ENABLED, GIFT_OPTIONS_ENABLED, URL_REDIRECTS_ENABLED } from "@/lib/features";
import { LanguagesTab } from "./LanguagesTab";
import { GiftOptionsTab } from "./GiftOptionsTab";
import { RedirectsTab } from "./redirects/RedirectsTab";

/**
 * Store settings the shopper sees: one page, one tab per area. Each tab is a
 * self-contained form over the workspace settings; a new area is a new tab
 * file plus one entry in TABS.
 */
const ALL_TABS = ["general", "checkout-form", "thank-you", "store-info", "policies", "pages", "seo", "languages", "domains", "gift-options", "redirects"] as const;
type TabKey = (typeof ALL_TABS)[number];
// Domains, gift options and redirects only while each is switched on (lib/features); off, its address opens General.
const OFF_TABS: ReadonlySet<TabKey> = new Set<TabKey>([
  ...(CUSTOM_DOMAINS_ENABLED ? [] : (["domains"] as const)),
  ...(GIFT_OPTIONS_ENABLED ? [] : (["gift-options"] as const)),
  ...(URL_REDIRECTS_ENABLED ? [] : (["redirects"] as const)),
]);
const TABS: readonly TabKey[] = ALL_TABS.filter((tab) => !OFF_TABS.has(tab));

const STRINGS = {
  en: {
    title: "Store settings",
    description: "What shoppers fill in, read and see in your store.",
    tabsLabel: "Store settings sections",
    "checkout-form": "Purchase form",
    "thank-you": "Thank-you page",
    "store-info": "Store information",
    policies: "Policies",
    pages: "Pages",
    general: "General",
    seo: "SEO",
    domains: "Domains",
    languages: "Languages",
    "gift-options": "Gift options",
    redirects: "Redirects",
  },
  ar: {
    title: "إعدادات المتجر",
    description: "ما يملؤه المشتري وما يقرؤه ويراه في متجرك.",
    tabsLabel: "أقسام إعدادات المتجر",
    "checkout-form": "نموذج الشراء",
    "thank-you": "صفحة الشكر",
    "store-info": "بيانات المتجر",
    policies: "السياسات",
    pages: "الصفحات",
    general: "عام",
    seo: "SEO",
    domains: "الدومينات",
    languages: "اللغات",
    "gift-options": "خيارات الهدايا",
    redirects: "تحويل الروابط",
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
      <FilterTabs
        label={t.tabsLabel}
        tabs={TABS.map((value) => ({ value, label: t[value] }))}
        value={active}
        onChange={(value) => navigate(`/store-settings/${value}`)}
        className="mb-5"
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
      {active === "domains" && <DomainsTab key={workspaceId} />}
      {active === "languages" && <LanguagesTab key={workspaceId} />}
      {active === "gift-options" && <GiftOptionsTab key={workspaceId} />}
      {active === "redirects" && <RedirectsTab key={workspaceId} />}
        </div>
        <StoreLivePreview workspaceId={workspaceId} className="sticky top-24 hidden xl:block" />
      </div>
    </div>
  );
}
