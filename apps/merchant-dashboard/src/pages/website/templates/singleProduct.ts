import { artUrl } from "./templateArt";
import { band, col, custom, el, fromPreset, row, type SectionDraft } from "./templateTree";

/**
 * The one-product page, written once and used twice: as the home page of the
 * "one product" store template (storeTemplates.ts), and as the sales page of
 * the funnel starter of the same name (pages/funnels/funnelAdapter.ts).
 *
 * The two share every section that sells the product — the opening, the idea,
 * the highlights around a picture, the details, the reasons, the reviews, the
 * questions — and differ only where a store and a funnel differ:
 *
 *   store    its buttons lead to the catalogue; it shows the store's products,
 *            and ends with the newsletter
 *   funnel   its buttons have no link (the funnel decides where a press
 *            leads); it takes the order on the page itself with the
 *            cash-on-delivery form, and ends with one last call
 *
 * Neither carries a countdown: a timer that starts by itself the day a page
 * is published hurries the shopper for an offer the merchant never made.
 *
 * The words are in the two languages a funnel can be made in; the store
 * template is Arabic. As everywhere in the templates, a line that would
 * promise something on the merchant's behalf says what to write instead.
 */

export type SingleProductUse = "store" | "funnel";
export type SingleProductLang = "ar" | "en";

interface Copy {
  heroTitle: string;
  heroText: string;
  orderNow: string;
  heroAlt: string;
  storyTitle: string;
  storyText: string;
  learnMore: string;
  storyAlt: string;
  highlightsTitle: string;
  highlightsText: string;
  points: [string, string, string, string];
  pointLine: string;
  centerAlt: string;
  detailAlt: string;
  detailTitle: string;
  detailText: string;
  seeDetails: string;
  reasonsTitle: string;
  reasonsText: string;
  /** Icon, title, line. */
  reasons: Array<[string, string, string]>;
  productsTitle: string;
  productsText: string;
  allProducts: string;
  reviewsTitle: string;
  reviewsSource: string;
  review: string;
  faqTitle: string;
  faqText: string;
  faq: Array<{ q: string; a: string }>;
  newsTitle: string;
  newsText: string;
  subscribe: string;
  orderTitle: string;
  orderText: string;
  closeTitle: string;
  closeText: string;
}

