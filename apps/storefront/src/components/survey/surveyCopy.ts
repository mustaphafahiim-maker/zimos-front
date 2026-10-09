import type { SurveyTexts } from "@store-builder/api-client";
import { formatNumber, pickText, type Locale } from "@/lib/i18n";

/**
 * The shopper's words for the post-purchase survey (frontend-handoff 236),
 * kept beside the component that says them. «ابعت», «شكرًا على رأيك!» and the
 * three refusals are the handoff's own wording.
 */
const COPY = {
  en: {
    title: "Tell us what you think",
    hint: "A quick question that helps us serve you better.",
    send: "Send",
    sending: "Sending…",
    skip: "Not now",
    thanks: "Thanks for your feedback!",
    change: "Change your answers",
    optional: "optional",
    other: "Something else",
    otherLabel: "Your answer",
    otherPlaceholder: "Type it here",
    textPlaceholder: "Write your answer…",
    scoreOf: (n: number) => `${n} out of 10`,
    required: "Required",
    option: "Pick one of the options",
    score: "A score from 0 to 10",
    answerOne: "Answer at least one question.",
    closed: "This survey is no longer open for this order.",
    failed: "We couldn't send your answers. Try again.",
  },
  ar: {
    title: "قولّنا رأيك",
    hint: "سؤال سريع يساعدنا نخدمك أحسن.",
    send: "ابعت",
    sending: "بنبعت…",
    skip: "مش دلوقتي",
    thanks: "شكرًا على رأيك!",
    change: "عدّل إجاباتك",
    optional: "اختياري",
    other: "حاجة تانية",
    otherLabel: "إجابتك",
    otherPlaceholder: "اكتبها هنا",
    textPlaceholder: "اكتب رأيك…",
    scoreOf: (n: number) => `${formatNumber(n, "ar")} من ${formatNumber(10, "ar")}`,
    required: "مطلوب",
    option: "اختار من الاختيارات",
    score: "من 0 لـ 10",
    answerOne: "جاوب على سؤال واحد على الأقل.",
    closed: "وقت الإجابة على استبيان الطلب ده خلص.",
    failed: "معرفناش نبعت إجاباتك. جرّب تاني.",
  },
  fr: {
    title: "Donnez-nous votre avis",
    hint: "Une question rapide qui nous aide à mieux vous servir.",
    send: "Envoyer",
    sending: "Envoi…",
    skip: "Plus tard",
    thanks: "Merci pour votre avis !",
    change: "Modifier vos réponses",
    optional: "facultatif",
    other: "Autre",
    otherLabel: "Votre réponse",
    otherPlaceholder: "Écrivez-la ici",
    textPlaceholder: "Écrivez votre réponse…",
    scoreOf: (n: number) => `${n} sur 10`,
    required: "Obligatoire",
    option: "Choisissez l'une des options",
    score: "Une note de 0 à 10",
    answerOne: "Répondez à au moins une question.",
    closed: "Ce questionnaire n'est plus ouvert pour cette commande.",
    failed: "Impossible d'envoyer vos réponses. Réessayez.",
  },
};

export type SurveyCopy = (typeof COPY)["en"];

export function surveyCopy(locale: Locale): SurveyCopy {
  return pickText(COPY, locale);
}

/**
 * A question's or an option's text in the page's language: the store writes
 * them in Arabic and English, so each stands in for the other when one is
 * empty, and French reads the English one first.
 */
export function surveyText(texts: SurveyTexts | null | undefined, locale: Locale): string {
  const ar = texts?.ar?.trim() ?? "";
  const en = texts?.en?.trim() ?? "";
  return locale === "ar" ? ar || en : en || ar;
}
