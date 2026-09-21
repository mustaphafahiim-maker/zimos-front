/**
 * Starting page content for a funnel step, by step type.
 *
 * A step's `builderData` is the same page tree the website editor writes
 * (backend funnelGraph.validateStepData -> pages/pageTree.validatePageTree), so
 * these trees are built only from element types on that allowlist, with each
 * element's props laid over the website editor's own defaults (ELEMENT_SPECS)
 * — a section added here edits exactly like one added from the block library.
 *
 * The copy is written AT the merchant ("Write here…" / "اكتب هنا…"), the same
 * rule as the website editor's ready-made sections: no prices, no ratings, no
 * delivery times, no guarantees, no invented reviews. Anything that would be a
 * promise on the store's behalf is left for the merchant to write.
 *
 * Buttons carry no link on purpose: the funnel runtime decides where a step
 * goes next (edges), and the storefront renders a button without a link as
 * plain content rather than a dead anchor.
 */
import type { PageElement, PageElementType, PageSection, PageTree } from "@store-builder/api-client";
import type { Locale } from "@/i18n/LocaleContext";
import { ELEMENT_SPECS } from "../website/editor/blocks";
import type { UiStepType } from "./funnelAdapter";

/** Alternative starting pages for one step type. */
export type StepPageVariant = "bundle";

type ElementSpec = [PageElementType, Record<string, unknown>?];

interface SectionSpec {
  id: string;
  settings?: Record<string, unknown>;
  elements: ElementSpec[];
}

/**
 * Deterministic ids ("fs-<section>…"): unique inside one tree, and never the
 * shape the block library mints (`<preset>-<random>`), so a section the
 * merchant adds later can't collide with one of these.
 */
function buildSection({ id, settings, elements }: SectionSpec): PageSection {
  const base = `fs-${id}`;
  const els: PageElement[] = elements.map(([type, content], i) => ({
    id: `${base}-e${i + 1}`,
    type,
    props: { ...ELEMENT_SPECS[type].defaultProps, ...content },
  }));
  const section: PageSection = {
    id: base,
    type: "section",
    rows: [{ id: `${base}-r`, type: "row", columns: [{ id: `${base}-c`, type: "column", span: 12, elements: els }] }],
  };
  if (settings) section.settings = { ...settings };
  return section;
}

function tree(sections: SectionSpec[]): PageTree {
  return { version: 1, sections: sections.map(buildSection) };
}

// --------------------------------------------------------------- copy --

