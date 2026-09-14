import type { Locale } from "../config";
import type { LegalDoc } from "./legal";
import { COMPANY as C } from "@/lib/company";

export const terms: Record<Locale, LegalDoc> = {
  en: {
    kicker: "Legal",
    title: "Terms of Service",
    description: "The terms that govern use of the ZIMOS platform and website.",
    intro: `These terms describe the agreement between you and ${C.legalName} ("ZIMOS", "we") when you use the ZIMOS website, dashboard and related services.`,
    sections: [
      {
        id: "acceptance",
        heading: "Acceptance of these terms",
        paragraphs: [
          "By creating an account or using ZIMOS, you agree to these terms. If you use ZIMOS on behalf of a business, you confirm that you are authorized to accept them for that business.",
        ],
      },
      {
        id: "service",
        heading: "The service",
        paragraphs: [
          "ZIMOS provides software for running an online store, including store and funnel building, order confirmation, shipping integrations, analytics and team tools. Features may change as the product develops, and some features may be offered only on certain plans.",
        ],
      },
      {
        id: "account",
        heading: "Your account",
        paragraphs: ["You are responsible for your account and for activity under it."],
        list: [
          "Provide accurate registration information and keep it up to date.",
          "Keep your login details confidential and tell us promptly about unauthorized access.",
          "Make sure teammates you invite follow these terms.",
        ],
      },
      {
        id: "merchant-responsibilities",
        heading: "Your store and your customers",
        paragraphs: [
          "You are the seller to your customers. You are responsible for your products, prices, product descriptions, delivery commitments, returns and compliance with consumer-protection, tax and other laws that apply to your business.",
          "Messages sent to your customers through ZIMOS (for example WhatsApp order confirmations) must comply with the rules of the messaging provider and with applicable law.",
        ],
      },
      {
        id: "acceptable-use",
        heading: "Acceptable use",
        paragraphs: ["You may not use ZIMOS to:"],
        list: [
          "Sell illegal, counterfeit or prohibited products.",
          "Send spam or messages customers did not agree to receive.",
          "Infringe the intellectual property or privacy of others.",
          "Interfere with the security or operation of the service.",
        ],
      },
      {
        id: "third-parties",
        heading: "Third-party services",
        paragraphs: [
          "ZIMOS connects to services run by others, such as shipping carriers, payment providers, messaging and ad platforms. Your use of those services is subject to their own terms, and we are not responsible for their availability or actions.",
        ],
      },
      {
        id: "fees",
        heading: "Plans and fees",
        paragraphs: [
          "ZIMOS is currently offered in early access. Any fees, and the date they take effect, will be communicated before you are charged. [Describe billing cycle, taxes and payment terms once pricing is published.]",
        ],
      },
      {
        id: "data",
        heading: "Your data",
        paragraphs: [
          "Your store data belongs to you. You can export your orders, customers and products from the dashboard. Our handling of personal data is described in the Privacy Policy.",
        ],
      },
      {
        id: "termination",
        heading: "Suspension and termination",
        paragraphs: [
          "You may close your account at any time. We may suspend or close accounts that breach these terms, with notice where reasonably possible. [Describe data retention after closure.]",
        ],
      },
      {
        id: "liability",
        heading: "Disclaimers and limitation of liability",
        paragraphs: [
          "[To be drafted by counsel: service provided \"as is\", limits on liability, and exclusions permitted under the governing law.]",
        ],
      },
      {
        id: "changes",
        heading: "Changes to these terms",
        paragraphs: [
          "We may update these terms. We will notify you of material changes before they take effect, and the \"last updated\" date above will change.",
        ],
      },
      {
        id: "law",
        heading: "Governing law",
        paragraphs: [`These terms are governed by: ${C.jurisdiction}.`],
      },
      {
        id: "contact",
        heading: "Contact",
        paragraphs: [
          `${C.legalName}, ${C.address}. Registration number: ${C.registrationNumber}.`,
          `Email: ${C.legalEmail}. Phone: ${C.phone}.`,
        ],
      },
    ],
  },
  ar: {
    kicker: "قانوني",
    title: "شروط الخدمة",
    description: "الشروط التي تحكم استخدام منصة ZIMOS وموقعها.",
    intro: `توضح هذه الشروط الاتفاق بينك وبين ${C.legalName} ("ZIMOS" أو "نحن") عند استخدامك لموقع ZIMOS ولوحة التحكم والخدمات المرتبطة بهما.`,
    sections: [
      {
        id: "acceptance",
        heading: "قبول الشروط",
        paragraphs: [
          "بإنشاء حساب أو استخدام ZIMOS فإنك توافق على هذه الشروط. وإذا كنت تستخدم ZIMOS نيابةً عن نشاط تجاري، فأنت تؤكد أنك مخوَّل بقبولها باسمه.",
        ],
      },
      {
        id: "service",
        heading: "الخدمة",
        paragraphs: [
          "توفر ZIMOS برمجيات لإدارة متجر إلكتروني، تشمل بناء المتاجر ومسارات البيع، وتأكيد الطلبات، وربط شركات الشحن، والتحليلات، وأدوات الفريق. قد تتغير المزايا مع تطور المنتج، وقد تتوفر بعضها في باقات محددة فقط.",
        ],
      },
      {
        id: "account",
        heading: "حسابك",
        paragraphs: ["أنت مسؤول عن حسابك وعن أي نشاط يتم من خلاله."],
        list: [
          "قدّم بيانات تسجيل صحيحة وحدّثها عند تغيرها.",
          "حافظ على سرية بيانات الدخول، وأبلغنا فورًا بأي دخول غير مصرّح به.",
          "تأكد من التزام أعضاء فريقك الذين تدعوهم بهذه الشروط.",
        ],
      },
      {
        id: "merchant-responsibilities",
        heading: "متجرك وعملاؤك",
        paragraphs: [
          "أنت البائع أمام عملائك، وتتحمل مسؤولية منتجاتك وأسعارها وأوصافها والتزامات التوصيل والاسترجاع، والامتثال لقوانين حماية المستهلك والضرائب وغيرها من القوانين المنطبقة على نشاطك.",
          "يجب أن تلتزم الرسائل المرسلة إلى عملائك عبر ZIMOS (مثل رسائل تأكيد الطلب على واتساب) بقواعد مزوّد خدمة الرسائل وبالقوانين المعمول بها.",
        ],
      },
      {
        id: "acceptable-use",
        heading: "الاستخدام المقبول",
        paragraphs: ["لا يجوز استخدام ZIMOS من أجل:"],
        list: [
          "بيع منتجات غير قانونية أو مقلدة أو محظورة.",
          "إرسال رسائل مزعجة أو رسائل لم يوافق العملاء على استلامها.",
          "انتهاك الملكية الفكرية أو خصوصية الآخرين.",
          "التأثير على أمان الخدمة أو تشغيلها.",
        ],
      },
      {
        id: "third-parties",
        heading: "خدمات الأطراف الثالثة",
        paragraphs: [
          "تتصل ZIMOS بخدمات يديرها آخرون، مثل شركات الشحن ومزوّدي الدفع ومنصات الرسائل والإعلانات. يخضع استخدامك لتلك الخدمات لشروطها الخاصة، ولسنا مسؤولين عن توفرها أو تصرفاتها.",
        ],
      },
      {
        id: "fees",
        heading: "الباقات والرسوم",
        paragraphs: [
          "تُتاح ZIMOS حاليًا ضمن مرحلة الوصول المبكر. سيتم إبلاغك بأي رسوم وبموعد تطبيقها قبل أي خصم. [يُستكمل وصف دورة الفوترة والضرائب وشروط الدفع عند إعلان الأسعار.]",
        ],
      },
      {
        id: "data",
        heading: "بياناتك",
        paragraphs: [
          "بيانات متجرك ملك لك، ويمكنك تصدير الطلبات والعملاء والمنتجات من لوحة التحكم. توضح سياسة الخصوصية طريقة تعاملنا مع البيانات الشخصية.",
        ],
      },
      {
        id: "termination",
        heading: "الإيقاف وإنهاء الحساب",
        paragraphs: [
          "يمكنك إغلاق حسابك في أي وقت. ويجوز لنا إيقاف أو إغلاق الحسابات التي تخالف هذه الشروط، مع الإخطار المسبق متى أمكن ذلك. [يُستكمل وصف مدة الاحتفاظ بالبيانات بعد الإغلاق.]",
        ],
      },
      {
        id: "liability",
        heading: "إخلاء المسؤولية وحدودها",
        paragraphs: [
          "[تُصاغ من المستشار القانوني: تقديم الخدمة \"كما هي\"، وحدود المسؤولية، والاستثناءات المسموح بها وفق القانون الحاكم.]",
        ],
      },
      {
        id: "changes",
        heading: "تعديل الشروط",
        paragraphs: [
          "قد نحدّث هذه الشروط، وسنخطرك بالتغييرات الجوهرية قبل سريانها، مع تحديث تاريخ \"آخر تحديث\" أعلاه.",
        ],
      },
      {
        id: "law",
        heading: "القانون الحاكم",
        paragraphs: [`تخضع هذه الشروط إلى: ${C.jurisdiction}.`],
      },
      {
        id: "contact",
        heading: "التواصل",
        paragraphs: [
          `${C.legalName}، ${C.address}. رقم السجل: ${C.registrationNumber}.`,
          `البريد الإلكتروني: ${C.legalEmail}. الهاتف: ${C.phone}.`,
        ],
      },
    ],
  },
};