const COPY: Record<SingleProductLang, Copy> = {
  ar: {
    heroTitle: "ساعة تعيش معاك يومك كله",
    heroText: "اكتب هنا في سطرين إيه اللي بيميّز منتجك وليه العميل محتاجه.",
    orderNow: "اطلبها دلوقتي",
    heroAlt: "الساعة",
    storyTitle: "اتصمّمت عشان تريّحك",
    storyText: "اكتب هنا فقرة قصيرة عن فكرة المنتج وإزاي بيسهّل يوم العميل.",
    learnMore: "اعرف أكتر",
    storyAlt: "سوار الساعة",
    highlightsTitle: "كل اللي محتاجه في منتج واحد",
    highlightsText: "اكتب هنا سطر يلخّص أهم مميزات المنتج.",
    points: ["اكتب الميزة الأولى", "اكتب الميزة التانية", "اكتب الميزة التالتة", "اكتب الميزة الرابعة"],
    pointLine: "اشرحها في سطر.",
    centerAlt: "شاشة الساعة",
    detailAlt: "مينا الساعة",
    detailTitle: "تفاصيل بتفرق",
    detailText: "اكتب هنا فقرة عن الخامة والصناعة والتفاصيل اللي العميل مش هيشوفها في الصورة.",
    seeDetails: "شوف التفاصيل",
    reasonsTitle: "ليه تختارها؟",
    reasonsText: "ست أسباب تخلّيك مطمّن وإنت بتطلب.",
    reasons: [
      ["shield", "ضمان", "اكتب هنا مدة الضمان وشروطه."],
      ["truck", "شحن", "اكتب هنا مناطق الشحن ومدته."],
      ["check", "استبدال", "اكتب هنا سياسة الاستبدال والاسترجاع."],
      ["star", "جودة", "اكتب هنا إيه اللي بيضمن جودة المنتج."],
      ["heart", "خدمة عملاء", "اكتب هنا إزاي العميل يوصلك."],
      ["gift", "هدية", "اكتب هنا لو فيه هدية أو تغليف مع الطلب."],
    ],
    productsTitle: "اختار اللي يناسبك",
    productsText: "الألوان والموديلات المتاحة.",
    allProducts: "كل المنتجات",
    reviewsTitle: "اللي جرّبوها بيقولوا إيه",
    reviewsSource: "اكتب هنا سطر عن مصدر الآراء دي.",
    review: "اكتب هنا رأي عميل حقيقي اشترى منك.",
    faqTitle: "أسئلة بتتكرر",
    faqText: "كل اللي محتاج تعرفه قبل ما تطلب.",
    faq: [
      { q: "الضمان مدته قد إيه؟", a: "اكتب هنا مدة الضمان وشروطه." },
      { q: "الشحن بياخد وقت قد إيه؟", a: "اكتب هنا مدة الشحن ومناطقه." },
      { q: "ينفع أرجّع المنتج؟", a: "اكتب هنا سياسة الاستبدال والاسترجاع." },
      { q: "الدفع بيتم إزاي؟", a: "اكتب هنا طرق الدفع المتاحة." },
    ],
    newsTitle: "خليك على تواصل",
    newsText: "سيب بياناتك ونبلّغك بأي عرض أو موديل جديد.",
    subscribe: "اشترك",
    orderTitle: "اطلبها دلوقتي",
    orderText: "اكتب هنا سطر يطمّن العميل قبل ما يطلب: الدفع، التوصيل، أو الاستبدال.",
    closeTitle: "جاهز تطلب؟",
    closeText: "اكتب هنا سطر أخير يشجّع العميل يطلب دلوقتي.",
  },
  en: {
    heroTitle: "A watch that keeps up with your whole day",
    heroText: "Write here, in two lines, what sets your product apart and why the customer needs it.",
    orderNow: "Order now",
    heroAlt: "The watch",
    storyTitle: "Made to make your day easier",
    storyText: "Write here a short paragraph about the idea behind the product and how it helps the customer.",
    learnMore: "Learn more",
    storyAlt: "The watch's strap",
    highlightsTitle: "Everything you need in one product",
    highlightsText: "Write here a line that sums up the product's main features.",
    points: ["Write the first feature", "Write the second feature", "Write the third feature", "Write the fourth feature"],
    pointLine: "Explain it in a line.",
    centerAlt: "The watch's screen",
    detailAlt: "The watch's dial",
    detailTitle: "Details that matter",
    detailText: "Write here a paragraph about the material, the making and the details a picture does not show.",
    seeDetails: "See the details",
    reasonsTitle: "Why choose it?",
    reasonsText: "Six reasons to order with an easy mind.",
    reasons: [
      ["shield", "Warranty", "Write here how long the warranty is and its terms."],
      ["truck", "Delivery", "Write here where you deliver and how long it takes."],
      ["check", "Exchange", "Write here your exchange and return policy."],
      ["star", "Quality", "Write here what stands behind the product's quality."],
      ["heart", "Support", "Write here how a customer reaches you."],
      ["gift", "Gift", "Write here whether a gift or gift wrap comes with the order."],
    ],
    productsTitle: "Choose the one for you",
    productsText: "The colours and models available.",
    allProducts: "All products",
    reviewsTitle: "What those who tried it say",
    reviewsSource: "Write here a line about where these reviews come from.",
    review: "Write here a real review from a customer who bought from you.",
    faqTitle: "Questions we hear often",
    faqText: "Everything to know before you order.",
    faq: [
      { q: "How long is the warranty?", a: "Write here how long the warranty is and its terms." },
      { q: "How long does delivery take?", a: "Write here the delivery time and the areas you cover." },
      { q: "Can I return the product?", a: "Write here your exchange and return policy." },
      { q: "How do I pay?", a: "Write here the ways to pay that you accept." },
    ],
    newsTitle: "Stay in touch",
    newsText: "Leave your details and we will tell you about any offer or new model.",
    subscribe: "Subscribe",
    orderTitle: "Order now",
    orderText: "Write here a line that reassures the customer before ordering: payment, delivery or exchange.",
    closeTitle: "Ready to order?",
    closeText: "Write here one last line that encourages the customer to order now.",
  },
};

