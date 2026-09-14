import type { Locale } from "../config";
import type { LegalDoc } from "./legal";
import { COMPANY as C } from "@/lib/company";

export const privacy: Record<Locale, LegalDoc> = {
  en: {
    kicker: "Legal",
    title: "Privacy Policy",
    description: "How ZIMOS collects, uses and protects personal data.",
    intro: `This policy explains how ${C.legalName} ("ZIMOS", "we") handles personal data when you visit our website or use the ZIMOS platform.`,
    sections: [
      {
        id: "roles",
        heading: "Who is responsible",
        paragraphs: [
          "For merchant account data, ZIMOS decides how the data is used. For the data of a merchant's own customers (for example names, phone numbers and addresses on orders), the merchant decides how it is used and ZIMOS processes it on the merchant's behalf.",
        ],
      },
      {
        id: "data-we-collect",
        heading: "Data we collect",
        paragraphs: ["Depending on how you use ZIMOS, we may process:"],
        list: [
          "Account data: name, email, phone number, business details.",
          "Store data: products, orders, and the customer details merchants enter or receive.",
          "Usage data: log data, device and browser information, pages visited.",
          "Communications: messages you send to our support team.",
          "[Billing data, once paid plans are introduced.]",
        ],
      },
      {
        id: "how-we-use",
        heading: "How we use data",
        paragraphs: [],
        list: [
          "To provide and operate the service, including order confirmation and shipping integrations you enable.",
          "To keep accounts secure and to detect abuse and fraudulent orders.",
          "To provide support and send service messages.",
          "To improve the product.",
          "[State the legal basis for each purpose as required by the applicable law.]",
        ],
      },
      {
        id: "sharing",
        heading: "Sharing with third parties",
        paragraphs: [
          "We share data with service providers that help us run ZIMOS (such as hosting), and with third-party services a merchant connects, such as shipping carriers, payment providers and messaging platforms, only as needed to perform those functions. We do not sell personal data. [List categories of sub-processors.]",
        ],
      },
      {
        id: "transfers",
        heading: "International transfers",
        paragraphs: ["[Describe where data is stored and the safeguards for cross-border transfers.]"],
      },
      {
        id: "retention",
        heading: "Data retention",
        paragraphs: [
          "We keep data for as long as the account is active and as needed to meet legal obligations. [State retention periods.]",
        ],
      },
      {
        id: "security",
        heading: "Security",
        paragraphs: [
          "We use technical and organizational measures designed to protect data, including access controls and team roles that limit what each user can see. No system is completely secure.",
        ],
      },
      {
        id: "rights",
        heading: "Your rights",
        paragraphs: [
          "Subject to applicable law, you may ask to access, correct, export or delete your personal data, or object to certain processing. Customers of a merchant should contact that merchant first.",
        ],
      },
      {
        id: "cookies",
        heading: "Cookies",
        paragraphs: ["We use cookies and similar technologies as described in our Cookie Policy."],
      },
      {
        id: "changes",
        heading: "Changes to this policy",
        paragraphs: ["We will post updates here and change the \"last updated\" date above."],
      },
      {
        id: "contact",
        heading: "Contact",
        paragraphs: [`Privacy requests: ${C.privacyEmail}. ${C.legalName}, ${C.address}.`],
      },
    ],
  },
  ar: {
    kicker: "قانوني",
    title: "سياسة الخصوصية",
    description: "كيف تجمع ZIMOS البيانات الشخصية وتستخدمها وتحميها.",
    intro: `توضح هذه السياسة كيف تتعامل ${C.legalName} ("ZIMOS" أو "نحن") مع البيانات الشخصية عند زيارة موقعنا أو استخدام منصة ZIMOS.`,
    sections: [
      {
        id: "roles",
        heading: "الجهة المسؤولة",
        paragraphs: [
          "بالنسبة لبيانات حساب التاجر، تحدد ZIMOS طريقة استخدامها. أما بيانات عملاء التاجر (مثل الأسماء وأرقام الهواتف والعناوين في الطلبات)، فالتاجر هو من يحدد طريقة استخدامها، وتعالجها ZIMOS نيابةً عنه.",
        ],
      },
      {
        id: "data-we-collect",
        heading: "البيانات التي نجمعها",
        paragraphs: ["بحسب طريقة استخدامك لـ ZIMOS، قد نعالج:"],
        list: [
          "بيانات الحساب: الاسم والبريد الإلكتروني ورقم الهاتف وبيانات النشاط التجاري.",
          "بيانات المتجر: المنتجات والطلبات وبيانات العملاء التي يدخلها التاجر أو يستلمها.",
          "بيانات الاستخدام: سجلات النظام ومعلومات الجهاز والمتصفح والصفحات التي تمت زيارتها.",
          "المراسلات: الرسائل التي ترسلها إلى فريق الدعم.",
          "[بيانات الفوترة عند إطلاق الباقات المدفوعة.]",
        ],
      },
      {
        id: "how-we-use",
        heading: "كيف نستخدم البيانات",
        paragraphs: [],
        list: [
          "لتقديم الخدمة وتشغيلها، بما في ذلك تأكيد الطلبات وربط شركات الشحن التي تفعّلها.",
          "لحماية الحسابات واكتشاف إساءة الاستخدام والطلبات الوهمية.",
          "لتقديم الدعم وإرسال الرسائل الخاصة بالخدمة.",
          "لتحسين المنتج.",
          "[يُذكر الأساس القانوني لكل غرض وفق القانون المنطبق.]",
        ],
      },
      {
        id: "sharing",
        heading: "المشاركة مع أطراف ثالثة",
        paragraphs: [
          "نشارك البيانات مع مزوّدي الخدمات الذين يساعدوننا في تشغيل ZIMOS (مثل الاستضافة)، ومع الخدمات التي يربطها التاجر مثل شركات الشحن ومزوّدي الدفع ومنصات الرسائل، وذلك بالقدر اللازم لأداء تلك الوظائف فقط. لا نبيع البيانات الشخصية. [تُذكر فئات المعالِجين الفرعيين.]",
        ],
      },
      {
        id: "transfers",
        heading: "نقل البيانات خارج الدولة",
        paragraphs: ["[يُوضَّح مكان تخزين البيانات والضمانات المطبقة عند نقلها عبر الحدود.]"],
      },
      {
        id: "retention",
        heading: "مدة الاحتفاظ بالبيانات",
        paragraphs: [
          "نحتفظ بالبيانات طوال فترة نشاط الحساب وبالقدر اللازم للوفاء بالالتزامات القانونية. [تُذكر مدد الاحتفاظ.]",
        ],
      },
      {
        id: "security",
        heading: "الأمان",
        paragraphs: [
          "نطبق إجراءات تقنية وتنظيمية لحماية البيانات، منها التحكم في الوصول وأدوار الفريق التي تحدد ما يراه كل مستخدم. ولا يوجد نظام آمن بشكل كامل.",
        ],
      },
      {
        id: "rights",
        heading: "حقوقك",
        paragraphs: [
          "وفقًا للقانون المنطبق، يمكنك طلب الاطلاع على بياناتك الشخصية أو تصحيحها أو تصديرها أو حذفها، أو الاعتراض على بعض أوجه معالجتها. وعلى عملاء التاجر التواصل مع التاجر أولًا.",
        ],
      },
      {
        id: "cookies",
        heading: "ملفات تعريف الارتباط",
        paragraphs: ["نستخدم ملفات تعريف الارتباط والتقنيات المشابهة كما هو موضح في سياسة ملفات تعريف الارتباط."],
      },
      {
        id: "changes",
        heading: "تعديل هذه السياسة",
        paragraphs: ["سننشر أي تحديثات هنا ونغيّر تاريخ \"آخر تحديث\" أعلاه."],
      },
      {
        id: "contact",
        heading: "التواصل",
        paragraphs: [`طلبات الخصوصية: ${C.privacyEmail}. ${C.legalName}، ${C.address}.`],
      },
    ],
  },
};
