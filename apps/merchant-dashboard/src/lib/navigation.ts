import type { Messages } from "@/i18n/LocaleContext";

export type NavKey =
  | "overview"
  | "orders"
  | "confirmationQueue"
  | "catalog"
  | "customers"
  | "discounts"
  | "shipping"
  | "website"
  | "funnels"
  | "settings";

export interface NavItem {
  /** Key into NAV_LABELS — the visible label is resolved per locale. */
  key: NavKey;
  to: string;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "overview", to: "/" },
  { key: "orders", to: "/orders" },
  { key: "confirmationQueue", to: "/confirmation-queue" },
  { key: "catalog", to: "/catalog" },
  { key: "customers", to: "/customers" },
  { key: "discounts", to: "/discounts" },
  { key: "shipping", to: "/shipping" },
  { key: "website", to: "/website" },
  { key: "funnels", to: "/funnels" },
  { key: "settings", to: "/settings" },
];

/** Sidebar / drawer labels. Read with `useT(NAV_LABELS)`. */
export const NAV_LABELS = {
  en: {
    overview: "Overview",
    orders: "Orders",
    confirmationQueue: "Confirmation Queue",
    catalog: "Catalog",
    customers: "Customers",
    discounts: "Discounts",
    shipping: "Shipping & Tax",
    website: "Website",
    funnels: "Funnels",
    settings: "Settings",
  },
  ar: {
    overview: "نظرة عامة",
    orders: "الطلبات",
    confirmationQueue: "قائمة التأكيد",
    catalog: "الكتالوج",
    customers: "العملاء",
    discounts: "الخصومات",
    shipping: "الشحن والضرائب",
    website: "الموقع",
    funnels: "مسارات البيع",
    settings: "الإعدادات",
  },
} satisfies Messages<NavKey>;
