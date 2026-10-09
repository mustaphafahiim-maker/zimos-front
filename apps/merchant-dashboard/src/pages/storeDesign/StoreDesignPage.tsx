import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@store-builder/ui";
import {
  IconAccount,
  IconChat,
  IconClipboard,
  IconCode,
  IconDocument,
  IconEye,
  IconGift,
  IconGlobe,
  IconHeart,
  IconLanguage,
  IconLock,
  IconMapPinned,
  IconPage,
  IconPhone,
  IconSearch,
  IconShield,
  IconShuffle,
  IconStoreSettings,
  type IconComponent,
} from "@/components/icons";
import { SettingsLayout, SettingsPane, type SettingsSectionDef, type SettingsTone } from "@/components/settings";
import { Sheet } from "@/components/Sheet";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { UnsavedGuardProvider, useUnsavedGuard } from "@/lib/useUnsavedGuard";
import { StoreLivePreview } from "./StoreLivePreview";
import { CheckoutFormTab } from "./CheckoutFormTab";
import { ThankYouTab } from "./ThankYouTab";
import { StoreInfoTab } from "./StoreInfoTab";
import { PoliciesTab } from "./PoliciesTab";
import { PagesTab } from "./PagesTab";
import { GeneralTab } from "./GeneralTab";
import { SeoTab } from "./SeoTab";
import { CustomCodeSection } from "./CustomCodeSection";
import { DomainsTab } from "./DomainsTab";
import { useCustomDomainsClosed } from "./customDomainsGate";
import { StoreAccessTab } from "./StoreAccessTab";
import { LanguagesTab } from "./LanguagesTab";
import { CustomerAccountsTab } from "./CustomerAccountsTab";
import { PrivacyTab } from "./PrivacyTab";
import { GiftOptionsTab } from "./GiftOptionsTab";
import { RedirectsTab } from "./redirects/RedirectsTab";
import { BranchesTab } from "./branches/BranchesTab";
import { SurveySettingsTab } from "@/pages/survey/SurveySettingsTab";
import { ShopperGoogleCard } from "./ShopperGoogleCard";

/**
 * Store settings the shopper sees, laid out like System Settings: a searchable
 * list of sections and ONE section in the pane (on a phone the list is the
 * page and pushes to a section). The section stays in the path
 * (/store-settings/:tab) with the values it always had, so every link keeps
 * landing where it did. Each section is a self-contained form over the
 * workspace settings; a new area is a new file plus one entry in SECTIONS.
 */
const TABS = ["general", "checkout-form", "gift-options", "thank-you", "survey", "store-info", "branches", "policies", "pages", "seo", "redirects", "languages", "domains", "store-access", "custom-code", "customer-accounts", "privacy"] as const;
type TabKey = (typeof TABS)[number];
type GroupKey = "basics" | "buying" | "showing" | "access" | "advanced";

interface SectionMeta {
  id: TabKey;
  group: GroupKey;
  icon: IconComponent;
  tone: SettingsTone;
  /** What the search also finds the section by, in both languages. */
  keywords: string[];
}

