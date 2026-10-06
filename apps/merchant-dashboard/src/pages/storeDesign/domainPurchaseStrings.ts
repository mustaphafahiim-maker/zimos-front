import { createElement, Fragment, type ReactNode } from "react";
import type { DomainPrice } from "@store-builder/api-client";
import type { Messages } from "@/i18n/LocaleContext";
import { formatMinorMoney } from "@/lib/format";

/** Store settings → Domains → "Buy a domain" and "Bought domains" (handoff item 176). */
export const PURCHASE_STRINGS = {
  en: {
    buyTitle: "Buy a domain",
    buyDescription: "Search for a name and buy it here: your store is connected to it with no DNS work, and it renews itself.",
    searchLabel: "Search for a name",
    searchPlaceholder: "mystore",
    search: "Search",
    searching: "Searching…",
    badQuery: "Type a name in English letters or digits, like mystore.",
    resultsFor: "Names for “{query}”",
    noResults: "No names came back for this search. Try another name.",
    available: "Available",
    taken: "Taken",
    perYear: "{price} / year",
    priceOnRequest: "Price on request",
    buy: "Buy",
    buyNamed: "Buy {domain}",
    liveOn: "Your store is live on {domain}",
    sslSoon: "Its secure certificate (SSL) may take a few minutes.",
    registeredUntil: "Registered until {date}.",
    buyAnother: "Buy another domain",
    connectFailedTitle: "{domain} is bought, but not connected to your store yet",
    connectFailedBody: "Our support team will finish connecting it — you don't need to buy it again. It's listed under “Bought domains” below.",
    storeNotSetUp: "Set up your store's website first — the domain needs a store to open on. Nothing was charged.",
    setUpWebsite: "Set up your website",

    dialogTitle: "Buy a domain",
    dialogDescription: "Check the price and the length, then confirm.",
    domain: "Domain",
    length: "Length",
    price: "Price",
    priceTimesYears: "{price} / year × {years}",
    autoRenew: "Renews automatically",
    autoRenewHint: "In its last 30 days it is renewed for another year.",
    renewalPrice: "Renewal: {price} / year",
    priceChanged: "The price changed — check it and confirm again",
    confirm: "Confirm and buy",
    buying: "Buying…",
    cancel: "Cancel",
    year1: "1 year",
    year2: "2 years",
    yearN: "{n} years",

    boughtTitle: "Bought domains",
    boughtDescription: "The domains you bought here: when they expire and whether they renew themselves.",
    colDomain: "Domain",
    colStatus: "Status",
    colExpires: "Expires",
    colAutoRenew: "Renews automatically",
    colActions: "Actions",
    status_pending: "Being bought",
    status_active: "Active",
    status_failed: "Failed",
    status_expired: "Expired",
    status_not_connected: "Not connected yet",
    issueNotConnected: "Bought, but not connected to your store yet — our support team will finish it.",
    issueNotBought: "Couldn't be bought — nothing was charged.",
    issueRenewFailed: "The last renewal didn't go through. Try “Renew now”.",
    issueOther: "Something went wrong with this domain — our support team can check it.",
    autoRenewFor: "Renews automatically: {domain}",
    autoRenewOn: "{domain} will renew itself.",
    autoRenewOff: "{domain} won't renew itself anymore.",
    renewNow: "Renew now",
    renewNamed: "Renew {domain} now",
    renewTitle: "Renew now",
    renewBody: "{domain} expires on {date}. Renewing adds the length you choose.",
    renewFor: "Renew for",
    renewing: "Renewing…",
    renewedToast: "{domain} renewed. It now expires on {date}.",
    quoteLoading: "Checking the price…",
    renewQuote: "Renew for {price} until {date}",
    renewQuoteNoPrice: "Renew until {date}",
    renewPriceLater: "Price on request — it will be confirmed later.",
    renewNotActive: "This domain can't be renewed right now: its purchase isn't active. We've updated the list with its status.",
    retry: "Try again",
  },
  ar: {
    buyTitle: "اشتري دومين",
    buyDescription: "دوّر على اسم واشتريه من هنا: متجرك بيتربط بيه من غير ما تظبط DNS، وبيتجدد لوحده.",
    searchLabel: "دوّر على اسم",
    searchPlaceholder: "mystore",
    search: "دوّر",
    searching: "بيدوّر…",
    badQuery: "اكتب الاسم بحروف إنجليزي أو أرقام، زي mystore.",
    resultsFor: "أسماء لـ «{query}»",
    noResults: "مفيش أسماء رجعت للبحث ده. جرّب اسم تاني.",
    available: "متاح",
    taken: "محجوز",
    perYear: "{price} في السنة",
    priceOnRequest: "السعر عند الطلب",
    buy: "اشتري",
    buyNamed: "اشتري {domain}",
    liveOn: "متجرك شغال على {domain}",
    sslSoon: "شهادة الأمان (SSL) ممكن تاخد كام دقيقة.",
    registeredUntil: "محجوز لحد {date}.",
    buyAnother: "اشتري دومين تاني",
    connectFailedTitle: "{domain} اتشترى، بس لسه متربطش بمتجرك",
    connectFailedBody: "فريق الدعم هيكمّل ربطه — مش محتاج تشتريه تاني. هتلاقيه تحت في «الدومينات اللي اشتريتها».",
    storeNotSetUp: "جهّز موقع متجرك الأول — الدومين محتاج متجر يفتح عليه. مفيش أي فلوس اتخصمت.",
    setUpWebsite: "جهّز موقعك",

    dialogTitle: "اشتري دومين",
    dialogDescription: "راجع السعر والمدة، وبعدين أكّد.",
    domain: "الدومين",
    length: "المدة",
    price: "السعر",
    priceTimesYears: "{price} في السنة × {years}",
    autoRenew: "بيتجدد لوحده",
    autoRenewHint: "في آخر ٣٠ يوم من مدته بيتجدد سنة كمان.",
    renewalPrice: "التجديد: {price} في السنة",
    priceChanged: "السعر اتغير — راجعه وأكّد تاني",
    confirm: "أكّد واشتري",
    buying: "بنشتري…",
    cancel: "إلغاء",
    year1: "سنة",
    year2: "سنتين",
    yearN: "{n} سنين",

    boughtTitle: "الدومينات اللي اشتريتها",
    boughtDescription: "الدومينات اللي اشتريتها من هنا: بتنتهي امتى، وهل بتتجدد لوحدها.",
    colDomain: "الدومين",
    colStatus: "الحالة",
    colExpires: "بينتهي",
    colAutoRenew: "بيتجدد لوحده",
    colActions: "إجراءات",
    status_pending: "بيتشترى",
    status_active: "شغال",
    status_failed: "فشل",
    status_expired: "انتهى",
    status_not_connected: "لسه متربطش",
    issueNotConnected: "اتشترى، بس لسه متربطش بمتجرك — فريق الدعم هيكمّل ربطه.",
    issueNotBought: "معرفناش نشتريه — ومفيش أي فلوس اتخصمت.",
    issueRenewFailed: "آخر تجديد منجحش. جرّب «جدّد دلوقتي».",
    issueOther: "حصلت مشكلة في الدومين ده — فريق الدعم يقدر يراجعها.",
    autoRenewFor: "بيتجدد لوحده: {domain}",
    autoRenewOn: "{domain} هيتجدد لوحده.",
    autoRenewOff: "{domain} مش هيتجدد لوحده تاني.",
    renewNow: "جدّد دلوقتي",
    renewNamed: "جدّد {domain} دلوقتي",
    renewTitle: "جدّد دلوقتي",
    renewBody: "{domain} بينتهي يوم {date}. التجديد بيزوّد المدة اللي هتختارها.",
    renewFor: "جدّد لمدة",
    renewing: "بنجدّد…",
    renewedToast: "{domain} اتجدد. دلوقتي بينتهي يوم {date}.",
    quoteLoading: "بنشوف السعر…",
    renewQuote: "جدّد بـ {price} لحد {date}",
    renewQuoteNoPrice: "جدّد لحد {date}",
    renewPriceLater: "السعر عند الطلب — هيتأكد بعدين.",
    renewNotActive: "الدومين ده مينفعش يتجدد دلوقتي: شراؤه مش شغال. حدّثنا القايمة بحالته.",
    retry: "جرّب تاني",
  },
} satisfies Messages;

export type PurchaseStrings = (typeof PURCHASE_STRINGS)["en"];

/** A registrar quote as sent (minor units of its own currency); never computed here. */
export function formatDomainPrice(price: DomainPrice): string {
  return formatMinorMoney(price.amount, price.currency);
}

/** "1 year" / "سنة", "2 years" / "سنتين", "3 years" / "٣ سنين". */
export function yearsLabel(t: PurchaseStrings, years: number, intlLocale: string): string {
  if (years === 1) return t.year1;
  if (years === 2) return t.year2;
  return t.yearN.replace("{n}", new Intl.NumberFormat(intlLocale).format(years));
}

/**
 * Puts a node (a domain name, kept left-to-right) where `{token}` stands in a
 * translated sentence, so the sentence's word order follows the language.
 */
export function placeNode(template: string, token: string, node: ReactNode): ReactNode {
  const [before, ...rest] = template.split(`{${token}}`);
  if (rest.length === 0) return template;
  // Separate children (not an array), so React needs no keys.
  return createElement(Fragment, null, before, node, rest.join(`{${token}}`));
}
