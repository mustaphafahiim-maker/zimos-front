import type { PageTree } from "@store-builder/api-client";
import { THEME_SPECS, type StoreThemeKey } from "../editor/storeThemes";
import { artUrl, drawArt, drawMark, type ArtSpec, type ArtSubject, type ArtTheme } from "./templateArt";
import { band, buildPage, col, custom, el, fromPreset, row, type SectionDraft } from "./templateTree";

/**
 * The store templates written in this repository, as data.
 *
 * A template is the ORDER of a store's sections and the words and pictures
 * they start with. How the store looks is a theme's business: each template
 * only names the theme it wears (`theme`), one of the storefront's own, and
 * asks for the fuller footer. It carries no header menu — a menu names
 * collections, and a new store has none of these.
 *
 * What a template's version holds is what the server stores for one
 * (`template_versions`: globalStyles, pages, sections): `buildStoreTemplates`
 * gives exactly that, and storeTemplates.test.ts keeps the files under
 * `generated/` equal to it. The words are the shop's own voice in Egyptian
 * Arabic; wherever a line would promise something on the merchant's behalf
 * (delivery times, a warranty, a review) it says what to write instead.
 *
 * Every picture slot names a shape (`ratio`) or lives in a band with a box of
 * its own, so the picture a merchant drops in, whatever its size, fills the
 * same box (the storefront's page-renderer/pictureFrame.ts).
 */

export interface TemplatePage {
  path: string;
  title: string;
  pageType: "home" | "static";
  builderData: PageTree;
  seo: Record<string, never>;
}

export interface StoreTemplate {
  /** The template's handle here and the name of its generated file. */
  key: string;
  name: string;
  category: string;
  kind: "store";
  tags: string[];
  rtl: true;
  /** The theme's own accent: the swatch on the gallery card. */
  primaryColor: string;
  version: {
    globalStyles: { primaryColor: string; themeSettings: { storeTheme: StoreThemeKey; footer: { layout: "rich" } } };
    pages: TemplatePage[];
    sections: [];
  };
}

interface TemplateDraft {
  key: string;
  name: string;
  category: string;
  theme: StoreThemeKey & ArtTheme;
  pages: Array<{ key: string; path: string; title: string; sections: SectionDraft[] }>;
  art: ArtSpec[];
  /** How many maker's marks the template's brand strip shows. */
  marks?: number;
}

/**
 * A slide's two drawings. On a computer the words stand at the start of the
 * slide (the right of an Arabic page), so the subject stands on the left; a
 * phone's slide is a tall box with the words at the bottom, so its own drawing
 * has the subject high up.
 */
const WIDE = { width: 2100, height: 900, scale: 0.5, shift: -0.27 } as const;
const PHONE = { width: 800, height: 1000, scale: 0.34, lift: 0.22 } as const;
const LANDSCAPE = { width: 1200, height: 900 } as const;
const SQUARE = { width: 800, height: 800 } as const;

const art = (name: string, theme: ArtTheme, subject: ArtSubject, size: { width: number; height: number; scale?: number; lift?: number; shift?: number; deep?: boolean }, ground: 0 | 1 | 2 | 3 = 0): ArtSpec => ({
  name,
  theme,
  subject,
  ground,
  ...size,
});

/** A slide: its two drawings (`<name>` and `<name>-phone`), its words at the start of the slide, low down. */
const slide = (name: string, alt: string, heading: string, subheading: string, buttonLabel: string) => ({
  image: artUrl(name),
  mobileImage: artUrl(`${name}-phone`),
  alt,
  heading,
  subheading,
  buttonLabel,
  buttonHref: "/products",
  side: "start",
  vertical: "bottom",
  contentWidth: 480,
});

/**
 * What a reviews section starts with: a card that says what belongs in it, and
 * nothing a shopper could take for a review — no name, no stars.
 */
const REVIEW = { quote: "اكتب هنا رأي عميل حقيقي اشترى منك.", author: "", rating: 0 };

