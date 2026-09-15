import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BarChart3,
  Bot,
  Boxes,
  Building2,
  Filter,
  Globe,
  Headphones,
  MessageCircle,
  Home,
  LayoutTemplate,
  Megaphone,
  Package,
  RotateCcw,
  Settings,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  Star,
  Tag,
  TrendingUp,
  Truck,
  Users,
  WandSparkles,
  Workflow,
  Zap,
} from "lucide-react";
import type { Locale } from "@/i18n/LocaleContext";

/** A label in both dashboard languages. */
export interface LocalizedText {
  en: string;
  ar: string;
}

export function localized(text: LocalizedText, locale: Locale): string {
  return text[locale];
}

export interface NavItem {
  label: LocalizedText;
  to: string;
  icon: LucideIcon;
  /** Shows a small "New" pill next to the label. */
  isNew?: boolean;
}

export interface NavGroup {
  /** Stable id used to persist the collapsed state. */
  id: string;
  label: LocalizedText | null;
  items: NavItem[];
}

/**
 * Sidebar structure. Order mirrors a merchant's day: what came in, what to
 * confirm, what to ship, then money, then growth tooling, then configuration.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "main",
    label: null,
    items: [
      { label: { en: "Home", ar: "الرئيسية" }, to: "/", icon: Home },
      { label: { en: "All stores", ar: "كل المتاجر" }, to: "/stores", icon: Building2 },
    ],
  },
  {
    id: "sell",
    label: { en: "Sell", ar: "البيع" },
    items: [
      { label: { en: "Orders", ar: "الطلبات" }, to: "/orders", icon: ShoppingBag },
      { label: { en: "Order pipeline", ar: "مسار الطلبات" }, to: "/orders/pipeline", icon: Filter },
      { label: { en: "Call center", ar: "مركز الاتصال" }, to: "/call-center", icon: Headphones, isNew: true },
      { label: { en: "WhatsApp inbox", ar: "صندوق واتساب" }, to: "/inbox", icon: MessageCircle, isNew: true },
      { label: { en: "Abandoned checkouts", ar: "السلات المتروكة" }, to: "/abandoned-checkouts", icon: ShoppingCart },
      { label: { en: "Returns & RTO", ar: "المرتجعات" }, to: "/returns", icon: RotateCcw },
      { label: { en: "Fraud protection", ar: "الحماية من الاحتيال" }, to: "/fraud", icon: ShieldAlert },
    ],
  },
  {
    id: "money",
    label: { en: "Money", ar: "المالية" },
    items: [
      { label: { en: "Profit & loss", ar: "الأرباح والخسائر" }, to: "/profit", icon: TrendingUp, isNew: true },
      { label: { en: "COD settlements", ar: "تحصيل الشحن" }, to: "/settlements", icon: Banknote, isNew: true },
    ],
  },
  {
    id: "catalog",
    label: { en: "Catalog", ar: "الكتالوج" },
    items: [
      { label: { en: "Products", ar: "المنتجات" }, to: "/catalog", icon: Package },
      { label: { en: "Inventory", ar: "المخزون" }, to: "/inventory", icon: Boxes },
      { label: { en: "Customers", ar: "العملاء" }, to: "/customers", icon: Users },
      { label: { en: "Reviews", ar: "التقييمات" }, to: "/reviews", icon: Star },
    ],
  },
  {
    id: "grow",
    label: { en: "Grow", ar: "النمو" },
    items: [
      { label: { en: "Funnels", ar: "مسارات البيع" }, to: "/funnels", icon: Workflow },
      { label: { en: "Offers & bundles", ar: "العروض والباقات" }, to: "/offers", icon: Zap },
      { label: { en: "Discounts", ar: "الخصومات" }, to: "/discounts", icon: Tag },
      { label: { en: "Pixels & tracking", ar: "البكسلات والتتبع" }, to: "/marketing", icon: Megaphone },
      { label: { en: "Automations", ar: "الأتمتة" }, to: "/automations", icon: Bot, isNew: true },
    ],
  },
  {
    id: "storefront",
    label: { en: "Storefront", ar: "واجهة المتجر" },
    items: [
      { label: { en: "Website", ar: "الموقع" }, to: "/website", icon: Globe },
      { label: { en: "Templates", ar: "القوالب" }, to: "/templates", icon: LayoutTemplate },
      { label: { en: "Landing page generator", ar: "مولّد صفحات الهبوط" }, to: "/generator", icon: WandSparkles, isNew: true },
      { label: { en: "Shipping & carriers", ar: "الشحن وشركات الشحن" }, to: "/shipping", icon: Truck },
    ],
  },
  {
    id: "insights",
    label: { en: "Insights", ar: "الرؤى" },
    items: [
      { label: { en: "Analytics", ar: "التحليلات" }, to: "/analytics", icon: BarChart3 },
      { label: { en: "Settings", ar: "الإعدادات" }, to: "/settings", icon: Settings },
    ],
  },
];

/** Flat list, kept for anything that still iterates the old shape. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** The nav item a pathname belongs to (longest matching prefix), if any. */
export function findNavItem(pathname: string): NavItem | undefined {
  let best: NavItem | undefined;
  for (const item of NAV_ITEMS) {
    const match = item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(`${item.to}/`);
    if (match && (!best || item.to.length > best.to.length)) best = item;
  }
  return best;
}
