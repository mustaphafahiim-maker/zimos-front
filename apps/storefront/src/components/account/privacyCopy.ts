import type { Locale } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";

/**
 * The shopper's words for the account's «الخصوصية» page (handoff 235): a copy
 * of their data and deleting their account. Kept beside the component that
 * says them, like tenders/tenderCopy.ts. Arabic is Egyptian, as the rest of
 * the store.
 */

const en = {
  tab: "Privacy",
  downloadTitle: "Download my data",
  downloadHint: "A file with everything this store holds about you: your details, addresses, orders, points, store credit and wishlist.",
  downloading: "Preparing your file…",
  downloaded: "Your file was downloaded.",
  deleteTitle: "Delete my account",
  deleteHint: "Ask the store to delete your account. The store reviews the request before anything is removed.",
  deleteWarning: "We'll remove your personal details; your invoices stay, without your name",
  reasonLabel: "Why are you leaving?",
  confirmDelete: "Yes, delete my account",
  sending: "Sending…",
  sent: "Your request was sent. The store will review it.",
  underReview: "Your request to delete your account is under review.",
  requestsTitle: "Your requests",
  requestDelete: "Delete my account",
  statusPending: "Under review",
  statusCompleted: "Done",
  statusDeclined: "Declined",
  storeNote: (note: string) => `The store's note: ${note}`,
  askedOn: (date: string) => `Asked on ${date}`,
  failed: "Something went wrong. Try again.",
};

export type PrivacyCopy = typeof en;

const ar: PrivacyCopy = {
  tab: "الخصوصية",
  downloadTitle: "نزّل بياناتي",
  downloadHint: "ملف فيه كل اللي المتجر محتفظ بيه عنك: بياناتك وعناوينك وطلباتك ونقطك ورصيدك والمفضلة.",
  downloading: "بنجهّز الملف…",
  downloaded: "الملف اتنزّل.",
  deleteTitle: "امسح حسابي",
  deleteHint: "اطلب من المتجر يمسح حسابك. المتجر بيراجع الطلب قبل ما أي حاجة تتمسح.",
  deleteWarning: "هنمسح بياناتك الشخصية؛ فواتيرك هتفضل محفوظة من غير اسمك",
  reasonLabel: "ليه عايز تمسح حسابك؟",
  confirmDelete: "أيوه، امسح حسابي",
  sending: "بنبعت الطلب…",
  sent: "طلبك اتبعت. المتجر هيراجعه.",
  underReview: "طلب مسح حسابك تحت المراجعة.",
  requestsTitle: "طلباتك",
  requestDelete: "مسح الحساب",
  statusPending: "تحت المراجعة",
  statusCompleted: "اتمسح",
  statusDeclined: "اترفض",
  storeNote: (note) => `رد المتجر: ${note}`,
  askedOn: (date) => `اتطلب يوم ${date}`,
  failed: "حصلت مشكلة. جرّب تاني.",
};

const fr: PrivacyCopy = {
  tab: "Confidentialité",
  downloadTitle: "Télécharger mes données",
  downloadHint: "Un fichier avec tout ce que la boutique conserve à votre sujet : vos coordonnées, adresses, commandes, points, avoir et favoris.",
  downloading: "Préparation du fichier…",
  downloaded: "Votre fichier a été téléchargé.",
  deleteTitle: "Supprimer mon compte",
  deleteHint: "Demandez à la boutique de supprimer votre compte. Elle examine la demande avant toute suppression.",
  deleteWarning: "Nous supprimerons vos données personnelles ; vos factures sont conservées, sans votre nom",
  reasonLabel: "Pourquoi partez-vous ?",
  confirmDelete: "Oui, supprimer mon compte",
  sending: "Envoi…",
  sent: "Votre demande a été envoyée. La boutique va l'examiner.",
  underReview: "Votre demande de suppression de compte est en cours d'examen.",
  requestsTitle: "Vos demandes",
  requestDelete: "Suppression du compte",
  statusPending: "En cours d'examen",
  statusCompleted: "Terminée",
  statusDeclined: "Refusée",
  storeNote: (note) => `Message de la boutique : ${note}`,
  askedOn: (date) => `Demandée le ${date}`,
  failed: "Une erreur s'est produite. Réessayez.",
};

const COPY: Record<Locale, PrivacyCopy> = { en, ar, fr };

export function privacyCopy(locale: Locale): PrivacyCopy {
  return COPY[locale] ?? en;
}

/** The copy in the page's language. */
export function usePrivacyCopy(): PrivacyCopy {
  return privacyCopy(useStore().locale);
}