const reviews = (heading: string): SectionDraft =>
  fromPreset("testimonial-wall", [{ text: heading, level: 2 }, { text: "اكتب هنا سطر عن مصدر الآراء دي." }, REVIEW, REVIEW, REVIEW]);

const newsletter = (heading: string, line: string): SectionDraft =>
  fromPreset("newsletter", [{ text: heading, level: 2 }, { text: line }, { title: "", submitLabel: "اشترك", tags: "newsletter" }]);

const story = (key: string, path: string, title: string, prompt: string) => ({
  key,
  path,
  title,
  sections: [fromPreset("rich-text-band", [{ text: title, level: 2 }, { text: prompt }])],
});

const shipping = (key: string, path: string, title: string) => ({
  key,
  path,
  title,
  sections: [fromPreset("shipping-returns", [{ text: title, level: 2 }])],
});

// --- Home and decor ---------------------------------------------------------

const HOME: TemplateDraft = {
  key: "home-living",
  name: "مفروشات وديكور البيت",
  category: "home_decor",
  theme: "classic",
  art: [
    art("home-hero", "classic", "cushion", LANDSCAPE, 0),
    art("home-row-1", "classic", "blanket", LANDSCAPE, 1),
    art("home-row-2", "classic", "lamp", LANDSCAPE, 2),
    art("home-row-3", "classic", "plant", LANDSCAPE, 3),
  ],
  pages: [
    {
      key: "home",
      path: "/",
      title: "الرئيسية",
      sections: [
        fromPreset("hero-split", [
          { text: "راحة بيتك تبدأ من هنا", level: 1 },
          { text: "مفروشات ومخدات وإكسسوارات مختارة بعناية، تدّي كل ركن في بيتك دفا وشكل جديد." },
          { label: "تسوّق دلوقتي", href: "/products", variant: "primary" },
          { src: artUrl("home-hero"), alt: "مخدات على كنبة", ratio: "4:3" },
        ]),
        fromPreset("multirow", [
          { src: artUrl("home-row-1"), alt: "بطاطين مطوية", ratio: "4:3" },
          { text: "مفارش وبطاطين تدفّيك", level: 3 },
          { text: "اكتب هنا سطرين عن أهم منتج عندك: الخامة، المقاس، وليه العميل هيحبه." },
          { text: "إضاءة تدفّي المكان", level: 3 },
          { text: "اكتب هنا سطرين عن منتج تاني مميز عندك وإيه اللي بيفرقه." },
          { src: artUrl("home-row-2"), alt: "أباجورة", ratio: "4:3" },
        ]),
        fromPreset("image-text", [
          { src: artUrl("home-row-3"), alt: "نبات زينة في أصيص", ratio: "4:3" },
          { text: "لمسة خضرا في كل ركن", level: 2 },
          { text: "اكتب هنا فقرة قصيرة عن مجموعة عايز العميل يشوفها." },
          { label: "شوف المجموعة", href: "/products", variant: "outline" },
        ]),
        band("product_shelf", {
          heading: "الأكتر طلبًا",
          subheading: "القطع اللي عملاءنا بيرجعوا يطلبوها تاني.",
          limit: 8,
          buttonLabel: "كل المنتجات",
          buttonHref: "/products",
        }),
        reviews("عملاءنا بيقولوا إيه"),
        fromPreset("feature-grid-4", [
          { name: "shield", size: 28 },
          { text: "الدفع عند الاستلام", level: 4 },
          { text: "اكتب هنا طرق الدفع المتاحة." },
          { name: "truck", size: 28 },
          { text: "توصيل لحد البيت", level: 4 },
          { text: "اكتب هنا مناطق التوصيل ومدته." },
          { name: "check", size: 28 },
          { text: "استبدال سهل", level: 4 },
          { text: "اكتب هنا سياسة الاستبدال." },
          { name: "gift", size: 28 },
          { text: "تغليف هدايا", level: 4 },
          { text: "اكتب هنا لو بتقدّم تغليف للهدايا." },
        ]),
        newsletter("خليك أول واحد يعرف الجديد", "سيب بياناتك ونبعتلك العروض والمنتجات الجديدة."),
      ],
    },
    story("about", "/about", "حكايتنا", "اكتب هنا حكاية متجرك: بدأ إزاي، وإيه اللي بيميّز منتجاتك."),
    shipping("shipping", "/shipping", "الشحن والاستبدال"),
  ],
};

