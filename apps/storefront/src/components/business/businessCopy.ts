import type { Locale } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";

/**
 * The shopper's words for buying as a company (handoff 228) and paying later
 * on account (handoff 229): the account's «بيانات الشركة» card and «حسابي
 * الآجل» page, the checkout's «ادفع آجل» method with its refusals, and the
 * summary's «معفى» tax line. Kept beside the components that say them, like
 * tenders/tenderCopy.ts. Arabic is Egyptian, as the rest of the store.
 */

const AR_DIGITS = new Intl.NumberFormat("ar-EG");
const EN_DIGITS = new Intl.NumberFormat("en-US");
const FR_DIGITS = new Intl.NumberFormat("fr-FR");

/** «يوم واحد / يومين / ٥ أيام / ٣٠ يوم». */
function daysAr(n: number): string {
  if (n === 1) return "يوم واحد";
  if (n === 2) return "يومين";
  const mod = n % 100;
  return `${AR_DIGITS.format(n)} ${mod >= 3 && mod <= 10 ? "أيام" : "يوم"}`;
}
const daysEn = (n: number) => (n === 1 ? "1 day" : `${EN_DIGITS.format(n)} days`);
const daysFr = (n: number) => (n <= 1 ? `${n} jour` : `${FR_DIGITS.format(n)} jours`);

const en = {
  // account → profile: company details
  companyTitle: "Company details",
  companyHint: "Buying for a company? Add its details and they are printed on your invoices.",
  companyName: "Company name",
  taxId: "Tax ID",
  taxExempt: "Tax exempt",
  taxExemptHint: "The store exempted this account: no tax is added to the orders you place while signed in.",
  taxIdWarning: "If you change the tax ID, the exemption stops until the store checks it again.",
  exemptionPaused: "Saved. Your tax exemption is paused until the store checks the new tax ID.",
  save: "Save",
  saving: "Saving…",
  saved: "Saved.",
  saveFailed: "We couldn't save that. Please try again.",
  // account → my account balance
  onAccountTab: "My account balance",
  owed: "You owe",
  available: "Available",
  noLimit: "No limit",
  overdueTotal: (amount: string) => `Overdue: ${amount}`,
  terms: (n: number) => (n > 0 ? `You pay within ${daysEn(n)} of each order.` : "Each order is due the day it is placed."),
  paymentsNote: "The store records your payments here as they arrive.",
  payLaterOff: "Paying later is closed for your account right now. What you still owe is listed below.",
  ordersTitle: "Orders on account",
  ordersEmpty: "No orders on account yet",
  ordersEmptyHint: "Choose “Pay later on account” at checkout and the order shows up here with its due date.",
  shop: "Start shopping",
  order: "Order",
  dueOn: (date: string) => `Due ${date}`,
  overdue: "Overdue",
  paid: "Paid",
  left: (amount: string) => `Left to pay: ${amount}`,
  ofTotal: (amount: string) => `of ${amount}`,
  // checkout: the payment method
  method: (n: number) => (n > 0 ? `Pay later on account (${daysEn(n)})` : "Pay later on account"),
  methodHint: "Nothing to pay on delivery: the order goes on your account.",
  availableLine: (amount: string) => `Available: ${amount}`,
  refusedSignedOut: "Sign in to pay later on account",
  refusedNotOpen: "Paying later isn't open for this account",
  refusedLimit: (amount: string) => `This order is more than your available credit (available: ${amount})`,
  refusedLimitPlain: "This order is more than your available credit",
  otherPhone: (phone: string) => `Paying later goes on your account's own number (${phone}). Use it as the order's mobile number.`,
  wholeOrder: "With pay later, the whole order goes on your account. To use store credit, points or a gift card, choose another way to pay.",
  // checkout: the summary's tax line
  tax: "Tax",
  exempt: "Exempt",
  // thank-you page
  onAccountBadge: "Pay later on account",
  onAccountPlaced: (date: string | null) =>
    date ? `Nothing to pay on delivery: this order is on your account, due ${date}.` : "Nothing to pay on delivery: this order is on your account.",
  seeBalance: "My account balance",
};

