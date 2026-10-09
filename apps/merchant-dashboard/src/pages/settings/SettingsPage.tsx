import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { UnsavedGuardProvider, useUnsavedGuard } from "@/lib/useUnsavedGuard";
import { useViewNavigate } from "@/lib/viewTransition";
import { storeHost } from "@/lib/storeAddress";
import {
  SettingsGroup,
  SettingsLayout,
  SettingsLinkRow,
  SettingsPane,
  type SettingsSectionDef,
  type SettingsTone,
} from "@/components/settings";
import {
  IconAccount,
  IconActivity,
  IconAi,
  IconBell,
  IconCard,
  IconClock,
  IconCode,
  IconCrown,
  IconDevices,
  IconEmail,
  IconFilter,
  IconGift,
  IconHoliday,
  IconInventory,
  IconKey,
  IconLink,
  IconMessage,
  IconOrders,
  IconPeople,
  IconReferrals,
  IconShield,
  IconStore,
  IconTeam,
  IconTheme,
  IconWhatsApp,
  type IconComponent,
} from "@/components/icons";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { LocationsSection } from "@/pages/inventory/LocationsSection";
import { DEVELOPERS_PATH, PARTNER_APP_STRINGS } from "@/pages/partnerApps/partnerAppStrings";
import { BillingSection, canOpenBilling } from "./BillingSection";
import { WhatsAppMessageSection } from "./WhatsAppMessageSection";
import { WhatsappSection } from "./WhatsappSection";
import { CatalogSettingsSection } from "./CatalogSettingsSection";
import { OrderBumpSettingsSection } from "./OrderBumpSettingsSection";
import { AccountSection } from "./AccountSection";
import { AppearanceSection } from "./AppearanceSection";
import { AccountSettingsSection } from "./AccountSettingsSection";
import { StoreAddressSection } from "./StoreAddressSection";
import { SecuritySection } from "./SecuritySection";
import { OwnershipTransferSection } from "./OwnershipTransferSection";
import { DevelopersSection, canManageDevelopers } from "./DevelopersSection";
import { NotificationPreferencesSection } from "./NotificationPreferencesSection";
import { SummaryReportsSection } from "./SummaryReportsSection";
import { OrderEmailsSection } from "./OrderEmailsSection";
// The store's Telegram / Slack / Discord channels for alerts (handoff 378).
import { TeamChannelsSection } from "./teamChannels/TeamChannelsSection";
import { OrderSelfServiceSection } from "./OrderSelfServiceSection";
import { OrderConfirmLinkSetting } from "./OrderConfirmLinkSetting";
// Handoff 381: short store order numbers (#1001).
import { OrderNumbersSection } from "./OrderNumbersSection";
import { IconListNumbers } from "@/components/icons";
import { HolidayModeSection } from "./HolidayModeSection";
import { StoreIdentitySection } from "./sections/StoreIdentitySection";
import { TeamGroupsSection, TeamMembersSection } from "./sections/TeamSections";
import { DevicesSection } from "./sections/DevicesSection";
import { NoAccess } from "./sections/SettingsCard";