// --- Drinks -----------------------------------------------------------------

const DRINK_TILES: Array<[string, ArtSubject, string]> = [
  ["قهوة", "cup", "drinks-cat-1"],
  ["شاي", "leaf", "drinks-cat-2"],
  ["عصاير طبيعية", "glass", "drinks-cat-3"],
  ["مشروبات باردة", "bottle", "drinks-cat-4"],
  ["أعشاب", "sprig", "drinks-cat-5"],
  ["مستلزمات التحضير", "press", "drinks-cat-6"],
];

const DRINKS: TemplateDraft = {
  key: "drinks",
  name: "مشروبات وقهوة",
  category: "food_beverage",
  theme: "warm",
  art: [
    art("drinks-hero", "warm", "cup", WIDE, 2),
    art("drinks-hero-phone", "warm", "cup", PHONE, 2),
    art("drinks-story", "warm", "press", LANDSCAPE, 1),
    ...DRINK_TILES.map(([, subject, name], i) => art(name, "warm", subject, SQUARE, (i % 4) as 0 | 1 | 2 | 3)),
  ],
  pages: [
    {
      key: "home",
      path: "/",
      title: "الرئيسية",
      sections: [
        band("hero_slider", {
          slides: [slide("drinks-hero", "فنجان قهوة", "مشروبك المفضّل لحد باب البيت", "قهوة، شاي وعصاير طبيعية، متحضّرة بحب.", "اطلب دلوقتي")],
          arrows: false,
          dots: false,
          height: 560,
          heightTablet: 480,
        }),
        band("trust_strip", {
          items: [
            { icon: "truck", title: "توصيل سريع", text: "اكتب هنا مناطق التوصيل ومدته." },
            { icon: "cash", title: "الدفع عند الاستلام", text: "اكتب هنا طرق الدفع المتاحة." },
            { icon: "support", title: "معاك على طول", text: "اكتب هنا إزاي العميل يوصلك." },
          ],
        }),
        fromPreset("image-text", [
          { src: artUrl("drinks-story"), alt: "أدوات تحضير القهوة", ratio: "4:3" },
          { text: "حكايتنا", level: 2 },
          { text: "اكتب هنا حكايتك مع المشروبات: بدأت إزاي، وبتختار مكوناتك منين." },
          { label: "اعرف أكتر", href: "/about", variant: "outline" },
        ]),
        band("category_tiles", {
          heading: "اختار مشروبك",
          items: DRINK_TILES.map(([title, , name]) => ({ image: artUrl(name), title, href: "/products" })),
          columns: 6,
          columnsMobile: 3,
        }),
        band("product_cards", {
          heading: "الأكتر طلبًا",
          subheading: "المشروبات اللي عملاءنا بيطلبوها كل يوم.",
          limit: 8,
          columns: 4,
          buttonLabel: "كل المنتجات",
          buttonHref: "/products",
        }),
        reviews("عملاءنا بيقولوا إيه"),
      ],
    },
    story("about", "/about", "حكايتنا", "اكتب هنا حكايتك مع المشروبات: بدأت إزاي، وإيه اللي بيميّز اللي بتقدّمه."),
    shipping("delivery", "/delivery", "التوصيل والاستبدال"),
  ],
};

// --- A store with several departments -----------------------------------------