/** The list, in the order it is read. The first one is what a desktop opens when the path names none. */
const SECTIONS: ReadonlyArray<SectionMeta> = [
  { id: "general", group: "basics", icon: IconStoreSettings, tone: "gray", keywords: ["favicon", "icon", "country", "social", "facebook", "instagram", "tiktok", "whatsapp", "app", "pwa", "أيقونة", "الدولة", "البلد", "سوشيال", "فيسبوك", "انستجرام", "تيك توك", "واتساب", "زرار واتساب", "تطبيق المتجر"] },
  { id: "store-info", group: "basics", icon: IconPhone, tone: "green", keywords: ["contact", "email", "phone", "address", "trust", "shipping", "return", "cod", "تليفون", "إيميل", "عنوان", "كروت الثقة", "الشحن", "الاسترجاع", "الدفع عند الاستلام"] },
  { id: "branches", group: "basics", icon: IconMapPinned, tone: "orange", keywords: ["branches", "locations", "store locator", "map", "hours", "فروعنا", "فرع", "خريطة", "مواعيد", "أماكن"] },
  { id: "policies", group: "basics", icon: IconDocument, tone: "gray", keywords: ["legal", "refund", "privacy policy", "terms", "shipping policy", "سياسة الشحن", "سياسة الاسترجاع", "سياسة الخصوصية", "شروط الخدمة", "الشروط"] },
  { id: "checkout-form", group: "buying", icon: IconClipboard, tone: "blue", keywords: ["checkout", "purchase form", "order form", "fields", "custom field", "discount code", "billing", "trust badges", "نموذج الشراء", "فورم", "حقول", "حقل مخصص", "كود الخصم", "عنوان الفاتورة", "الدفع"] },
  { id: "gift-options", group: "buying", icon: IconGift, tone: "pink", keywords: ["gift", "wrap", "message", "هدية", "هدايا", "تغليف", "رسالة إهداء"] },
  { id: "thank-you", group: "buying", icon: IconHeart, tone: "red", keywords: ["thank you", "after order", "شكرًا", "بعد الأوردر", "رسالة الشكر"] },
  { id: "survey", group: "buying", icon: IconChat, tone: "purple", keywords: ["survey", "questions", "nps", "feedback", "استبيان", "أسئلة", "رأي العميل"] },
  { id: "pages", group: "showing", icon: IconPage, tone: "blue", keywords: ["pages", "header", "footer", "menu", "صفحات", "الهيدر", "الفوتر", "القائمة"] },
  { id: "seo", group: "showing", icon: IconSearch, tone: "teal", keywords: ["seo", "google", "search", "meta", "title", "description", "share image", "sitemap", "جوجل", "محركات البحث", "وصف المتجر", "صورة المشاركة"] },
  { id: "redirects", group: "showing", icon: IconShuffle, tone: "orange", keywords: ["redirects", "301", "302", "old link", "csv", "تحويل الروابط", "لينك قديم", "روابط"] },
  { id: "languages", group: "showing", icon: IconLanguage, tone: "purple", keywords: ["languages", "translation", "english", "arabic", "french", "ai translate", "لغات", "ترجمة", "إنجليزي", "عربي"] },
  { id: "domains", group: "showing", icon: IconGlobe, tone: "blue", keywords: ["domain", "dns", "ssl", "buy domain", "www", "دومين", "نطاق", "شهادة", "اشتري دومين"] },
  { id: "store-access", group: "access", icon: IconLock, tone: "red", keywords: ["password", "coming soon", "lock", "age", "preview", "sign-ups", "باسورد", "قريبًا", "قفل المتجر", "السن", "معاينة", "دخول المتجر"] },
  { id: "customer-accounts", group: "access", icon: IconAccount, tone: "green", keywords: ["accounts", "sign in", "login", "sms", "google", "otp", "تسجيل الدخول", "كود", "جوجل", "حساب العميل"] },
  { id: "privacy", group: "access", icon: IconShield, tone: "teal", keywords: ["privacy", "cookies", "consent", "banner", "gdpr", "pixel", "كوكيز", "موافقة", "بيكسل", "رسالة الكوكيز"] },
  { id: "custom-code", group: "advanced", icon: IconCode, tone: "gray", keywords: ["code", "html", "css", "javascript", "js", "head", "scripts", "pixel", "tag", "كود", "سكريبت", "سكربتات", "أكواد التخصيص"] },
];

const FIRST: TabKey = SECTIONS[0].id;