const COPY = {
  en: {
    heroTitle: "Write your product's name and the one thing it does best",
    heroText: "Two lines: who it's for and the problem it solves.",
    orderNow: "Order now",
    productTitle: "",
    benefitsTitle: "Why you'll like it",
    benefits: ["Write the first benefit", "Write the second benefit", "Write the third benefit"],
    faqTitle: "Questions before you order",
    faq: [
      { q: "Write here how payment works", a: "For example, whether the customer pays in cash when the order arrives." },
      { q: "Write here how and when you deliver", a: "Only write what you can actually keep to." },
      { q: "Write here your exchange or return policy", a: "Write your own policy, in your own words." },
    ],
    storyText: "Tell the product's story here: what it is, what it's made of, and how it's used. Keep it short and honest.",
    bundleTitle: "Write the bundle's name here",
    bundleText: "Explain in one line what's inside the bundle and any conditions on it. The price comes from your offer.",
    bundleProducts: "What's in the bundle",
    optInTitle: "Write here what the visitor gets for leaving their details",
    optInText: "One line on what happens after they sign up.",
    optInForm: "Leave your details",
    optInSubmit: "Send",
    checkoutTitle: "Confirm your order",
    checkoutText: "Write here how payment and confirmation work — for example, cash on delivery and a call to confirm the order.",
    checkoutCart: "Your order",
    checkoutReassure: "Write here who to contact if something in the order is wrong.",
    upsellTitle: "Write the extra offer in one line",
    upsellText: "Explain why it goes with what they just ordered. The price shown comes from the offer you pick for this step.",
    upsellNote: "Write a short line reminding them their first order is already placed, whatever they choose here.",
    downsellTitle: "Write a smaller or simpler alternative here",
    downsellText: "Offer something lighter for customers who said no to the previous offer. The price comes from this step's offer.",
    thanksTitle: "Write a thank-you line here",
    thanksText: "Tell the customer what happens next — for example, when you'll call to confirm and how delivery works.",
    thanksSteps: ["Write the first thing that happens after ordering", "Write the second", "Write how to reach you"],
    backToStore: "Back to the store",
    customTitle: "Write this page's title",
    customText: "Write this page's content.",
  },
  ar: {
    heroTitle: "اكتب هنا اسم المنتج وأهم حاجة بيعملها",
    heroText: "في سطرين: المنتج ده لمين وبيحل مشكلة إيه.",
    orderNow: "اطلب دلوقتي",
    productTitle: "",
    benefitsTitle: "هتحبه ليه",
    benefits: ["اكتب الميزة الأولى", "اكتب الميزة التانية", "اكتب الميزة التالتة"],
    faqTitle: "أسئلة قبل ما تطلب",
    faq: [
      { q: "اكتب هنا طريقة الدفع", a: "مثلاً، العميل بيدفع كاش لما الطلب يوصله ولا لأ." },
      { q: "اكتب هنا التوصيل بيتم إزاي وإمتى", a: "اكتب بس اللي تقدر تلتزم بيه فعلاً." },
      { q: "اكتب هنا سياسة الاستبدال أو الاسترجاع", a: "اكتب سياستك إنت، بكلامك إنت." },
    ],
    storyText: "احكي هنا قصة المنتج: هو إيه، معمول من إيه، وبيتستخدم إزاي. خليها قصيرة وصادقة.",
    bundleTitle: "اكتب هنا اسم الباقة",
    bundleText: "اشرح في سطر إيه اللي جوه الباقة وإيه شروطها. السعر بييجي من العرض بتاعك.",
    bundleProducts: "الباقة فيها إيه",
    optInTitle: "اكتب هنا الزائر هياخد إيه لما يسيب بياناته",
    optInText: "سطر واحد عن اللي هيحصل بعد ما يسجّل.",
    optInForm: "سيب بياناتك",
    optInSubmit: "إرسال",
    checkoutTitle: "أكّد طلبك",
    checkoutText: "اكتب هنا الدفع والتأكيد بيتموا إزاي — مثلاً الدفع عند الاستلام ومكالمة لتأكيد الطلب.",
    checkoutCart: "طلبك",
    checkoutReassure: "اكتب هنا العميل يكلّم مين لو فيه حاجة غلط في الطلب.",
    upsellTitle: "اكتب العرض الإضافي في سطر",
    upsellText: "اشرح ليه بيمشي مع اللي لسه طالبه. السعر اللي بيظهر بييجي من العرض اللي هتختاره للخطوة دي.",
    upsellNote: "اكتب سطر قصير يطمّنه إن طلبه الأولاني اتسجّل خلاص، مهما اختار هنا.",
    downsellTitle: "اكتب هنا بديل أصغر أو أبسط",
    downsellText: "اعرض حاجة أخف للعملاء اللي رفضوا العرض اللي قبله. السعر بييجي من عرض الخطوة دي.",
    thanksTitle: "اكتب هنا جملة شكر",
    thanksText: "قول للعميل إيه اللي هيحصل بعد كده — مثلاً هتكلّمه إمتى تأكّد الطلب والتوصيل بيتم إزاي.",
    thanksSteps: ["اكتب أول حاجة بتحصل بعد الطلب", "اكتب الحاجة التانية", "اكتب العميل يوصلك إزاي"],
    backToStore: "الرجوع للمتجر",
    customTitle: "اكتب عنوان الصفحة دي",
    customText: "اكتب محتوى الصفحة دي.",
  },
} satisfies Record<Locale, unknown>;

type Copy = (typeof COPY)["en"];

// -------------------------------------------------------------- pages --

function hero(c: Copy): SectionSpec {
  return {
    id: "hero",
    settings: { padding: "roomy" },
    elements: [
      ["heading", { text: c.heroTitle, level: 1 }],
      ["text", { text: c.heroText }],
      ["button", { label: c.orderNow, href: "", variant: "primary" }],
    ],
  };
}

function benefits(c: Copy): SectionSpec {
  return {
    id: "benefits",
    settings: { background: "paper" },
    elements: [
      ["heading", { text: c.benefitsTitle, level: 2 }],
      ["list", { title: "", items: c.benefits }],
    ],
  };
}

function faq(c: Copy): SectionSpec {
  return { id: "faq", elements: [["faq", { title: c.faqTitle, items: c.faq }]] };
}