const DEPARTMENTS_LIST: Array<{ title: string; subject: ArtSubject; line: string; alt: string }> = [
  { title: "رجالي", subject: "shirt", line: "اكتب هنا سطر عن أحدث ما وصل في قسم الرجالي.", alt: "تيشيرت رجالي" },
  { title: "حريمي", subject: "dress", line: "اكتب هنا سطر عن أحدث ما وصل في قسم الحريمي.", alt: "فستان" },
  { title: "إكسسوارات", subject: "shades", line: "اكتب هنا سطر عن الإكسسوارات اللي بتكمّل الطلّة.", alt: "نضارة شمس" },
];

const DEPARTMENTS: TemplateDraft = {
  key: "departments",
  name: "متجر متعدد الأقسام",
  category: "ecommerce",
  theme: "bold",
  marks: 6,
  art: [
    ...DEPARTMENTS_LIST.flatMap((d, i) => [
      art(`departments-slide-${i + 1}`, "bold", d.subject, WIDE, ([2, 0, 1] as const)[i]),
      art(`departments-slide-${i + 1}-phone`, "bold", d.subject, PHONE, ([2, 0, 1] as const)[i]),
    ]),
    art("departments-cat-1", "bold", "shirt", SQUARE, 1),
    art("departments-cat-2", "bold", "dress", SQUARE, 3),
    art("departments-cat-3", "bold", "bag", SQUARE, 0),
  ],
  pages: [
    {
      key: "home",
      path: "/",
      title: "الرئيسية",
      sections: [
        band("hero_slider", {
          slides: DEPARTMENTS_LIST.map((d, i) => slide(`departments-slide-${i + 1}`, d.alt, `جديد ${d.title}`, d.line, "تسوّق دلوقتي")),
          height: 560,
          heightTablet: 480,
        }),
        band("category_tiles", {
          heading: "تسوّق بالقسم",
          items: DEPARTMENTS_LIST.map((d, i) => ({ image: artUrl(`departments-cat-${i + 1}`), title: d.title, href: "/products" })),
          columns: 3,
          columnsMobile: 3,
        }),
        fromPreset(
          "product-grid-intro",
          [{ text: "الأكتر مبيعًا", level: 2 }, { text: "القطع اللي الكل بيسأل عليها." }, { title: "", source: "best_selling", limit: 4, columns: 4 }],
          { key: "best-sellers" }
        ),
        fromPreset(
          "product-grid-intro",
          [{ text: "وصل حديثًا", level: 2 }, { text: "أحدث المنتجات اللي نزلت المتجر." }, { title: "", source: "newest", limit: 4, columns: 4 }],
          { key: "new-arrivals" }
        ),
        fromPreset("store-brand-strip", [
          { text: "ماركاتنا", level: 2 },
          { title: "", columns: 6, layout: "grid", fit: "whole", images: [1, 2, 3, 4, 5, 6].map((n) => artUrl(`brand-mark-${n}`)) },
        ]),
        fromPreset("cta-band", [
          { text: "أهلاً بيك في متجرنا", level: 2 },
          { text: "اكتب هنا سطر عن عرض أو ميزة تخلّي العميل يبدأ يتسوّق." },
          { label: "تسوّق دلوقتي", href: "/products", variant: "primary" },
        ]),
        newsletter("اشترك في النشرة", "اكتب هنا اللي المشترك هيستفيده: عروض، منتجات جديدة، أو خصم على أول طلب."),
      ],
    },
    story("about", "/about", "من إحنا", "اكتب هنا مين إنتوا: بدأتوا إزاي، وبتبيعوا إيه، وليه العميل يختاركم."),
    shipping("shipping", "/shipping", "الشحن والاستبدال"),
  ],
};

// --- One product ---------------------------------------------------------------

const point = (icon: string, title: string, line: string) => [
  el("icon", { name: icon, size: 28 }),
  el("heading", { text: title, level: 4 }),
  el("text", { text: line }),
];

const card = (icon: string, title: string, line: string) =>
  col(4, [el("icon", { name: icon, size: 32 }), el("heading", { text: title, level: 3 }), el("text", { text: line })], { surface: "card" });