const STRINGS = {
  en: {
    title: "Store settings",
    search: "Search store settings…",
    seeStore: "See the store",
    previewTitle: "Your published store",
    previewDescription: "What shoppers see right now — not the changes you have not saved yet.",
    group_basics: "Basics",
    group_buying: "Buying",
    group_showing: "Showing up",
    group_access: "Access and privacy",
    group_advanced: "Advanced",
    general: "General",
    "store-info": "Contact details and promises",
    branches: "Branches",
    policies: "Policies",
    "checkout-form": "Order form",
    "gift-options": "Gift options",
    "thank-you": "Thank-you page",
    survey: "Post-purchase survey",
    pages: "Pages",
    seo: "SEO",
    redirects: "Redirects",
    languages: "Languages",
    domains: "Domains",
    "store-access": "Store access",
    "customer-accounts": "Customer accounts",
    privacy: "Privacy and cookies",
    "custom-code": "Custom code and scripts",
  },
  ar: {
    title: "إعدادات المتجر",
    search: "دوّر في إعدادات المتجر…",
    seeStore: "شوف المتجر",
    previewTitle: "متجرك المنشور",
    previewDescription: "اللي العميل شايفه دلوقتي — مش التعديلات اللي لسه ما اتحفظتش.",
    group_basics: "الأساسيات",
    group_buying: "الشراء",
    group_showing: "الظهور",
    group_access: "الوصول والخصوصية",
    group_advanced: "متقدّم",
    general: "عام",
    "store-info": "بيانات التواصل والوعود",
    branches: "الفروع",
    policies: "السياسات",
    "checkout-form": "فورم الطلب",
    "gift-options": "اختيارات الهدية",
    "thank-you": "صفحة الشكر",
    survey: "استبيان بعد الشراء",
    pages: "الصفحات",
    seo: "SEO",
    redirects: "التحويلات",
    languages: "اللغات",
    domains: "الدومينات",
    "store-access": "الوصول للمتجر",
    "customer-accounts": "حسابات العملاء",
    privacy: "الخصوصية والكوكيز",
    "custom-code": "أكواد مخصصة والسكريبتات",
  },
} satisfies Messages;

/** One line per section: under its name in the phone list, and under the pane's title. */
const DESCRIPTIONS = {
  en: {
    general: "Tab icon, country, social links, the WhatsApp button and the store as an app.",
    "store-info": "Your phone, email and address, and the trust cards under the buy button.",
    branches: "The “Our branches” page: which locations show, with hours and a map pin.",
    policies: "Shipping, refund, privacy and terms — written once, linked everywhere.",
    "checkout-form": "What the shopper fills in to order, in which order, and what is required.",
    "gift-options": "“Is this a gift?” at checkout: gift wrap and a message.",
    "thank-you": "What the shopper sees right after placing the order.",
    survey: "A few questions after the order: where they heard of you, what to improve.",
    pages: "Which pages show in the header and footer, and which are open.",
    seo: "How the store looks on Google and when its link is shared.",
    redirects: "Send an old address to a new one so no link breaks.",
    languages: "Offer the store in more languages and translate your content.",
    domains: "Connect your own domain or buy one, with its certificate.",
    "store-access": "Open, behind a password, or a coming-soon page — and the age check.",
    "customer-accounts": "Let customers sign in with a code or Google to see their orders.",
    privacy: "The cookie banner: off, a notice, or ask before ad tracking runs.",
    "custom-code": "HTML, CSS and scripts added to the store's pages.",
  },
  ar: {
    general: "أيقونة التبويب، الدولة، روابط السوشيال، زرار واتساب، والمتجر كتطبيق.",
    "store-info": "تليفونك وإيميلك وعنوانك، وكروت الثقة اللي تحت زرار الشراء.",
    branches: "صفحة «فروعنا»: أنهي أماكن تظهر، بمواعيدها ومكانها على الخريطة.",
    policies: "الشحن والاسترجاع والخصوصية والشروط — بتتكتب مرة وبتظهر في كل حتة.",
    "checkout-form": "العميل بيملا إيه عشان يطلب، بأنهي ترتيب، وإيه اللي لازم يتملي.",
    "gift-options": "«ده هدية؟» في صفحة الدفع: تغليف ورسالة إهداء.",
    "thank-you": "اللي العميل بيشوفه أول ما الأوردر يتسجل.",
    survey: "كام سؤال بعد الأوردر: عرفنا منين، ونحسّن إيه.",
    pages: "أنهي صفحات تظهر في الهيدر والفوتر، وأنهي صفحات مفتوحة.",
    seo: "شكل متجرك على جوجل ولما لينكه يتبعت لحد.",
    redirects: "حوّل اللينك القديم للجديد عشان مفيش لينك يبوظ.",
    languages: "اعرض متجرك بأكتر من لغة وترجم محتواك.",
    domains: "اربط الدومين بتاعك أو اشتري واحد، بشهادته.",
    "store-access": "مفتوح، بباسورد، أو صفحة «قريبًا» — وسؤال السن.",
    "customer-accounts": "خلّي العميل يدخل بكود أو بجوجل ويشوف أوردراته.",
    privacy: "رسالة الكوكيز: مقفولة، إشعار، أو اسأل قبل تتبّع الإعلانات.",
    "custom-code": "HTML و CSS وسكريبتات بتتضاف لصفحات المتجر.",
  },
} satisfies Messages;