export type BusinessCopy = typeof en;

const ar: BusinessCopy = {
  companyTitle: "بيانات الشركة",
  companyHint: "بتشتري باسم شركة؟ اكتب بياناتها وهتتطبع في فواتيرك.",
  companyName: "اسم الشركة",
  taxId: "الرقم الضريبي",
  taxExempt: "معفى من الضريبة",
  taxExemptHint: "المتجر عفى الحساب ده من الضريبة: مفيش ضريبة بتتضاف على طلباتك وإنت مسجّل دخول.",
  taxIdWarning: "لو غيّرت الرقم الضريبي، الإعفاء هيقف لحد ما المتجر يراجعه تاني.",
  exemptionPaused: "اتحفظ. الإعفاء الضريبي واقف لحد ما المتجر يراجع الرقم الضريبي الجديد.",
  save: "حفظ",
  saving: "بنحفظ…",
  saved: "اتحفظ.",
  saveFailed: "معرفناش نحفظ. جرّب تاني.",
  onAccountTab: "حسابي الآجل",
  owed: "عليك",
  available: "المتاح",
  noLimit: "من غير حد",
  overdueTotal: (amount) => `متأخر: ${amount}`,
  terms: (n) => (n > 0 ? `بتدفع خلال ${daysAr(n)} من كل طلب.` : "كل طلب مستحق في نفس يوم الطلب."),
  paymentsNote: "المتجر بيسجّل دفعاتك هنا أول ما توصله.",
  payLaterOff: "الدفع الآجل مقفول لحسابك دلوقتي. اللي لسه عليك مكتوب تحت.",
  ordersTitle: "طلبات الآجل",
  ordersEmpty: "لسه مفيش طلبات آجل",
  ordersEmptyHint: "اختار «ادفع آجل» في صفحة الدفع، والطلب هيظهر هنا بتاريخ استحقاقه.",
  shop: "ابدأ التسوّق",
  order: "طلب",
  dueOn: (date) => `مستحق ${date}`,
  overdue: "متأخر",
  paid: "مدفوع",
  left: (amount) => `الباقي: ${amount}`,
  ofTotal: (amount) => `من ${amount}`,
  method: (n) => (n > 0 ? `ادفع آجل (خلال ${daysAr(n)})` : "ادفع آجل"),
  methodHint: "مفيش حاجة تدفعها عند الاستلام: الطلب بيتسجّل على حسابك.",
  availableLine: (amount) => `المتاح: ${amount}`,
  refusedSignedOut: "سجّل دخول عشان تدفع آجل",
  refusedNotOpen: "الدفع الآجل مش متاح للحساب ده",
  refusedLimit: (amount) => `الطلب أكبر من الرصيد المتاح (متاح: ${amount})`,
  refusedLimitPlain: "الطلب أكبر من الرصيد المتاح",
  otherPhone: (phone) => `الدفع الآجل بيتسجّل على رقم حسابك (${phone}). اكتبه في رقم موبايل الطلب.`,
  wholeOrder: "مع الدفع الآجل الطلب كله بيتسجّل على حسابك. لو عايز تستخدم رصيدك أو نقطك أو كارت هدية، اختار طريقة دفع تانية.",
  tax: "الضريبة",
  exempt: "معفى",
  onAccountBadge: "دفع آجل",
  onAccountPlaced: (date) => (date ? `مفيش حاجة تدفعها عند الاستلام: الطلب اتسجّل على حسابك، ومستحق ${date}.` : "مفيش حاجة تدفعها عند الاستلام: الطلب اتسجّل على حسابك."),
  seeBalance: "حسابي الآجل",
};