const SINGLE: TemplateDraft = {
  key: "single-product",
  name: "منتج واحد — صفحة هبوط",
  category: "watches",
  theme: "glass",
  art: [
    art("single-hero", "glass", "watch", { width: 1200, height: 1200 }, 0),
    art("single-story", "glass", "strap", LANDSCAPE, 1),
    art("single-center", "glass", "pulse", { width: 900, height: 1200 }, 2),
    art("single-detail", "glass", "dial", LANDSCAPE, 3),
  ],
  pages: [
    {
      key: "home",
      path: "/",
      title: "الرئيسية",
      sections: [
        fromPreset("hero-split", [
          { text: "ساعة تعيش معاك يومك كله", level: 1 },
          { text: "اكتب هنا في سطرين إيه اللي بيميّز منتجك وليه العميل محتاجه." },
          { label: "اطلبها دلوقتي", href: "/products", variant: "primary" },
          { src: artUrl("single-hero"), alt: "الساعة", ratio: "1:1" },
        ]),
        fromPreset("text-image", [
          { text: "اتصمّمت عشان تريّحك", level: 2 },
          { text: "اكتب هنا فقرة قصيرة عن فكرة المنتج وإزاي بيسهّل يوم العميل." },
          { label: "اعرف أكتر", href: "/products", variant: "outline" },
          { src: artUrl("single-story"), alt: "سوار الساعة", ratio: "4:3" },
        ]),
        custom(
          "highlights",
          [
            row([col(12, [el("heading", { text: "كل اللي محتاجه في منتج واحد", level: 2 }), el("text", { text: "اكتب هنا سطر يلخّص أهم مميزات المنتج." })], { align: "center" })]),
            row([
              col(4, [...point("check", "اكتب الميزة الأولى", "اشرحها في سطر."), ...point("heart", "اكتب الميزة التانية", "اشرحها في سطر.")], { verticalAlign: "center" }),
              col(4, [el("image", { src: artUrl("single-center"), alt: "شاشة الساعة", ratio: "3:4" })], { verticalAlign: "center" }),
              col(4, [...point("star", "اكتب الميزة التالتة", "اشرحها في سطر."), ...point("shield", "اكتب الميزة الرابعة", "اشرحها في سطر.")], { verticalAlign: "center" }),
            ]),
          ],
          { background: "paper", padding: "roomy" }
        ),
        fromPreset("image-text", [
          { src: artUrl("single-detail"), alt: "مينا الساعة", ratio: "4:3" },
          { text: "تفاصيل بتفرق", level: 2 },
          { text: "اكتب هنا فقرة عن الخامة والصناعة والتفاصيل اللي العميل مش هيشوفها في الصورة." },
          { label: "شوف التفاصيل", href: "/products", variant: "outline" },
        ]),
        custom("reasons", [
          row([col(12, [el("heading", { text: "ليه تختارها؟", level: 2 }), el("text", { text: "ست أسباب تخلّيك مطمّن وإنت بتطلب." })], { align: "center" })]),
          row([
            card("shield", "ضمان", "اكتب هنا مدة الضمان وشروطه."),
            card("truck", "شحن", "اكتب هنا مناطق الشحن ومدته."),
            card("check", "استبدال", "اكتب هنا سياسة الاستبدال والاسترجاع."),
          ]),
          row([
            card("star", "جودة", "اكتب هنا إيه اللي بيضمن جودة المنتج."),
            card("heart", "خدمة عملاء", "اكتب هنا إزاي العميل يوصلك."),
            card("gift", "هدية", "اكتب هنا لو فيه هدية أو تغليف مع الطلب."),
          ]),
        ]),
        band("product_cards", {
          heading: "اختار اللي يناسبك",
          subheading: "الألوان والموديلات المتاحة.",
          limit: 4,
          columns: 4,
          buttonLabel: "كل المنتجات",
          buttonHref: "/products",
        }),
        reviews("اللي جرّبوها بيقولوا إيه"),
        fromPreset("faq-split", [
          { text: "أسئلة بتتكرر", level: 2 },
          { text: "كل اللي محتاج تعرفه قبل ما تطلب." },
          {
            title: "",
            items: [
              { q: "الضمان مدته قد إيه؟", a: "اكتب هنا مدة الضمان وشروطه." },
              { q: "الشحن بياخد وقت قد إيه؟", a: "اكتب هنا مدة الشحن ومناطقه." },
              { q: "ينفع أرجّع المنتج؟", a: "اكتب هنا سياسة الاستبدال والاسترجاع." },
              { q: "الدفع بيتم إزاي؟", a: "اكتب هنا طرق الدفع المتاحة." },
            ],
          },
        ]),
        newsletter("خليك على تواصل", "سيب بياناتك ونبلّغك بأي عرض أو موديل جديد."),
      ],
    },
    story("warranty", "/warranty", "الضمان", "اكتب هنا تفاصيل الضمان: مدته، بيغطّي إيه، وإزاي العميل يستخدمه."),
    shipping("shipping", "/shipping", "الشحن والاستبدال"),
  ],
};