function closingCta(c: Copy): SectionSpec {
  return { id: "cta", settings: { background: "primary-soft" }, elements: [["button", { label: c.orderNow, href: "", variant: "primary" }]] };
}

const PAGES: Record<UiStepType, (c: Copy) => SectionSpec[]> = {
  landing: (c) => [
    hero(c),
    { id: "product", elements: [["product_card", { title: c.productTitle, productId: "", showPrice: true, showBuyButton: false }]] },
    benefits(c),
    faq(c),
    closingCta(c),
  ],
  sales: (c) => [
    hero(c),
    { id: "product", elements: [["product_card", { title: c.productTitle, productId: "", showPrice: true, showBuyButton: false }]] },
    { id: "story", elements: [["rich_text", { text: c.storyText }]] },
    benefits(c),
    faq(c),
    closingCta(c),
  ],
  opt_in: (c) => [
    {
      id: "optin",
      settings: { padding: "roomy" },
      elements: [
        ["heading", { text: c.optInTitle, level: 1 }],
        ["text", { text: c.optInText }],
        ["form", { title: c.optInForm, submitLabel: c.optInSubmit }],
      ],
    },
  ],
  checkout: (c) => [
    {
      id: "checkout",
      elements: [
        ["heading", { text: c.checkoutTitle, level: 1 }],
        ["text", { text: c.checkoutText }],
        ["cart", { title: c.checkoutCart }],
      ],
    },
    { id: "help", settings: { background: "paper", padding: "compact" }, elements: [["text", { text: c.checkoutReassure }]] },
  ],
  upsell: (c) => [
    {
      id: "offer",
      settings: { background: "primary-soft", padding: "roomy" },
      elements: [
        ["heading", { text: c.upsellTitle, level: 1 }],
        ["text", { text: c.upsellText }],
        ["product_card", { title: "", productId: "", showPrice: true, showBuyButton: false }],
      ],
    },
    { id: "note", settings: { padding: "compact" }, elements: [["text", { text: c.upsellNote }]] },
  ],
  downsell: (c) => [
    {
      id: "offer",
      settings: { background: "paper", padding: "roomy" },
      elements: [
        ["heading", { text: c.downsellTitle, level: 1 }],
        ["text", { text: c.downsellText }],
        ["product_card", { title: "", productId: "", showPrice: true, showBuyButton: false }],
      ],
    },
    { id: "note", settings: { padding: "compact" }, elements: [["text", { text: c.upsellNote }]] },
  ],
  thank_you: (c) => [
    {
      id: "thanks",
      settings: { padding: "roomy" },
      elements: [
        ["heading", { text: c.thanksTitle, level: 1 }],
        ["text", { text: c.thanksText }],
        ["list", { title: "", items: c.thanksSteps }],
        ["button", { label: c.backToStore, href: "/", variant: "outline" }],
      ],
    },
  ],
  custom: (c) => [
    {
      id: "content",
      elements: [
        ["heading", { text: c.customTitle, level: 1 }],
        ["text", { text: c.customText }],
      ],
    },
  ],
};

const VARIANTS: Record<StepPageVariant, (c: Copy) => SectionSpec[]> = {
  // Bundle landing: the products that make up the bundle, shown as a grid the
  // merchant points at their own featured products.
  bundle: (c) => [
    {
      id: "hero",
      settings: { padding: "roomy" },
      elements: [
        ["heading", { text: c.bundleTitle, level: 1 }],
        ["text", { text: c.bundleText }],
        ["button", { label: c.orderNow, href: "", variant: "primary" }],
      ],
    },
    {
      id: "bundle",
      settings: { background: "paper" },
      elements: [["product_list", { title: c.bundleProducts, source: "featured", limit: 3, columns: 3 }]],
    },
    benefits(c),
    faq(c),
    closingCta(c),
  ],
};

/** The page a new step of this type starts with. Always has content, so it passes the publish check. */
export function stepPageTree(type: UiStepType, locale: Locale, variant?: StepPageVariant): PageTree {
  const c = COPY[locale];
  return tree(variant ? VARIANTS[variant](c) : PAGES[type](c));
}

/** How many content elements a step's page has — 0 is what the publish check rejects. */
export function pageElementCount(page: PageTree | null | undefined): number {
  let n = 0;
  for (const s of page?.sections ?? []) for (const r of s.rows ?? []) for (const col of r.columns ?? []) n += (col.elements ?? []).length;
  return n;
}