const fr: BusinessCopy = {
  companyTitle: "Informations de l'entreprise",
  companyHint: "Vous achetez pour une entreprise ? Ajoutez ses informations : elles figurent sur vos factures.",
  companyName: "Nom de l'entreprise",
  taxId: "Numéro fiscal",
  taxExempt: "Exonéré de taxe",
  taxExemptHint: "La boutique a exonéré ce compte : aucune taxe n'est ajoutée aux commandes passées en étant connecté.",
  taxIdWarning: "Si vous modifiez le numéro fiscal, l'exonération est suspendue jusqu'à ce que la boutique le vérifie.",
  exemptionPaused: "Enregistré. Votre exonération est suspendue jusqu'à ce que la boutique vérifie le nouveau numéro fiscal.",
  save: "Enregistrer",
  saving: "Enregistrement…",
  saved: "Enregistré.",
  saveFailed: "L'enregistrement a échoué. Réessayez.",
  onAccountTab: "Mon compte client",
  owed: "Vous devez",
  available: "Disponible",
  noLimit: "Sans plafond",
  overdueTotal: (amount) => `En retard : ${amount}`,
  terms: (n) => (n > 0 ? `Vous payez sous ${daysFr(n)} après chaque commande.` : "Chaque commande est due le jour même."),
  paymentsNote: "La boutique enregistre vos paiements ici dès leur réception.",
  payLaterOff: "Le paiement différé est fermé pour votre compte pour le moment. Ce que vous devez encore figure ci-dessous.",
  ordersTitle: "Commandes en compte",
  ordersEmpty: "Aucune commande en compte",
  ordersEmptyHint: "Choisissez « Payer plus tard en compte » au paiement : la commande apparaît ici avec son échéance.",
  shop: "Commencer mes achats",
  order: "Commande",
  dueOn: (date) => `Échéance : ${date}`,
  overdue: "En retard",
  paid: "Payée",
  left: (amount) => `Reste à payer : ${amount}`,
  ofTotal: (amount) => `sur ${amount}`,
  method: (n) => (n > 0 ? `Payer plus tard en compte (${daysFr(n)})` : "Payer plus tard en compte"),
  methodHint: "Rien à payer à la livraison : la commande est portée à votre compte.",
  availableLine: (amount) => `Disponible : ${amount}`,
  refusedSignedOut: "Connectez-vous pour payer plus tard en compte",
  refusedNotOpen: "Le paiement différé n'est pas ouvert pour ce compte",
  refusedLimit: (amount) => `Cette commande dépasse votre crédit disponible (disponible : ${amount})`,
  refusedLimitPlain: "Cette commande dépasse votre crédit disponible",
  otherPhone: (phone) => `Le paiement différé est porté au numéro de votre compte (${phone}). Utilisez-le comme numéro de la commande.`,
  wholeOrder: "Avec le paiement différé, toute la commande est portée à votre compte. Pour utiliser un avoir, des points ou une carte cadeau, choisissez un autre moyen de paiement.",
  tax: "Taxe",
  exempt: "Exonéré",
  onAccountBadge: "Paiement différé en compte",
  onAccountPlaced: (date) => (date ? `Rien à payer à la livraison : cette commande est portée à votre compte, échéance le ${date}.` : "Rien à payer à la livraison : cette commande est portée à votre compte."),
  seeBalance: "Mon compte client",
};

const COPY: Record<Locale, BusinessCopy> = { en, ar, fr };

export function businessCopy(locale: Locale): BusinessCopy {
  return COPY[locale] ?? en;
}

/** How an order paid later on account is named where a page says how an order is paid («دفع آجل»); null for every other method. */
export function onAccountPaidBy(paymentMethod: string | null | undefined, locale: Locale): string | null {
  return paymentMethod === "on_account" ? businessCopy(locale).onAccountBadge : null;
}

/** The copy in the page's language. */
export function useBusinessCopy(): BusinessCopy {
  return businessCopy(useStore().locale);
}