// --- Fashion --------------------------------------------------------------------

/**
 * A tab of the product grid: its name and the collection it shows (none is the
 * newest products). The collections are the merchant's to name: a tab whose
 * collection the store does not have is simply not shown to shoppers, and
 * shows in the editor with a note until it is given one.
 */
const tab = (label: string, collection = "") => ({ label, collection });

const FASHION_SLIDES: Array<{ subject: ArtSubject; alt: string; heading: string; line: string }> = [
  { subject: "dress", alt: "فستان", heading: "كولكشن الموسم الجديد", line: "اكتب هنا سطر عن أهم ما في الكولكشن الجديد." },
  { subject: "shirt", alt: "تيشيرت", heading: "أساسيات كل يوم", line: "اكتب هنا سطر عن القطع الأساسية اللي عندك." },
  { subject: "bag", alt: "شنطة", heading: "إكسسوارات تكمّل الطلّة", line: "اكتب هنا سطر عن الشنط والإكسسوارات." },
];

const FASHION_TILES: Array<[string, ArtSubject]> = [
  ["حريمي", "dress"],
  ["رجالي", "shirt"],
  ["إكسسوارات", "shades"],
];

const FASHION: TemplateDraft = {
  key: "fashion",
  name: "أزياء — واجهة الموسم",
  category: "fashion",
  theme: "minimal",
  art: [
    ...FASHION_SLIDES.flatMap((s, i) => [
      art(`fashion-slide-${i + 1}`, "minimal", s.subject, WIDE, ([0, 2, 1] as const)[i]),
      art(`fashion-slide-${i + 1}-phone`, "minimal", s.subject, PHONE, ([0, 2, 1] as const)[i]),
    ]),
    ...FASHION_TILES.map(([, subject], i) => art(`fashion-cat-${i + 1}`, "minimal", subject, SQUARE, ([1, 3, 0] as const)[i])),
  ],
  pages: [
    {
      key: "home",
      path: "/",
      title: "الرئيسية",
      sections: [
        band("hero_slider", {
          slides: FASHION_SLIDES.map((s, i) => ({ ...slide(`fashion-slide-${i + 1}`, s.alt, s.heading, s.line, "تسوّق دلوقتي"), eyebrow: "موسم جديد" })),
          height: 560,
          heightTablet: 480,
        }),
        band("category_tiles", {
          heading: "تسوّق بالقسم",
          items: FASHION_TILES.map(([title], i) => ({ image: artUrl(`fashion-cat-${i + 1}`), title, href: "/products" })),
          columns: 3,
          columnsMobile: 3,
        }),
        band("product_cards", {
          heading: "كل المنتجات",
          subheading: "اختار القسم وشوف اللي فيه.",
          tabs: [tab("الكل"), tab("حريمي", "women"), tab("رجالي", "men"), tab("شنط", "bags"), tab("أحذية", "shoes")],
          limit: 8,
          columns: 4,
          buttonLabel: "كل المنتجات",
          buttonHref: "/products",
        }),
        newsletter("خليك أول واحد يعرف الجديد", "سيب بياناتك ونبعتلك الكولكشن الجديد والعروض."),
      ],
    },
    story("about", "/about", "من إحنا", "اكتب هنا مين إنتوا: بدأتوا إزاي، وإيه اللي بيميّز تصميماتكم وخاماتكم."),
    shipping("shipping", "/shipping", "الشحن والاستبدال"),
  ],
};

