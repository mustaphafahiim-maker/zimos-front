import type { Locale } from "../config";
import type { LegalDoc } from "./legal";
import { COMPANY as C } from "@/lib/company";

export const cookies: Record<Locale, LegalDoc> = {
  en: {
    kicker: "Legal",
    title: "Cookie Policy",
    description: "Which cookies and similar technologies ZIMOS uses, and how to control them.",
    intro:
      "This policy explains how the ZIMOS website and dashboard use cookies and similar browser storage.",
    sections: [
      {
        id: "what",
        heading: "What cookies are",
        paragraphs: [
          "Cookies are small files a website stores in your browser. Similar technologies, such as local storage, work in a comparable way.",
        ],
      },
      {
        id: "types",
        heading: "What we use",
        paragraphs: [],
        list: [
          "Strictly necessary: keeping you signed in to the dashboard and protecting your session.",
          "Preferences: remembering choices such as light or dark theme and language.",
          "[Analytics: list any analytics tools, if used.]",
          "[Advertising: list any ad pixels, if used.]",
        ],
      },
      {
        id: "storefronts",
        heading: "Merchant storefronts",
        paragraphs: [
          "Stores built on ZIMOS may use their own tracking, such as ad pixels a merchant adds. Each merchant is responsible for informing their shoppers.",
        ],
      },
      {
        id: "control",
        heading: "Managing cookies",
        paragraphs: [
          "You can block or delete cookies in your browser settings. Blocking strictly necessary cookies may prevent you from signing in.",
        ],
      },
      {
        id: "changes",
        heading: "Changes",
        paragraphs: ["We will update this page when the technologies we use change."],
      },
      {
        id: "contact",
        heading: "Contact",
        paragraphs: [`${C.privacyEmail}`],
      },
    ],
  },
  ar: {
    kicker: "قانوني",
    title: "سياسة ملفات تعريف الارتباط",
    description: "ملفات تعريف الارتباط والتقنيات المشابهة التي تستخدمها ZIMOS وكيفية التحكم فيها.",
    intro: "توضح هذه السياسة كيف يستخدم موقع ZIMOS ولوحة التحكم ملفات تعريف الارتباط ووسائل التخزين المشابهة في المتصفح.",
    sections: [
      {
        id: "what",
        heading: "ما هي ملفات تعريف الارتباط",
        paragraphs: [
          "ملفات تعريف الارتباط (الكوكيز) ملفات صغيرة يحفظها الموقع في متصفحك. وتعمل التقنيات المشابهة، مثل التخزين المحلي، بطريقة قريبة منها.",
        ],
      },
      {
        id: "types",
        heading: "ما الذي نستخدمه",
        paragraphs: [],
        list: [
          "ضرورية: للإبقاء على تسجيل دخولك إلى لوحة التحكم وحماية جلستك.",
          "التفضيلات: لتذكّر اختياراتك مثل الوضع الفاتح أو الداكن واللغة.",
          "[التحليلات: تُذكر أدوات التحليل إن وُجدت.]",
          "[الإعلانات: تُذكر أكواد التتبع الإعلانية إن وُجدت.]",
        ],
      },
      {
        id: "storefronts",
        heading: "متاجر التجار",
        paragraphs: [
          "قد تستخدم المتاجر المبنية على ZIMOS أدوات تتبع خاصة بها، مثل أكواد الإعلانات التي يضيفها التاجر، ويتحمل كل تاجر مسؤولية إبلاغ عملائه بذلك.",
        ],
      },
      {
        id: "control",
        heading: "التحكم في ملفات تعريف الارتباط",
        paragraphs: [
          "يمكنك حظر ملفات تعريف الارتباط أو حذفها من إعدادات المتصفح. وقد يمنعك حظر الملفات الضرورية من تسجيل الدخول.",
        ],
      },
      {
        id: "changes",
        heading: "التعديلات",
        paragraphs: ["سنحدّث هذه الصفحة عند تغيّر التقنيات التي نستخدمها."],
      },
      {
        id: "contact",
        heading: "التواصل",
        paragraphs: [`${C.privacyEmail}`],
      },
    ],
  },
};
