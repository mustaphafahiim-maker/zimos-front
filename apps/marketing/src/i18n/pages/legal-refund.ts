import type { Locale } from "../config";
import type { LegalDoc } from "./legal";
import { COMPANY as C } from "@/lib/company";

export const refund: Record<Locale, LegalDoc> = {
  en: {
    kicker: "Legal",
    title: "Refund Policy",
    description: "How refunds work for ZIMOS subscription fees.",
    intro:
      "This policy covers fees paid to ZIMOS for using the platform. It does not cover purchases made by shoppers in a merchant's store — those are handled by each merchant under their own return policy.",
    sections: [
      {
        id: "scope",
        heading: "Scope",
        paragraphs: [
          "ZIMOS is currently in early access and free to start. This policy applies once paid plans are introduced.",
        ],
      },
      {
        id: "eligibility",
        heading: "Eligibility for a refund",
        paragraphs: [`You may request a refund within ${C.refundWindow} of a charge in the following cases:`],
        list: [
          "You were charged in error, or charged twice for the same period.",
          "[Add any other eligible cases, e.g. first subscription payment.]",
        ],
      },
      {
        id: "non-refundable",
        heading: "Non-refundable items",
        paragraphs: [],
        list: [
          "Fees charged by third parties, such as shipping carriers, payment providers or messaging platforms.",
          "[Add other non-refundable items, e.g. partial billing periods after cancellation.]",
        ],
      },
      {
        id: "cancellation",
        heading: "Cancelling a subscription",
        paragraphs: [
          "You can cancel from your account settings. [Describe whether access continues until the end of the paid period.]",
        ],
      },
      {
        id: "how-to-request",
        heading: "How to request a refund",
        paragraphs: [
          `Email ${C.supportEmail} from the address on your account, with your store name and the date and amount of the charge.`,
        ],
      },
      {
        id: "processing",
        heading: "Processing",
        paragraphs: [
          "Approved refunds are returned to the original payment method. [State the processing time and any conditions from the payment provider.]",
        ],
      },
      {
        id: "shopper-returns",
        heading: "Shopper returns in merchant stores",
        paragraphs: [
          "If you bought a product from a store built on ZIMOS, please contact that store directly. The merchant is responsible for its products, returns and refunds.",
        ],
      },
      {
        id: "contact",
        heading: "Contact",
        paragraphs: [`${C.legalName} — ${C.supportEmail}, ${C.phone}.`],
      },
    ],
  },
  ar: {
    kicker: "قانوني",
    title: "سياسة الاسترداد",
    description: "كيف يتم استرداد رسوم اشتراك ZIMOS.",
    intro:
      "تغطي هذه السياسة الرسوم المدفوعة لـ ZIMOS مقابل استخدام المنصة، ولا تشمل مشتريات العملاء من متاجر التجار؛ فتلك يتولاها كل تاجر وفق سياسة الاسترجاع الخاصة به.",
    sections: [
      {
        id: "scope",
        heading: "النطاق",
        paragraphs: [
          "تُتاح ZIMOS حاليًا ضمن مرحلة الوصول المبكر ويمكن البدء مجانًا. وتُطبَّق هذه السياسة عند إطلاق الباقات المدفوعة.",
        ],
      },
      {
        id: "eligibility",
        heading: "حالات استحقاق الاسترداد",
        paragraphs: [`يمكنك طلب الاسترداد خلال ${C.refundWindow} من تاريخ الخصم في الحالات التالية:`],
        list: [
          "إذا تم الخصم منك بالخطأ، أو تم الخصم مرتين عن الفترة نفسها.",
          "[تُضاف أي حالات أخرى مستحقة، مثل أول دفعة اشتراك.]",
        ],
      },
      {
        id: "non-refundable",
        heading: "ما لا يُسترد",
        paragraphs: [],
        list: [
          "الرسوم التي تفرضها أطراف ثالثة، مثل شركات الشحن ومزوّدي الدفع ومنصات الرسائل.",
          "[تُضاف بنود أخرى غير قابلة للاسترداد، مثل الفترات الجزئية بعد الإلغاء.]",
        ],
      },
      {
        id: "cancellation",
        heading: "إلغاء الاشتراك",
        paragraphs: [
          "يمكنك الإلغاء من إعدادات حسابك. [يُوضَّح ما إذا كان الوصول يستمر حتى نهاية الفترة المدفوعة.]",
        ],
      },
      {
        id: "how-to-request",
        heading: "كيفية طلب الاسترداد",
        paragraphs: [
          `راسل ${C.supportEmail} من البريد المسجل في حسابك، مع ذكر اسم المتجر وتاريخ الخصم وقيمته.`,
        ],
      },
      {
        id: "processing",
        heading: "معالجة الطلب",
        paragraphs: [
          "تُعاد المبالغ المعتمدة إلى وسيلة الدفع الأصلية. [تُذكر مدة المعالجة وأي شروط من مزوّد الدفع.]",
        ],
      },
      {
        id: "shopper-returns",
        heading: "مرتجعات عملاء المتاجر",
        paragraphs: [
          "إذا اشتريت منتجًا من متجر مبني على ZIMOS، فتواصل مع المتجر مباشرة؛ فالتاجر هو المسؤول عن منتجاته ومرتجعاتها واستردادها.",
        ],
      },
      {
        id: "contact",
        heading: "التواصل",
        paragraphs: [`${C.legalName} — ${C.supportEmail}، ${C.phone}.`],
      },
    ],
  },
};