// --- Season offers ----------------------------------------------------------------

const OFFER_SLIDES: Array<{ subject: ArtSubject; alt: string; heading: string }> = [
  { subject: "coat", alt: "معطف شتوي", heading: "كولكشن الشتا" },
  { subject: "dress", alt: "فستان", heading: "خصومات آخر الموسم" },
];

const OFFER_TILES: Array<[string, ArtSubject]> = [
  ["حريمي", "dress"],
  ["شتوي", "coat"],
  ["رجالي", "shirt"],
];

const OFFERS: TemplateDraft = {
  key: "season-offers",
  name: "عروض الموسم",
  category: "ecommerce",
  theme: "elegant",
  art: [
    ...OFFER_SLIDES.flatMap((s, i) => [
      art(`offers-slide-${i + 1}`, "elegant", s.subject, WIDE, ([1, 2] as const)[i]),
      art(`offers-slide-${i + 1}-phone`, "elegant", s.subject, PHONE, ([1, 2] as const)[i]),
    ]),
    ...OFFER_TILES.map(([, subject], i) => art(`offers-cat-${i + 1}`, "elegant", subject, SQUARE, ([0, 3, 1] as const)[i])),
    art("offers-banner", "elegant", "tag", { ...WIDE, deep: true }, 0),
    art("offers-banner-phone", "elegant", "tag", { ...PHONE, deep: true }, 0),
    art("offers-pick-1", "elegant", "coat", { width: 900, height: 1200 }, 2),
    art("offers-pick-2", "elegant", "bag", { width: 1200, height: 800 }, 1),
    art("offers-pick-3", "elegant", "shades", { width: 1200, height: 800 }, 3),
    art("offers-news", "elegant", "tag", LANDSCAPE, 2),
    art("offers-strip-1", "elegant", "bag", SQUARE, 2),
    art("offers-strip-2", "elegant", "shades", SQUARE, 1),
  ],
  pages: [
    {
      key: "home",
      path: "/",
      title: "الرئيسية",
      sections: [
        band("hero_slider", {
          slides: OFFER_SLIDES.map((s, i) => ({
            ...slide(`offers-slide-${i + 1}`, s.alt, s.heading, "اكتب هنا نسبة الخصم ومدة العرض.", "تسوّق العروض"),
            eyebrow: "عروض الموسم",
          })),
          height: 560,
          heightTablet: 480,
        }),
        band("category_tiles", {
          heading: "تسوّق بالقسم",
          items: OFFER_TILES.map(([title], i) => ({ image: artUrl(`offers-cat-${i + 1}`), title, href: "/products" })),
          columns: 3,
          columnsMobile: 3,
        }),
        band("product_cards", {
          heading: "أحدث المنتجات",
          subheading: "الجديد والمميز واللي عليه عرض.",
          tabs: [tab("الكل"), tab("جديد", "new"), tab("مميز", "featured"), tab("عروض", "offers")],
          limit: 6,
          columns: 3,
          buttonLabel: "كل المنتجات",
          buttonHref: "/products",
        }),
        band("image_banner", {
          image: artUrl("offers-banner"),
          mobileImage: artUrl("offers-banner-phone"),
          alt: "بطاقة خصم",
          heading: "عرض الأسبوع",
          text: "اكتب هنا تفاصيل العرض ومدته.",
          buttonLabel: "تسوّق دلوقتي",
          buttonHref: "/products",
          wave: false,
        }),
        custom("best-picks", [
          row([
            col(
              12,
              [
                el("heading", { text: "أفضل تشكيلة الشهر", level: 2 }),
                el("text", { text: "اكتب هنا سطر عن القطع اللي اخترتها الشهر ده وليه." }),
                el("button", { label: "شوف التشكيلة", href: "/products", variant: "outline" }),
              ],
              { align: "center" }
            ),
          ]),
          row([
            col(6, [el("image", { src: artUrl("offers-pick-1"), alt: "معطف من التشكيلة", href: "/products", ratio: "3:4" })]),
            col(6, [
              el("image", { src: artUrl("offers-pick-2"), alt: "شنطة من التشكيلة", href: "/products", ratio: "3:2" }),
              el("image", { src: artUrl("offers-pick-3"), alt: "نضارة من التشكيلة", href: "/products", ratio: "3:2" }),
            ]),
          ]),
        ]),
        fromPreset("newsletter-banner", [
          { src: artUrl("offers-news"), alt: "بطاقة خصم", ratio: "4:3" },
          { text: "اعرف العروض أول بأول", level: 2 },
          { text: "سيب بياناتك ونبلّغك بكل عرض جديد قبل ما يخلص." },
          { title: "", submitLabel: "اشترك", tags: "newsletter" },
        ]),
        band("trust_strip", {
          items: [
            { icon: "truck", title: "شحن لحد البيت", text: "اكتب هنا مناطق الشحن ومدته." },
            { icon: "cash", title: "الدفع عند الاستلام", text: "اكتب هنا طرق الدفع المتاحة." },
            { icon: "return", title: "استبدال سهل", text: "اكتب هنا سياسة الاستبدال." },
          ],
        }),
        fromPreset("gallery", [
          {
            title: "",
            columns: 5,
            images: [artUrl("offers-cat-1"), artUrl("offers-strip-1"), artUrl("offers-cat-2"), artUrl("offers-strip-2"), artUrl("offers-cat-3")],
          },
        ]),
      ],
    },
    story("about", "/about", "من إحنا", "اكتب هنا مين إنتوا: بدأتوا إزاي، وبتبيعوا إيه، وليه العميل يختاركم."),
    shipping("shipping", "/shipping", "الشحن والاستبدال"),
  ],
};