const STRINGS = {
  en: {
    pageTitle: "Settings",
    searchPlaceholder: "Search settings…",
    // The headings of the list.
    g_store: "The store",
    g_orders: "Orders",
    g_messages: "Messages",
    g_team: "Team",
    g_billing: "Plan",
    g_account: "My account",
    g_developers: "For developers",
    g_more: "More",
    // Each section: its name in the list, and one line of what it is for.
    s_identity: "Store identity",
    d_identity: "Name, logo, tagline and colours",
    s_address: "Store address",
    d_address: "The zimos.co address your store is on",
    s_account_settings: "Time zone and invoices",
    d_account_settings: "The store's clock, the contact email and the business on invoices",
    s_locations: "Locations",
    d_locations: "The warehouses and shops your stock is in",
    s_catalog: "Product listing",
    d_catalog: "Filters and sorting on the store's product pages",
    s_order_bump: "Offer with the order",
    d_order_bump: "One add-on offer shown above the order button",
    s_self_service: "Customer self-service",
    d_self_service: "Let customers cancel or fix the address themselves",
    s_order_numbers: "Order numbers",
    d_order_numbers: "The prefix, the suffix and where numbering starts",
    s_holiday: "Holiday mode",
    d_holiday: "Pause orders, or take them and ship later",
    s_whatsapp_message: "WhatsApp message",
    d_whatsapp_message: "What the confirmation message says",
    s_whatsapp: "WhatsApp connection",
    d_whatsapp: "Your WhatsApp Business number, for the inbox and automations",
    s_order_emails: "Order emails",
    d_order_emails: "The emails customers get, who they are from, your own domain",
    s_members: "Members and invites",
    d_members: "Who can sign in to this store, and inviting more",
    s_groups: "Groups",
    d_groups: "Admins and members, and what each may do",
    s_ownership: "Transfer ownership",
    d_ownership: "Hand the store to someone on the team",
    s_billing: "Plan and billing",
    d_billing: "Your plan, what is due and this month's usage",
    s_profile: "Profile",
    d_profile: "Your name, picture, username, email and phone",
    s_appearance: "Language and look",
    d_appearance: "Arabic or English, light or dark, glass",
    s_notifications: "Notifications",
    d_notifications: "What you are told about, and where",
    s_security: "Security",
    d_security: "Two-step sign-in, password and support access",
    s_devices: "Devices",
    d_devices: "Where your account is signed in",
    s_developers: "API keys and webhooks",
    d_developers: "Connect other systems to this store",
    s_my_apps: "My apps",
    d_my_apps: "Apps you build for ZIMOS stores",
    s_ai_assistants: "AI assistants",
    d_ai_assistants: "Let Claude or ChatGPT read your store",
    s_activity: "Activity log",
    d_activity: "Who did what, and when, in the store",
    s_referrals: "Refer and earn",
    d_referrals: "Invite another merchant and earn credit",
    // No permission: what is closed, and who opens it.
    noAccessTitle: "{name} isn't part of your role",
    noAccess_billing: "The plan is for the store owner and the accountant. Ask the owner to change your role from Settings → Team.",
    noAccess_ai_assistants: "Only the store owner or a manager can set up AI assistants. Ask the owner to change your role from Settings → Team.",
    noAccess_ownership: "Only the person who owns the store can hand it to someone else.",
    storeCardRole: "You are signed in to this store",
  },
  ar: {
    pageTitle: "الإعدادات",
    searchPlaceholder: "دوّر في الإعدادات…",
    g_store: "المتجر",
    g_orders: "الأوردرات",
    g_messages: "الرسايل",
    g_team: "الفريق",
    g_billing: "الباقة",
    g_account: "حسابي",
    g_developers: "للمطوّرين",
    g_more: "كمان",
    s_identity: "هوية المتجر",
    d_identity: "الاسم واللوجو وجملة التعريف والألوان",
    s_address: "عنوان المتجر",
    d_address: "عنوان zimos.co اللي متجرك شغّال عليه",
    s_account_settings: "التوقيت والفواتير",
    d_account_settings: "توقيت المتجر وإيميل التواصل وبيانات نشاطك على الفواتير",
    s_locations: "المخازن",
    d_locations: "المخازن والفروع اللي فيها بضاعتك",
    s_catalog: "إعدادات الكتالوج",
    d_catalog: "الفلاتر والترتيب في صفحات المنتجات بالمتجر",
    s_order_bump: "عرض مع الأوردر",
    d_order_bump: "عرض إضافي واحد بيظهر فوق زرار الطلب",
    s_self_service: "خدمة العميل لنفسه",
    d_self_service: "العميل يلغي أوردره أو يصلّح عنوانه بنفسه",
    s_order_numbers: "ترقيم الطلبات",
    d_order_numbers: "البادئة واللاحقة والرقم اللي الترقيم يبدأ منه",
    s_holiday: "وضع الإجازة",
    d_holiday: "وقّف الأوردرات، أو اقبلها واشحن بعدين",
    s_whatsapp_message: "رسالة واتساب",
    d_whatsapp_message: "كلام رسالة تأكيد الأوردر",
    s_whatsapp: "ربط واتساب",
    d_whatsapp: "رقم واتساب بيزنس بتاعك، للرسايل والأتمتة",
    s_order_emails: "إيميلات الأوردرات",
    d_order_emails: "الإيميلات اللي بتوصل العميل، باسم مين، ودومينك",
    s_members: "الأعضاء والدعوات",
    d_members: "مين يقدر يدخل المتجر، وادعُ غيرهم",
    s_groups: "المجموعات",
    d_groups: "المديرين والأعضاء، وكل مجموعة تعمل إيه",
    s_ownership: "نقل الملكية",
    d_ownership: "سلّم المتجر لحد من الفريق",
    s_billing: "الباقة والفواتير",
    d_billing: "باقتك، والمطلوب دفعه، واستهلاك الشهر",
    s_profile: "الملف الشخصي",
    d_profile: "اسمك وصورتك واسم المستخدم والإيميل والموبايل",
    s_appearance: "اللغة والشكل",
    d_appearance: "عربي أو إنجليزي، فاتح أو غامق، الزجاج",
    s_notifications: "الإشعارات",
    d_notifications: "إيه اللي يوصلك، وفين",
    s_security: "الأمان",
    d_security: "الدخول بخطوتين وكلمة السر وإذن الدعم",
    s_devices: "الأجهزة",
    d_devices: "حسابك داخل من فين",
    s_developers: "مفاتيح API والـ webhooks",
    d_developers: "اربط أنظمة تانية بالمتجر ده",
    s_my_apps: "تطبيقاتي",
    d_my_apps: "تطبيقات بتعملها لمتاجر زيموس",
    s_ai_assistants: "مساعدين الذكاء الاصطناعي",
    d_ai_assistants: "خلّي Claude أو ChatGPT يقرا متجرك",
    s_activity: "سجل النشاط",
    d_activity: "مين عمل إيه وإمتى في المتجر",
    s_referrals: "اكسب من الإحالة",
    d_referrals: "ادعُ تاجر تاني واكسب رصيد",
    noAccessTitle: "«{name}» مش ضمن صلاحياتك",
    noAccess_billing: "الباقة لصاحب المتجر والمحاسب بس. اطلب من صاحب المتجر يغيّر دورك من الإعدادات ← الفريق.",
    noAccess_ai_assistants: "صاحب المتجر أو المدير بس اللي يقدروا يظبطوا مساعدين الذكاء الاصطناعي. اطلب من صاحب المتجر يغيّر دورك من الإعدادات ← الفريق.",
    noAccess_ownership: "اللي يملك المتجر بس هو اللي يقدر يسلّمه لحد تاني.",
    storeCardRole: "إنت داخل على المتجر ده",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

/**
 * Every section of the page, in the order of the list. The id is what `?tab=`
 * carries. `key` is the id as it is spelled in the string keys (s_<key>,
 * d_<key>), `group` the heading it sits under.
 */
const SECTIONS = [
  { id: "identity", key: "identity", group: "store", icon: IconStore, tone: "blue", words: ["store identity", "name", "logo", "tagline", "colours", "colors", "brand", "هوية", "الاسم", "اللوجو", "الشعار", "ألوان"] },
  { id: "address", key: "address", group: "store", icon: IconLink, tone: "teal", words: ["store address", "slug", "subdomain", "link", "url", "zimos.co", "عنوان", "لينك", "رابط"] },
  { id: "account-settings", key: "account_settings", group: "store", icon: IconClock, tone: "gray", words: ["time zone", "timezone", "invoice", "legal", "contact email", "country", "region", "المنطقة", "التوقيت", "فاتورة", "الفواتير", "البلد", "العملة"] },
  { id: "locations", key: "locations", group: "store", icon: IconInventory, tone: "orange", words: ["locations", "warehouse", "stock", "branch", "مخزن", "المخازن", "فرع", "مخزون"] },
  { id: "catalog", key: "catalog", group: "store", icon: IconFilter, tone: "purple", words: ["catalog", "listing", "filters", "sort", "products", "الكتالوج", "فلاتر", "ترتيب", "المنتجات"] },
  { id: "order-bump", key: "order_bump", group: "store", icon: IconGift, tone: "pink", words: ["order bump", "add-on", "upsell", "offer", "checkout", "عرض", "إضافة", "الدفع"] },
  { id: "self-service", key: "self_service", group: "orders", icon: IconOrders, tone: "green", words: ["self service", "cancel", "change address", "customer", "إلغاء", "يلغي", "تغيير العنوان", "العميل"] },
  { id: "order-numbers", key: "order_numbers", group: "orders", icon: IconListNumbers, tone: "blue", words: ["order numbers", "numbering", "prefix", "suffix", "#1001", "ترقيم", "رقم الطلب", "رقم الأوردر", "بادئة", "لاحقة"] },
  { id: "holiday", key: "holiday", group: "orders", icon: IconHoliday, tone: "orange", words: ["holiday", "vacation", "pause", "away", "إجازة", "أجازة", "وقّف", "قافل"] },
  { id: "whatsapp-message", key: "whatsapp_message", group: "messages", icon: IconMessage, tone: "green", words: ["whatsapp message", "template", "confirmation", "رسالة", "واتساب", "تأكيد", "قالب"] },
  { id: "whatsapp", key: "whatsapp", group: "messages", icon: IconWhatsApp, tone: "green", words: ["whatsapp", "cloud api", "meta", "connect", "واتساب", "ربط", "ميتا"] },
  { id: "order-emails", key: "order_emails", group: "messages", icon: IconEmail, tone: "blue", words: ["emails", "sender", "sending domain", "dns", "reply-to", "إيميل", "إيميلات", "بريد", "دومين", "المرسل"] },
  { id: "members", key: "members", group: "team", icon: IconTeam, tone: "blue", words: ["team", "members", "invite", "roles", "seats", "الفريق", "أعضاء", "دعوة", "دور", "صلاحيات"] },
  { id: "groups", key: "groups", group: "team", icon: IconPeople, tone: "purple", words: ["groups", "admins", "members", "permissions", "المجموعات", "المديرين", "صلاحيات"] },
  { id: "ownership", key: "ownership", group: "team", icon: IconCrown, tone: "red", words: ["ownership", "transfer", "owner", "ملكية", "نقل", "صاحب المتجر"] },
  { id: "billing", key: "billing", group: "billing", icon: IconCard, tone: "green", words: ["plan", "billing", "subscription", "pay", "usage", "referral code", "الباقة", "الفواتير", "اشتراك", "دفع", "استهلاك"] },
  { id: "profile", key: "profile", group: "account", icon: IconAccount, tone: "blue", words: ["profile", "name", "picture", "avatar", "username", "email", "phone", "اسمي", "صورتي", "اسم المستخدم", "الإيميل", "الموبايل", "حسابي"] },
  { id: "appearance", key: "appearance", group: "account", icon: IconTheme, tone: "purple", words: ["language", "theme", "dark", "light", "glass", "appearance", "اللغة", "عربي", "إنجليزي", "غامق", "فاتح", "داكن", "زجاج", "المظهر"] },
  { id: "notifications", key: "notifications", group: "account", icon: IconBell, tone: "red", words: ["notifications", "push", "sound", "summary reports", "email", "إشعارات", "تنبيهات", "صوت", "تقارير"] },
  { id: "security", key: "security", group: "account", icon: IconShield, tone: "green", words: ["security", "two-step", "2fa", "two factor", "password", "backup codes", "support access", "الأمان", "خطوتين", "كلمة السر", "رموز احتياطية", "الدعم"] },
  { id: "devices", key: "devices", group: "account", icon: IconDevices, tone: "gray", words: ["devices", "sessions", "sign out", "signed in", "الأجهزة", "جلسات", "خروج"] },
  { id: "developers", key: "developers", group: "developers", icon: IconKey, tone: "gray", words: ["api", "api keys", "webhooks", "developers", "مفاتيح", "ويب هوك", "المطورين"] },
  { id: "my-apps", key: "my_apps", group: "developers", icon: IconCode, tone: "purple", words: ["apps", "partner", "developer apps", "oauth", "تطبيقات", "تطبيقاتي"] },
  { id: "ai-assistants", key: "ai_assistants", group: "developers", icon: IconAi, tone: "teal", words: ["ai", "assistants", "mcp", "claude", "chatgpt", "ذكاء اصطناعي", "مساعد"] },
  { id: "activity", key: "activity", group: "more", icon: IconActivity, tone: "gray", words: ["activity", "log", "audit", "history", "سجل", "النشاط"] },
  { id: "referrals", key: "referrals", group: "more", icon: IconReferrals, tone: "pink", words: ["referrals", "refer", "earn", "credit", "إحالة", "اكسب", "رصيد"] },
] as const satisfies ReadonlyArray<{ id: string; key: string; group: string; icon: IconComponent; tone: SettingsTone; words: readonly string[] }>;

type SectionId = (typeof SECTIONS)[number]["id"];

const SECTION_IDS: ReadonlySet<string> = new Set(SECTIONS.map((section) => section.id));

function isSectionId(value: string | null): value is SectionId {
  return value !== null && SECTION_IDS.has(value);
}

/** The seven tabs the page had: each old `?tab=` value lands on the first section of its group. */
const LEGACY_TAB: Record<string, SectionId> = {
  store: "identity",
  orders: "self-service",
  messages: "whatsapp-message",
  team: "members",
  account: "profile",
  // "billing" and "developers" are still section ids.
};

/** Old deep links (#whatsapp, #notifications…) still land on the right section. */
const HASH_SECTION: Record<string, SectionId> = {
  whatsapp: "whatsapp",
  notifications: "notifications",
  "summary-reports": "notifications",
  "order-emails": "order-emails",
  locations: "locations",
  billing: "billing",
  team: "members",
  security: "security",
  developers: "developers",
};

/** A block inside a section that a link may point at: brought into view once the section is drawn. */
const SCROLL_ANCHORS: ReadonlySet<string> = new Set(["summary-reports", "team-channels"]);

/** Two rows of the list are other pages: choosing them goes there. */
const LINK_SECTIONS: Partial<Record<SectionId, string>> = {
  activity: "/activity",
  referrals: "/referrals",
};

/** Tailwind's `lg`, where SettingsLayout puts the list and the pane side by side. */
const DESKTOP = "(min-width: 64rem)";

/**
 * A link that names one of the user's stores (?workspace=<id>, as on the way
 * back from the subscription payment page) opens that store, since the
 * current store is whichever was picked last in this browser.
 */
function useStoreFromLink() {
  const [params] = useSearchParams();
  const { workspaces, currentWorkspace, selectWorkspace } = useWorkspace();
  const wanted = params.get("workspace");
  useEffect(() => {
    if (wanted && wanted !== currentWorkspace?.id && workspaces.some((w) => w.id === wanted)) selectWorkspace(wanted);
  }, [wanted, currentWorkspace?.id, workspaces, selectWorkspace]);
}

/**
 * The section in the URL, and the way to change it.
 *
 * `?tab=<section id>`; an old tab name (`?tab=account`), an old `#anchor`, or
 * a return from the payment page (`?workspace=`) is read as the section it
 * means and the URL is rewritten to say so. `null` = none chosen: a phone
 * shows the list, a desktop the first section.
 *
 * On a phone, going from the list into a section adds a history entry, so the
 * browser's Back returns to the list; the back row of the pane goes back to
 * that same entry. Everywhere else the URL is replaced — switching sections
 * does not pile up history.
 */
function useSettingsUrl(): { current: SectionId | null; select: (id: string | null) => void } {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const viewNavigate = useViewNavigate();

  const raw = params.get("tab");
  const hash = location.hash.replace("#", "");
  const current: SectionId | null = isSectionId(raw)
    ? raw
    : ((raw !== null ? LEGACY_TAB[raw] : undefined) ?? HASH_SECTION[hash] ?? (params.get("workspace") ? "billing" : null));

  // The block a link pointed at inside its section, kept past the rewrite of the URL below.
  const anchor = useRef<string | null>(null);

  // An old link: say the section in the URL the way the page writes it now (the other params stay).
  useEffect(() => {
    if (current === null || raw === current) return;
    if (SCROLL_ANCHORS.has(hash)) anchor.current = hash;
    const next = new URLSearchParams(location.search);
    next.set("tab", current);
    navigate({ search: `?${next.toString()}`, hash: "" }, { replace: true, state: location.state });
  }, [current, raw, hash, location.search, location.state, navigate]);

  useEffect(() => {
    if (anchor.current === null && SCROLL_ANCHORS.has(hash)) anchor.current = hash;
    const id = anchor.current;
    if (!id) return;
    // Once the section is drawn (the layout scrolls to the top on a switch first).
    const timer = window.setTimeout(() => {
      anchor.current = null;
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [current, hash]);

  const fromList = (location.state as { settingsFromList?: boolean } | null)?.settingsFromList === true;

  const select = useCallback(
    (id: string | null) => {
      const link = id !== null && isSectionId(id) ? LINK_SECTIONS[id] : undefined;
      if (link) {
        viewNavigate(link);
        return;
      }
      const phone = !window.matchMedia(DESKTOP).matches;
      const next = new URLSearchParams(window.location.search);
      if (id === null) {
        // Back to the list: the entry it was opened from, when there is one.
        if (phone && fromList) {
          navigate(-1);
          return;
        }
        next.delete("tab");
        const search = next.toString();
        navigate({ search: search ? `?${search}` : "", hash: "" }, { replace: true });
        return;
      }
      next.set("tab", id);
      const push = phone && current === null;
      navigate(
        { search: `?${next.toString()}`, hash: "" },
        push ? { state: { settingsFromList: true } } : { replace: true, state: fromList ? { settingsFromList: true } : null }
      );
    },
    [current, fromList, navigate, viewNavigate]
  );

  return { current, select };
}

export function SettingsPage() {
  return (
    // Nothing typed is lost silently: every section that saves on demand reports to this guard,
    // and leaving a section (or the tab, or the browser) asks first.
    <UnsavedGuardProvider>
      <SettingsScreen />
    </UnsavedGuardProvider>
  );
}

function SettingsScreen() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { confirmLeave } = useUnsavedGuard();
  useStoreFromLink();
  const { current, select } = useSettingsUrl();

  const role = currentWorkspace?.role;
  const isOwner = Boolean(currentWorkspace && user && currentWorkspace.ownerUserId === user.id);
  // The same rules the sections themselves apply: a section a role may not open is not listed for it.
  const hidden = useMemo(() => {
    const out = new Set<SectionId>();
    if (!canOpenBilling(role)) out.add("billing");
    if (!canManageDevelopers(role)) out.add("ai-assistants");
    // The store's owner, or someone with the Owner role (who is told why the button is not theirs).
    if (!isOwner && role !== "owner") out.add("ownership");
    return out;
  }, [role, isOwner]);

  const sections = useMemo<SettingsSectionDef[]>(
    () =>
      SECTIONS.filter((section) => !hidden.has(section.id)).map((section) => ({
        id: section.id,
        label: t[`s_${section.key}`],
        description: t[`d_${section.key}`],
        icon: section.icon,
        tone: section.tone,
        group: t[`g_${section.group}`],
        keywords: [...section.words],
      })),
    [hidden, t]
  );

  // A desktop with nothing chosen shows the first section (the layout asks for it in the URL too).
  const shownId: SectionId = current ?? "identity";
  const shown = SECTIONS.find((section) => section.id === shownId) ?? SECTIONS[0];

  return (
    <SettingsLayout
      title={t.pageTitle}
      sections={sections}
      current={current}
      onSelect={select}
      canLeave={confirmLeave}
      searchPlaceholder={t.searchPlaceholder}
      listHeader={<StoreCard t={t} />}
    >
      <SettingsPane
        // A store switch, like a section switch, starts the section afresh.
        key={`${shownId}-${workspaceId}`}
        title={t[`s_${shown.key}`]}
        description={t[`d_${shown.key}`]}
        icon={shown.icon}
        tone={shown.tone}
      >
        {hidden.has(shownId) ? <ClosedSection id={shownId} name={t[`s_${shown.key}`]} t={t} /> : <SectionBody id={shownId} t={t} />}
      </SettingsPane>
    </SettingsLayout>
  );
}

/** Which store these settings belong to: its logo, its name, its address. Over the list. */
function StoreCard({ t }: { t: T }) {
  const { currentWorkspace } = useWorkspace();
  if (!currentWorkspace) return null;
  return (
    <div className="flex items-center gap-3 rounded-[1.25rem] bg-card px-4 py-3 shadow-[var(--shadow-card)] ring-1 ring-line lg:rounded-2xl lg:bg-paper-sunken lg:px-3 lg:py-2.5 lg:shadow-none">
      {currentWorkspace.logoUrl ? (
        <img src={currentWorkspace.logoUrl} alt="" className="size-11 shrink-0 rounded-xl bg-paper object-contain ring-1 ring-line lg:size-9" />
      ) : (
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-lg font-semibold text-primary lg:size-9 lg:text-base">
          {(currentWorkspace.name || "?").charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] leading-5 font-semibold text-ink lg:text-sm">
          <span className="sr-only">{t.storeCardRole}: </span>
          <bdi>{currentWorkspace.name}</bdi>
        </p>
        {currentWorkspace.slug && (
          <p className="truncate text-[13px] leading-5 text-ink-soft lg:text-xs">
            <bdi dir="ltr">{storeHost(currentWorkspace.slug)}</bdi>
          </p>
        )}
      </div>
    </div>
  );
}

/** A known section this role may not open, reached by a link: what is closed and who can open it. */
function ClosedSection({ id, name, t }: { id: SectionId; name: string; t: T }) {
  const reason = id === "billing" ? t.noAccess_billing : id === "ai-assistants" ? t.noAccess_ai_assistants : t.noAccess_ownership;
  return <NoAccess title={t.noAccessTitle.replace("{name}", name)} description={reason} />;
}

/** The content of one section. Each loads and saves itself; the on-demand ones show the shared SaveBar. */
function SectionBody({ id, t }: { id: SectionId; t: T }): ReactNode {
  const apps = useT(PARTNER_APP_STRINGS);
  switch (id) {
    case "identity":
      return <StoreIdentitySection />;
    // The store's address (<slug>.zimos.co), part of the account settings (SPEC §17.3).
    case "address":
      return <StoreAddressSection />;
    case "account-settings":
      return <AccountSettingsSection />;
    case "locations":
      return <LocationsSection inSettings inPane />;
    case "catalog":
      return <CatalogSettingsSection />;
    case "order-bump":
      return <OrderBumpSettingsSection />;
    // What shoppers may do on their own order: cancel, change the address (handoff 220).
    case "self-service":
      return (
        <>
          <OrderSelfServiceSection />
          {/* The shopper confirms a cash-on-delivery order from the store's link (handoff 388). */}
          <OrderConfirmLinkSetting />
        </>
      );
    case "order-numbers":
      return <OrderNumbersSection />;
    // Pause orders, or take them and ship later, while the store is away (handoff 216).
    case "holiday":
      return <HolidayModeSection />;
    case "whatsapp-message":
      return <WhatsAppMessageSection />;
    // The WhatsApp Cloud API connection behind the inbox and automations.
    case "whatsapp":
      return <WhatsappSection />;
    // The emails customers get about their orders.
    case "order-emails":
      return <OrderEmailsSection />;
    case "members":
      return <TeamMembersSection />;
    case "groups":
      return <TeamGroupsSection />;
    // The owner hands the store to someone on the team (handoff 252).
    case "ownership":
      return <OwnershipTransferSection />;
    case "billing":
      return <BillingSection />;
    case "profile":
      return <AccountSection />;
    case "appearance":
      return <AppearanceSection />;
    case "notifications":
      return (
        <>
          <NotificationPreferencesSection />
          {/* The store's daily / weekly summary email and who gets it (handoff 202). */}
          <SummaryReportsSection />
          {/* Alerts to a Telegram group, a Slack or a Discord channel (handoff 378). */}
          <TeamChannelsSection />
        </>
      );
    case "security":
      return <SecuritySection />;
    case "devices":
      return <DevicesSection />;
    // The store's keys and webhooks; a developer's own apps are the account's (handoff 265).
    case "developers":
      return <DevelopersSection part="api" />;
    case "my-apps":
      return (
        <SettingsGroup>
          <SettingsLinkRow to={DEVELOPERS_PATH} icon={IconCode} tone="purple" label={apps.cardTitle} hint={apps.cardBody} />
        </SettingsGroup>
      );
    case "ai-assistants":
      return <DevelopersSection part="ai" />;
    // The two pages reached from Settings: the list goes straight to them; a link to ?tab= lands on this row.
    case "activity":
      return (
        <SettingsGroup>
          <SettingsLinkRow to="/activity" icon={IconActivity} tone="gray" label={t.s_activity} hint={t.d_activity} />
        </SettingsGroup>
      );
    case "referrals":
      return (
        <SettingsGroup>
          <SettingsLinkRow to="/referrals" icon={IconReferrals} tone="pink" label={t.s_referrals} hint={t.d_referrals} />
        </SettingsGroup>
      );
  }
}