const point = (icon: string, title: string, line: string) => [
  el("icon", { name: icon, size: 28 }),
  el("heading", { text: title, level: 4 }),
  el("text", { text: line }),
];

const card = ([icon, title, line]: [string, string, string]) =>
  col(4, [el("icon", { name: icon, size: 32 }), el("heading", { text: title, level: 3 }), el("text", { text: line })], { surface: "card" });

/** The page's sections, in order, for a store's home page or a funnel's sales step. */
export function singleProductSections(use: SingleProductUse, lang: SingleProductLang = "ar"): SectionDraft[] {
  const c = COPY[lang];
  const funnel = use === "funnel";
  // A store's button leads to the catalogue; a funnel's has no link, and the funnel decides where a press leads.
  const href = funnel ? "" : "/products";
  // A card that says what belongs in it, and nothing a shopper could take for a review: no name, no stars.
  const review = { quote: c.review, author: "", rating: 0 };

  const opening = fromPreset("hero-split", [
    { text: c.heroTitle, level: 1 },
    { text: c.heroText },
    { label: c.orderNow, href, variant: "primary" },
    { src: artUrl("single-hero"), alt: c.heroAlt, ratio: "1:1" },
  ]);
  const idea = fromPreset("text-image", [
    { text: c.storyTitle, level: 2 },
    { text: c.storyText },
    { label: funnel ? c.orderNow : c.learnMore, href, variant: "outline" },
    { src: artUrl("single-story"), alt: c.storyAlt, ratio: "4:3" },
  ]);
  const highlights = custom(
    "highlights",
    [
      row([col(12, [el("heading", { text: c.highlightsTitle, level: 2 }), el("text", { text: c.highlightsText })], { align: "center" })]),
      row([
        col(4, [...point("check", c.points[0], c.pointLine), ...point("heart", c.points[1], c.pointLine)], { verticalAlign: "center" }),
        col(4, [el("image", { src: artUrl("single-center"), alt: c.centerAlt, ratio: "3:4" })], { verticalAlign: "center" }),
        col(4, [...point("star", c.points[2], c.pointLine), ...point("shield", c.points[3], c.pointLine)], { verticalAlign: "center" }),
      ]),
    ],
    { background: "paper", padding: "roomy" }
  );
  const details = fromPreset("image-text", [
    { src: artUrl("single-detail"), alt: c.detailAlt, ratio: "4:3" },
    { text: c.detailTitle, level: 2 },
    { text: c.detailText },
    { label: funnel ? c.orderNow : c.seeDetails, href, variant: "outline" },
  ]);
  const reasons = custom("reasons", [
    row([col(12, [el("heading", { text: c.reasonsTitle, level: 2 }), el("text", { text: c.reasonsText })], { align: "center" })]),
    row(c.reasons.slice(0, 3).map(card)),
    row(c.reasons.slice(3, 6).map(card)),
  ]);
  const reviews = fromPreset("testimonial-wall", [{ text: c.reviewsTitle, level: 2 }, { text: c.reviewsSource }, review, review, review]);
  const questions = fromPreset("faq-split", [{ text: c.faqTitle, level: 2 }, { text: c.faqText }, { title: "", items: c.faq }]);

  if (!funnel) {
    return [
      opening,
      idea,
      highlights,
      details,
      reasons,
      band("product_cards", { heading: c.productsTitle, subheading: c.productsText, limit: 4, columns: 4, buttonLabel: c.allProducts, buttonHref: "/products" }),
      reviews,
      questions,
      fromPreset("newsletter", [{ text: c.newsTitle, level: 2 }, { text: c.newsText }, { title: "", submitLabel: c.subscribe, tags: "newsletter" }]),
    ];
  }

  return [
    opening,
    idea,
    highlights,
    details,
    reasons,
    // The order is taken here, on the page: the funnel's cash-on-delivery form for its product.
    custom(
      "order",
      [row([col(12, [el("heading", { text: c.orderTitle, level: 2 }), el("text", { text: c.orderText }), el("cod_form", { title: "", productId: "" })], { align: "center" })])],
      { background: "paper", padding: "roomy" }
    ),
    reviews,
    questions,
    fromPreset("cta-band", [{ text: c.closeTitle, level: 2 }, { text: c.closeText }, { label: c.orderNow, href: "", variant: "primary" }]),
  ];
}