const DRAFTS: TemplateDraft[] = [HOME, DRINKS, DEPARTMENTS, SINGLE, FASHION, OFFERS];

function build(draft: TemplateDraft): StoreTemplate {
  const primaryColor = THEME_SPECS[draft.theme].palette.light.accent;
  return {
    key: draft.key,
    name: draft.name,
    category: draft.category,
    kind: "store",
    tags: [],
    rtl: true,
    primaryColor,
    version: {
      globalStyles: { primaryColor, themeSettings: { storeTheme: draft.theme, footer: { layout: "rich" } } },
      pages: draft.pages.map((page) => ({
        path: page.path,
        title: page.title,
        pageType: page.path === "/" ? "home" : "static",
        builderData: buildPage(page.key, page.sections),
        seo: {},
      })),
      sections: [],
    },
  };
}

/** Every template, in the order the gallery will list them when they are added. */
export function buildStoreTemplates(): StoreTemplate[] {
  return DRAFTS.map(build);
}

/** Every stand-in picture the templates name: its file name and what is in the file. */
export function buildTemplateArt(): Array<{ file: string; svg: string }> {
  const files = DRAFTS.flatMap((draft) => draft.art.map((spec) => ({ file: `${spec.name}.svg`, svg: drawArt(spec) })));
  const marks = Math.max(0, ...DRAFTS.map((draft) => draft.marks ?? 0));
  for (let n = 1; n <= marks; n += 1) files.push({ file: `brand-mark-${n}.svg`, svg: drawMark(n) });
  return files;
}