/** Tailwind's `lg`, where SettingsLayout puts the list beside the pane. */
function isDesktopNow(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 64rem)").matches;
}

const pathOf = (tab: TabKey | null) => (tab === null ? "/store-settings" : `/store-settings/${tab}`);

export function StoreDesignPage() {
  // The guard is what a switch of section asks before dropping a section's
  // unsaved draft; the sections' SettingsFormFooter / useReportDirty report into it.
  return (
    <UnsavedGuardProvider>
      <StoreDesignBody />
    </UnsavedGuardProvider>
  );
}

function StoreDesignBody() {
  const t = useT(STRINGS);
  const d = useT(DESCRIPTIONS);
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  // No section in the path (or one that does not exist): a phone shows the list, a desktop opens «عام».
  const urlTab: TabKey | null = TABS.includes(tab as TabKey) ? (tab as TabKey) : null;
  // The section on screen. It follows the URL — but with an unsaved draft open,
  // only once the merchant has said so, since switching unmounts the section.
  const [active, setActive] = useState<TabKey | null>(urlTab);
  const { dirty, confirmLeave } = useUnsavedGuard();
  // The switch the merchant has just agreed to (SettingsLayout asked `canLeave` first).
  const approved = useRef<{ tab: TabKey | null } | null>(null);
  // The section was opened from the phone list in this visit: its back row can step back in history.
  const pushedFromList = useRef(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // SettingsLayout has already asked `canLeave` when it calls this.
  function select(id: string | null) {
    const next = id !== null && TABS.includes(id as TabKey) ? (id as TabKey) : null;
    if (next === urlTab) return;
    approved.current = { tab: next };
    if (next === null) {
      // Back to the list (phone). Opened from the list: step back, so the browser's Back does not return here.
      if (pushedFromList.current) {
        pushedFromList.current = false;
        navigate(-1);
      } else {
        navigate(pathOf(null), { replace: true });
      }
      return;
    }
    if (urlTab === null) {
      if (isDesktopNow()) {
        // The desktop opening its first section by itself: the address is corrected, not added to.
        navigate(pathOf(next), { replace: true });
      } else {
        // List → section on a phone is a push: the browser's Back returns to the list.
        pushedFromList.current = true;
        navigate(pathOf(next));
      }
      return;
    }
    navigate(pathOf(next));
  }

  // The URL can change without the list (a link into /store-settings/…,
  // back/forward). Nothing unsaved, or just approved above: follow it.
  // Otherwise ask, and on «كمّل تعديل» put the URL back where the screen is.
  useEffect(() => {
    if (urlTab === active) return;
    const wasApproved = approved.current !== null && approved.current.tab === urlTab;
    // With no section in the path a desktop already shows the first one: naming it in the address unmounts nothing.
    const sameScreen = active === null && urlTab === FIRST && isDesktopNow();
    if (!dirty || wasApproved || sameScreen) {
      approved.current = null;
      if (urlTab === null) pushedFromList.current = false;
      setActive(urlTab);
      return;
    }
    let stale = false;
    void confirmLeave().then((leave) => {
      if (stale) return;
      if (leave) {
        if (urlTab === null) pushedFromList.current = false;
        setActive(urlTab);
      } else {
        // The entry we stand on is no longer the one pushed from the list: the back row must not step out of the page.
        pushedFromList.current = false;
        navigate(pathOf(active), { replace: true });
      }
    });
    return () => {
      stale = true;
    };
  }, [urlTab, active, dirty, confirmLeave, navigate]);

  // Custom domains closed on this server (handoff 341): "Domains" leaves the list.
  const domainsClosed = useCustomDomainsClosed();
  const sections = useMemo<SettingsSectionDef[]>(
    () =>
      SECTIONS.filter((section) => !(section.id === "domains" && domainsClosed)).map((section) => ({
        id: section.id,
        label: t[section.id],
        description: d[section.id],
        icon: section.icon,
        tone: section.tone,
        group: t[`group_${section.group}`],
        keywords: section.keywords,
      })),
    [t, d, domainsClosed]
  );

  // What the pane holds: the chosen section, or — with none chosen, on a desktop — the first.
  const shown: TabKey = active ?? FIRST;
  const meta = SECTIONS.find((section) => section.id === shown) ?? SECTIONS[0];

  return (
    <>
      <SettingsLayout
        title={t.title}
        sections={sections}
        current={active}
        onSelect={select}
        canLeave={confirmLeave}
        searchPlaceholder={t.search}
      >
        <SettingsPane
          title={t[shown]}
          description={d[shown]}
          icon={meta.icon}
          tone={meta.tone}
          actions={
            <Button type="button" variant="outline" className="min-h-11 rounded-full px-4 lg:min-h-9" onClick={() => setPreviewOpen(true)}>
              <IconEye className="size-4" aria-hidden />
              {t.seeStore}
            </Button>
          }
        >
          {/* Keyed by workspace so a store switch never shows the previous store's draft. */}
          {shown === "general" && <GeneralTab key={workspaceId} />}
          {shown === "store-info" && <StoreInfoTab key={workspaceId} />}
          {shown === "branches" && <BranchesTab key={workspaceId} />}
          {shown === "policies" && <PoliciesTab key={workspaceId} />}
          {shown === "checkout-form" && <CheckoutFormTab key={workspaceId} />}
          {shown === "gift-options" && <GiftOptionsTab key={workspaceId} />}
          {shown === "thank-you" && <ThankYouTab key={workspaceId} />}
          {shown === "survey" && <SurveySettingsTab key={workspaceId} />}
          {shown === "pages" && <PagesTab key={workspaceId} />}
          {shown === "seo" && <SeoTab key={workspaceId} />}
          {shown === "redirects" && <RedirectsTab key={workspaceId} />}
          {shown === "languages" && <LanguagesTab key={workspaceId} />}
          {shown === "domains" && <DomainsTab key={workspaceId} />}
          {shown === "store-access" && <StoreAccessTab key={workspaceId} />}
          {shown === "customer-accounts" && <CustomerAccountsTab key={workspaceId} />}
          {/* «الدخول بحساب جوجل»: its own part under the accounts — another permission, another save (handoff 217). */}
          {shown === "customer-accounts" && <ShopperGoogleCard key={`google-${workspaceId}`} />}
          {shown === "privacy" && <PrivacyTab key={workspaceId} />}
          {shown === "custom-code" && <CustomCodeSection key={workspaceId} />}
        </SettingsPane>
      </SettingsLayout>

      <Sheet open={previewOpen} onOpenChange={setPreviewOpen} title={t.previewTitle} description={t.previewDescription} size="lg">
        <StoreLivePreview workspaceId={workspaceId} />
      </Sheet>
    </>
  );
}
