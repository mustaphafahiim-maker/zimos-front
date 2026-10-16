import type { LegalPolicyKey, PaymentMethodList, StoreManualPaymentMethod } from "@store-builder/api-client";

/**
 * Starting points for the three legal policies, in Arabic and English, built
 * from blocks that follow the store's payment options: cash on delivery is
 * always in, the online-gateway and InstaPay / wallet blocks only when the
 * store takes them. They are a draft for the merchant to read and adapt, not
 * legal advice.
 *
 * {{store.*}} variables are filled in by the server when a policy is shown.
 * Words in [square brackets] are for the merchant to fill; the Policies tab
 * lists the ones still in the text and asks before saving with any left.
 *
 * There is no stored shipping policy (settings.legal holds three keys), so
 * the shipping block is a section of the terms of service.
 */

export type PolicyLang = "ar" | "en";

/** The store's payment options besides cash on delivery, which is always on. */
export interface PolicyPayments {
  /** A live online-gateway method is switched on for the store. */
  online: boolean;
  /** At least one active InstaPay / wallet method. */
  manual: boolean;
}

export interface PolicyContext {
  payments: PolicyPayments;
  /** Store information has a phone / an email, so {{store.phone}} / {{store.email}} have something to show. */
  hasPhone: boolean;
  hasEmail: boolean;
}

/** A line every template keeps, or one that depends on a payment option (with an optional line for when it is off). */
type Line = string | { when: keyof PolicyPayments; text: string; otherwise?: string };

const CONTACT = "{contact}";

const TEMPLATES: Record<PolicyLang, Record<LegalPolicyKey, Line[]>> = {
  en: {
    terms_of_service: [
      "Terms of service — {{store.name}}",
      "By using this store and placing an order you agree to these terms.",
      "Payment methods",
      "Cash on delivery: you pay the courier in cash when your order is delivered.",
      {
        when: "online",
        text: "Online payment: payments are processed by a licensed payment provider; we do not store your card details.",
      },
      {
        when: "manual",
        text: "InstaPay / mobile wallet: transfer to the number or link shown at checkout, enter the number you paid from and upload a screenshot of the transfer. Your order is not confirmed for shipping until the payment is reviewed and approved. A proof may be rejected with a reason so you can send it again.",
      },
      "Prices are in EGP [including/excluding] VAT.",
      "We may cancel an order if its data or payment appears invalid.",
      "Shipping and delivery",
      "We deliver within [2-5] business days to [regions].",
      "The shipping cost is shown at checkout before you confirm the order.",
      "The courier calls you before delivery.",
      "You can inspect the parcel when it is delivered.",
      { when: "manual", text: "Orders paid by InstaPay or wallet are shipped after the payment is approved." },
      `For any question, contact us on ${CONTACT}.`,
    ],
    refund_policy: [
      "Returns and refunds — {{store.name}}",
      "You can return a product within [14] days of receiving it, as long as it is unused and in its original packaging.",
      "Not returnable: [products that cannot be returned].",
      "Return shipping cost: [who pays it and when].",
      "Refunds",
      "Cash on delivery orders are refunded in cash or by InstaPay/wallet transfer within [7] business days.",
      {
        when: "online",
        text: "Online payments are refunded to the original payment method within [7-14] business days.",
      },
      {
        when: "manual",
        text: "InstaPay/wallet payments are refunded to the number you paid from within [7] business days.",
      },
      `To ask for a return, contact us on ${CONTACT} with your order number.`,
    ],
    privacy_policy: [
      "Privacy policy — {{store.name}}",
      "We collect your name, phone number, address and order details when you place an order.",
      {
        when: "manual",
        text: "For InstaPay/wallet payments we also keep the number you paid from and the screenshot of the transfer.",
      },
      { when: "online", text: "We do not store your card details; online payments are handled by the payment provider." },
      "We use this data to fulfil your order, contact you about it, verify payments and prevent fraud.",
      {
        when: "online",
        text: "We share it only with the shipping companies that deliver your order and with the payment provider. We never sell your data.",
        otherwise: "We share it only with the shipping companies that deliver your order. We never sell your data.",
      },
      `We keep your data for [period]. To delete or correct it, contact us on ${CONTACT}.`,
    ],
  },
  ar: {
    terms_of_service: [
      "شروط الخدمة — {{store.name}}",
      "باستخدامك لهذا المتجر وتسجيل طلب فأنت توافق على هذه الشروط.",
      "طرق الدفع",
      "الدفع عند الاستلام: تدفع المبلغ نقدًا لمندوب الشحن عند تسليم طلبك.",
      {
        when: "online",
        text: "الدفع الإلكتروني: تتم معالجة المدفوعات عبر مزود دفع مرخّص، ولا نحتفظ ببيانات بطاقتك.",
      },
      {
        when: "manual",
        text: "إنستاباي / المحفظة الإلكترونية: حوّل المبلغ إلى الرقم أو الرابط الظاهر عند إتمام الطلب، ثم اكتب الرقم الذي حوّلت منه وارفع صورة من التحويل. لا يُؤكَّد الطلب للشحن قبل مراجعة الدفع وقبوله. قد يُرفض إثبات الدفع مع ذكر السبب حتى تتمكن من إرساله مرة أخرى.",
      },
      "الأسعار بالجنيه المصري [شاملة/غير شاملة] ضريبة القيمة المضافة.",
      "يحق لنا إلغاء الطلب إذا ظهر أن بياناته أو الدفع غير صحيح.",
      "الشحن والتوصيل",
      "نوصّل الطلبات خلال [2-5] أيام عمل داخل [المناطق].",
      "تظهر تكلفة الشحن عند إتمام الطلب قبل تأكيده.",
      "يتصل بك مندوب الشحن قبل التسليم.",
      "يمكنك معاينة الشحنة عند استلامها.",
      { when: "manual", text: "الطلبات المدفوعة بإنستاباي أو المحفظة تُشحن بعد قبول الدفع." },
      `لأي استفسار تواصل معنا على ${CONTACT}.`,
    ],
    refund_policy: [
      "سياسة الاسترجاع ورد المبلغ — {{store.name}}",
      "يمكنك إرجاع المنتج خلال [14] يومًا من استلامه، بشرط أن يكون غير مستخدم وفي عبوته الأصلية.",
      "منتجات لا يمكن إرجاعها: [اكتب المنتجات].",
      "تكلفة شحن الإرجاع: [من يتحملها ومتى].",
      "رد المبلغ",
      "طلبات الدفع عند الاستلام يُرد مبلغها نقدًا أو بتحويل إنستاباي/محفظة خلال [7] أيام عمل.",
      { when: "online", text: "المدفوعات الإلكترونية تُرد إلى وسيلة الدفع الأصلية خلال [7-14] يوم عمل." },
      { when: "manual", text: "مدفوعات إنستاباي/المحفظة تُرد إلى الرقم الذي دفعت منه خلال [7] أيام عمل." },
      `لطلب الإرجاع تواصل معنا على ${CONTACT} مع رقم الطلب.`,
    ],
    privacy_policy: [
      "سياسة الخصوصية — {{store.name}}",
      "نجمع اسمك ورقم هاتفك وعنوانك وتفاصيل طلبك عند تسجيل الطلب.",
      { when: "manual", text: "عند الدفع بإنستاباي أو المحفظة نحتفظ أيضًا بالرقم الذي دفعت منه وصورة التحويل." },
      { when: "online", text: "لا نحتفظ ببيانات بطاقتك؛ المدفوعات الإلكترونية يتولاها مزود الدفع." },
      "نستخدم هذه البيانات لتنفيذ طلبك والتواصل معك بشأنه والتحقق من الدفع ومنع الاحتيال.",
      {
        when: "online",
        text: "لا نشاركها إلا مع شركات الشحن التي توصّل طلبك ومع مزود الدفع، ولا نبيع بياناتك أبدًا.",
        otherwise: "لا نشاركها إلا مع شركات الشحن التي توصّل طلبك، ولا نبيع بياناتك أبدًا.",
      },
      `نحتفظ ببياناتك لمدة [المدة]. لحذفها أو تصحيحها تواصل معنا على ${CONTACT}.`,
    ],
  },
};

