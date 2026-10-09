import type { Messages } from "@/i18n/LocaleContext";

/**
 * What each public-API scope lets an app do, in the merchant's words (the
 * scope list is the backend's apiKeys/apiKeyService.js SCOPES). Read on the
 * approval screen under «التطبيق ده عايز:» and beside each tick in the
 * developer's form. A scope the server adds later shows under its own name
 * until it gets a line here (`scopeLabel`).
 */
export const SCOPE_STRINGS = {
  en: {
    "orders:read": "See your orders",
    "orders:write": "Create, update and cancel orders",
    "orders:create": "Create orders",
    "orders:update": "Update orders: status, confirmation, notes, tracking",
    "orders:delete": "Cancel orders",
    "products:read": "See your products and stock",
    "products:create": "Add products",
    "products:update": "Edit products and stock",
    "products:delete": "Archive products",
    "categories:read": "See your categories",
    "categories:create": "Add categories",
    "categories:update": "Edit categories",
    "categories:delete": "Delete categories",
    "customers:read": "See your customers",
    "discounts:read": "See your discount codes",
    "discounts:write": "Create and edit discount codes",
    "shipping_areas:read": "See your shipping areas and prices",
    "shipping_areas:write": "Change your shipping prices",
    "webhooks:write": "Be told as things happen in your store (webhooks)",
    "analytics:read": "See your sales reports",
    "funnels:read": "See your funnels and their pages",
    "funnels:write": "Create funnels as drafts",
  },
  ar: {
    "orders:read": "يشوف طلباتك",
    "orders:write": "ينشئ ويعدّل ويلغي الطلبات",
    "orders:create": "ينشئ طلبات",
    "orders:update": "يعدّل الطلبات: الحالة والتأكيد والملاحظات والتتبع",
    "orders:delete": "يلغي طلبات",
    "products:read": "يشوف منتجاتك والمخزون",
    "products:create": "يضيف منتجات",
    "products:update": "يعدّل المنتجات والمخزون",
    "products:delete": "يؤرشف منتجات",
    "categories:read": "يشوف التصنيفات",
    "categories:create": "يضيف تصنيفات",
    "categories:update": "يعدّل التصنيفات",
    "categories:delete": "يحذف تصنيفات",
    "customers:read": "يشوف عملاءك",
    "discounts:read": "يشوف أكواد الخصم",
    "discounts:write": "ينشئ ويعدّل أكواد الخصم",
    "shipping_areas:read": "يشوف مناطق وأسعار الشحن",
    "shipping_areas:write": "يغيّر أسعار الشحن",
    "webhooks:write": "يتبلّغ أول بأول باللي بيحصل في متجرك (webhooks)",
    "analytics:read": "يشوف تقارير المبيعات",
    "funnels:read": "يشوف مسارات البيع وصفحاتها",
    "funnels:write": "ينشئ مسارات بيع كمسودة",
  },
} satisfies Messages;

/** The scope in words, or its own name when it has no line yet. */
export function scopeLabel(labels: Record<string, string>, scope: string): string {
  return labels[scope] ?? scope;
}

/** "orders" of "orders:read": what a scope is about, for grouping the developer's ticks. */
export function scopeResource(scope: string): string {
  return scope.split(":")[0] ?? scope;
}
