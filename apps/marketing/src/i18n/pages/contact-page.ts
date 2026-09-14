import type { Locale } from "../config";

export type ContactTopic = "sales" | "support" | "onboarding" | "partnership" | "other";

export interface ContactPageCopy {
  metaTitle: string;
  metaDescription: string;
  kicker: string;
  heading: string;
  intro: string;
  form: {
    heading: string;
    name: string;
    email: string;
    phone: string;
    storeUrl: string;
    optional: string;
    topic: string;
    topicPlaceholder: string;
    topics: Record<ContactTopic, string>;
    message: string;
    submit: string;
    requiredHint: string;
    mailtoNote: string;
    opened: string;
    notConfigured: string;
    subjectPrefix: string;
  };
  errors: {
    summary: string;
    name: string;
    email: string;
    phone: string;
    storeUrl: string;
    topic: string;
    message: string;
  };
  aside: {
    heading: string;
    emailLabel: string;
    whatsappLabel: string;
    whatsappCta: string;
    helpLabel: string;
    helpCta: string;
  };
}

export const contactPage: Record<Locale, ContactPageCopy> = {
  en: {
    metaTitle: "Contact",
    metaDescription: "Contact the ZIMOS team about sales, support, onboarding or partnerships.",
    kicker: "Contact",
    heading: "Talk to the ZIMOS team",
    intro: "Questions about plans, getting started or moving your store? Send us a message.",
    form: {
      heading: "Send a message",
      name: "Full name",
      email: "Email",
      phone: "Phone",
      storeUrl: "Store URL",
      optional: "optional",
      topic: "Topic",
      topicPlaceholder: "Choose a topic",
      topics: {
        sales: "Plans & sales",
        support: "Support with my store",
        onboarding: "Onboarding & migration",
        partnership: "Partnerships",
        other: "Something else",
      },
      message: "Message",
      submit: "Open email to send",
      requiredHint: "Fields without “optional” are required.",
      mailtoNote:
        "This form doesn't send anything by itself: it opens your email app with your message filled in, so you can review it and press send.",
      opened: "Your email app should now be open with the message ready. If nothing happened, email us directly at the address on this page.",
      notConfigured: "The support email address has not been set up yet.",
      subjectPrefix: "ZIMOS contact",
    },
    errors: {
      summary: "Please fix the highlighted fields.",
      name: "Enter your name.",
      email: "Enter a valid email address.",
      phone: "Enter a valid phone number, or leave it empty.",
      storeUrl: "Enter a valid web address, or leave it empty.",
      topic: "Choose a topic.",
      message: "Write a message of at least 10 characters.",
    },
    aside: {
      heading: "Other ways to reach us",
      emailLabel: "Email",
      whatsappLabel: "WhatsApp",
      whatsappCta: "Chat on WhatsApp",
      helpLabel: "Looking for how-to guides?",
      helpCta: "Visit the help center",
    },
  },
  ar: {
    metaTitle: "تواصل معنا",
    metaDescription: "تواصل مع فريق ZIMOS بخصوص المبيعات أو الدعم أو الإعداد أو الشراكات.",
    kicker: "تواصل معنا",
    heading: "تحدّث مع فريق ZIMOS",
    intro: "لديك أسئلة عن الباقات أو البدء أو نقل متجرك؟ أرسل لنا رسالة.",
    form: {
      heading: "أرسل رسالة",
      name: "الاسم الكامل",
      email: "البريد الإلكتروني",
      phone: "رقم الهاتف",
      storeUrl: "رابط المتجر",
      optional: "اختياري",
      topic: "الموضوع",
      topicPlaceholder: "اختر موضوعًا",
      topics: {
        sales: "الباقات والمبيعات",
        support: "دعم لمتجري",
        onboarding: "الإعداد ونقل المتجر",
        partnership: "الشراكات",
        other: "موضوع آخر",
      },
      message: "الرسالة",
      submit: "افتح البريد للإرسال",
      requiredHint: "الحقول غير المعلَّمة بـ«اختياري» مطلوبة.",
      mailtoNote:
        "هذا النموذج لا يرسل شيئًا بنفسه: سيفتح تطبيق البريد لديك وبه رسالتك جاهزة، لتراجعها ثم تضغط إرسال.",
      opened: "من المفترض أن يكون تطبيق البريد قد فُتح والرسالة جاهزة. إن لم يحدث ذلك، راسلنا مباشرة على العنوان الموجود في هذه الصفحة.",
      notConfigured: "لم يتم إعداد عنوان بريد الدعم بعد.",
      subjectPrefix: "تواصل مع ZIMOS",
    },
    errors: {
      summary: "يرجى تصحيح الحقول المحددة.",
      name: "أدخل اسمك.",
      email: "أدخل بريدًا إلكترونيًا صحيحًا.",
      phone: "أدخل رقم هاتف صحيحًا أو اتركه فارغًا.",
      storeUrl: "أدخل رابطًا صحيحًا أو اتركه فارغًا.",
      topic: "اختر موضوعًا.",
      message: "اكتب رسالة لا تقل عن 10 أحرف.",
    },
    aside: {
      heading: "طرق أخرى للتواصل",
      emailLabel: "البريد الإلكتروني",
      whatsappLabel: "واتساب",
      whatsappCta: "راسلنا على واتساب",
      helpLabel: "تبحث عن أدلة الاستخدام؟",
      helpCta: "زيارة مركز المساعدة",
    },
  },
};