const CONTACT_TEXT: Record<PolicyLang, { placeholder: string; or: string }> = {
  en: { placeholder: "[phone/WhatsApp/email]", or: " or " },
  ar: { placeholder: "[الهاتف/واتساب/البريد الإلكتروني]", or: " أو " },
};

/** The contact the templates name: the store's own phone / email variables when set, else a placeholder. */
function contactOf(lang: PolicyLang, ctx: PolicyContext): string {
  const known = [ctx.hasPhone && "{{store.phone}}", ctx.hasEmail && "{{store.email}}"].filter(Boolean);
  return known.length ? known.join(CONTACT_TEXT[lang].or) : CONTACT_TEXT[lang].placeholder;
}

/** One policy's template for the store's payment options, one paragraph per line. */
export function buildPolicyTemplate(key: LegalPolicyKey, lang: PolicyLang, ctx: PolicyContext): string {
  const contact = contactOf(lang, ctx);
  return TEMPLATES[lang][key]
    .map((line) => (typeof line === "string" ? line : ctx.payments[line.when] ? line.text : line.otherwise))
    .filter((line): line is string => line !== undefined)
    .map((line) => line.replace(CONTACT, contact))
    .join("\n");
}

/** The [square bracket] placeholders still in a text, each once, in order. */
export function findPlaceholders(text: string): string[] {
  return [...new Set(text.match(/\[[^[\]\n]{1,80}\]/g) ?? [])];
}

/**
 * The store's payment options from GET /payments/methods and the manual
 * methods list. A list that could not be read (the caller may lack the
 * payments role) counts as off, so a template never names an option the
 * store may not take; `known` says whether both were read.
 */
export function paymentsFrom(
  methods: PaymentMethodList | null,
  manual: StoreManualPaymentMethod[] | null
): PolicyPayments & { known: boolean } {
  return {
    online:
      !!methods?.onlineEnabled &&
      methods.methods.some((m) => m.method !== "cod" && m.enabled && m.available && m.mode !== "test"),
    manual: !!manual?.some((m) => m.active),
    known: methods !== null && manual !== null,
  };
}
