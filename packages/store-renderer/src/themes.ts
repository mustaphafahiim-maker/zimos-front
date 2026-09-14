/**
 * THEMES — five complete store looks. Each theme = ThemeSettings + page trees
 * (home, product top/bottom, collection intro, about, contact), in Arabic or
 * English. Copy is simple, respectful Egyptian Arabic; placeholders are
 * obviously replaceable and there are no invented numbers, reviews, customer
 * counts or discounts anywhere.
 */
import * as P from "./presets";
import type { RendererLocale } from "./strings";
import { DEFAULT_THEME_SETTINGS, normalizeThemeSettings, type ThemeId, type ThemeSettings } from "./theme";
import { createIdFactory, type Tree, type TreeSection } from "./tree";

export interface ThemePages {
  home: Tree;
  productTop: Tree;
  productBottom: Tree;
  collectionIntro: Tree;
  about: Tree;
  contact: Tree;
}

export type ThemePageKey = keyof ThemePages;

/**
 * Where each theme page lives on the website. Product/collection pages are
 * rendered by the storefront around its own product/collection templates;
 * those paths are reserved (the storefront doesn't serve them directly).
 */
export const THEME_PAGE_PATHS: Record<ThemePageKey, string> = {
  home: "/",
  about: "/about",
  contact: "/contact",
  productTop: "/theme-product-top",
  productBottom: "/theme-product-bottom",
  collectionIntro: "/theme-collection-intro",
};

export const THEME_PAGE_TYPES: Record<ThemePageKey, "home" | "product" | "collection" | "static"> = {
  home: "home",
  about: "static",
  contact: "static",
  productTop: "product",
  productBottom: "product",
  collectionIntro: "collection",
};

export const RESERVED_THEME_PATHS = [THEME_PAGE_PATHS.productTop, THEME_PAGE_PATHS.productBottom, THEME_PAGE_PATHS.collectionIntro];

export const THEME_PAGE_TITLES: Record<ThemePageKey, { ar: string; en: string }> = {
  home: { ar: "الرئيسية", en: "Home" },
  about: { ar: "من نحن", en: "About" },
  contact: { ar: "تواصل معنا", en: "Contact" },
  productTop: { ar: "أعلى صفحة المنتج", en: "Product page — top" },
  productBottom: { ar: "أسفل صفحة المنتج", en: "Product page — bottom" },
  collectionIntro: { ar: "مقدمة صفحة القسم", en: "Collection page intro" },
};

export interface ThemePreset {
  id: ThemeId;
  niche: NicheId;
  name: { ar: string; en: string };
  description: { ar: string; en: string };
  /** Arabic settings/pages (the platform default locale). */
  settings: ThemeSettings;
  pages: ThemePages;
  build: (locale: RendererLocale) => { settings: ThemeSettings; pages: ThemePages };
}

type T = (ar: string, en: string) => string;
const SHOP = "/?search=1#products";

const tree = (sections: TreeSection[]): Tree => ({ version: 1, sections });

// ---------------------------------------------------------------------------
// Shared page pieces
// ---------------------------------------------------------------------------

function trustItems(t: T) {
  return [
    { icon: "cash", title: t("الدفع عند الاستلام", "Cash on delivery"), text: t("مش هتدفع حاجة غير لما الطلب يوصلك", "Pay nothing until your order arrives") },
    { icon: "truck", title: t("توصيل لكل المحافظات", "Delivery nationwide"), text: t("اكتب هنا مدة التوصيل عندك", "Write your delivery time here") },
    { icon: "return", title: t("استبدال واسترجاع", "Exchange & returns"), text: t("اكتب هنا سياسة الاسترجاع بتاعتك", "Write your returns policy here") },
  ];
}

function faqItems(t: T) {
  return [
    { q: t("الدفع بيكون إزاي؟", "How do I pay?"), a: t("الدفع كاش للمندوب لما الطلب يوصلك، مش محتاج فيزا ولا تدفع أونلاين.", "Cash to the courier when your order arrives — no card, nothing online.") },
    { q: t("هعرف إن طلبي اتسجل؟", "How do I know my order went through?"), a: t("هنكلمك على الموبايل نأكد الطلب والعنوان قبل ما نشحن.", "We call you to confirm the order and address before shipping.") },
    { q: t("التوصيل بياخد قد إيه؟", "How long does delivery take?"), a: t("اكتب هنا مدة التوصيل الحقيقية لكل منطقة.", "Write your real delivery times per area here.") },
    { q: t("لو المنتج مش مناسب أعمل إيه؟", "What if it isn't right for me?"), a: t("اكتب هنا سياسة الاستبدال والاسترجاع بوضوح.", "Write your exchange and returns policy clearly here.") },
  ];
}

function orderSteps(t: T) {
  return [
    { title: t("اختار المنتج", "Choose your product"), text: t("حدد اللون أو المقاس والكمية", "Pick colour or size and quantity") },
    { title: t("اكتب بياناتك", "Enter your details"), text: t("الاسم ورقم الموبايل والعنوان بس", "Just your name, phone and address") },
    { title: t("استلم وادفع", "Receive and pay"), text: t("هنكلمك نأكد، وتدفع لما الطلب يوصل", "We confirm by phone, you pay on delivery") },
  ];
}

function contactItems(t: T) {
  return [
    { icon: "phone", title: t("التليفون", "Phone"), text: t("اكتب رقم التليفون هنا", "Write your phone number here") },
    { icon: "whatsapp", title: t("واتساب", "WhatsApp"), text: t("اكتب رقم الواتساب هنا", "Write your WhatsApp number here") },
    { icon: "mail", title: t("الإيميل", "Email"), text: t("اكتب الإيميل هنا", "Write your email here") },
    { icon: "clock", title: t("مواعيد الرد", "Reply hours"), text: t("اكتب مواعيد الرد هنا", "Write your reply hours here") },
  ];
}

function standardPages(prefix: string, t: T, look: { accentTone: P.Tone; heroTone: P.Tone }): Omit<ThemePages, "home"> {
  const id = (page: string) => createIdFactory(`${prefix}-${page}`);
  const pt = id("pt");
  const pb = id("pb");
  const ci = id("ci");
  const ab = id("ab");
  const co = id("co");
  return {
    productTop: tree([P.trustSection(pt, { items: trustItems(t) }, { tone: "surface" })]),
    productBottom: tree([
      P.stepsSection(pb, { title: t("إزاي تطلب؟", "How to order"), items: orderSteps(t) }),
      P.faqSection(pb, { title: t("أسئلة بتتسأل كتير", "Frequently asked questions"), items: faqItems(t) }, { tone: "surface" }),
    ]),
    collectionIntro: tree([
      P.heroCenteredSection(
        ci,
        { title: t("اختار اللي يناسبك", "Find what suits you"), text: t("اكتب هنا جملة تعريفية تظهر فوق كل الأقسام.", "Write an intro line shown above every collection.") },
        { tone: look.accentTone, padding: "sm" }
      ),
    ]),
    about: tree([
      P.heroCenteredSection(ab, { eyebrow: t("من نحن", "About us"), title: t("اكتب هنا قصة متجرك", "Tell your store's story"), text: t("بدأنا إزاي، وبنبيع إيه، وليه بنحب اللي بنعمله.", "How you started, what you sell and why you care.") }, { tone: look.heroTone }),
      P.imageTextSection(ab, {
        title: t("اكتب هنا اللي بيميزنا", "What makes us different"),
        text: t("اكتب هنا عن جودة منتجاتك، وطريقة اختيارها، واهتمامك بالتغليف وخدمة العملاء.", "Write about product quality, how you choose it, packaging and customer care."),
        bullets: [t("اكتب نقطة أولى", "First point"), t("اكتب نقطة تانية", "Second point"), t("اكتب نقطة تالتة", "Third point")],
        imageAlt: t("صورة للمتجر أو الفريق", "Photo of the store or team"),
      }),
      P.trustSection(ab, { items: trustItems(t) }, { tone: "surface" }),
    ]),
    contact: tree([
      P.heroCenteredSection(co, { eyebrow: t("تواصل معنا", "Contact"), title: t("إحنا موجودين علشانك", "We're here to help"), text: t("لو عندك أي سؤال عن منتج أو طلب، كلمنا بالطريقة اللي تريحك.", "Questions about a product or order? Reach us however suits you.") }, { tone: look.heroTone, padding: "md" }),
      P.contactInfoSection(co, { title: t("طرق التواصل", "Ways to reach us"), items: contactItems(t) }),
      P.whatsappSection(co, { title: t("أسرع طريقة: واتساب", "Fastest: WhatsApp"), text: t("حط رقم الواتساب في الزرار علشان يظهر للعملاء.", "Add your WhatsApp number to the button to show it."), buttonLabel: t("كلمنا واتساب", "Chat on WhatsApp") }),
      P.mapSection(co, { title: t("عنواننا", "Our address"), text: t("لو عندك فرع أو مخزن ينفع العميل يزوره، اكتب عنوانه.", "If shoppers can visit a branch or pickup point, add it."), address: t("اكتب العنوان بالتفصيل هنا", "Write the full address here") }),
    ]),
  };
}

function baseSettings(t: T, overrides: Partial<ThemeSettings> & { preset: ThemeId }): ThemeSettings {
  const d = DEFAULT_THEME_SETTINGS;
  return normalizeThemeSettings({
    ...d,
    ...overrides,
    header: { ...d.header, ...overrides.header, announcement: { ...d.header.announcement, ...overrides.header?.announcement } },
    footer: {
      ...d.footer,
      about: t("اكتب هنا نبذة قصيرة عن متجرك تظهر في آخر الصفحة.", "Write a short line about your store for the footer."),
      paymentBadges: t("الدفع عند الاستلام", "Cash on delivery"),
      ...overrides.footer,
    },
  });
}

// ---------------------------------------------------------------------------
// The five themes
// ---------------------------------------------------------------------------

function nile(locale: RendererLocale) {
  const t: T = (ar, en) => (locale === "ar" ? ar : en);
  const id = createIdFactory("nile-home");
  const settings = baseSettings(t, { preset: "nile" });
  const home = tree([
    P.heroSplitSection(id, {
      eyebrow: t("أهلًا بيك في متجرنا", "Welcome to our store"),
      title: t("اكتب هنا عنوان رئيسي يعرّف بمتجرك", "Write a headline that introduces your store"),
      text: t("اكتب هنا جملة بسيطة عن اللي بتبيعه وليه العميل هيرتاح وهو بيشتري منك.", "Write a simple line about what you sell and why shopping with you is easy."),
      primary: { label: t("تسوّق دلوقتي", "Shop now"), href: SHOP },
      secondary: { label: t("تتبّع طلبك", "Track your order"), href: "/track" },
      imageAlt: t("صورة رئيسية للمتجر", "Main store image"),
    }),
    P.trustSection(id, { items: trustItems(t) }),
    P.collectionListSection(id, { title: t("تسوّق حسب القسم", "Shop by collection"), text: t("اختار القسم اللي يهمك", "Pick the category you're after") }, { tone: "surface" }),
    P.productGridSection(id, { eyebrow: t("وصل جديد", "New in"), title: t("منتجاتنا", "Our products"), link: { label: t("شوف كل المنتجات", "View all products"), href: SHOP } }),
    P.imageTextSection(id, {
      eyebrow: t("عن المتجر", "About us"),
      title: t("اكتب هنا عن متجرك", "Write about your store"),
      text: t("اكتب هنا إزاي بتختار منتجاتك، وإيه اللي بيفرّقك عن غيرك.", "Write how you choose your products and what sets you apart."),
      bullets: [t("اكتب ميزة أولى", "First benefit"), t("اكتب ميزة تانية", "Second benefit"), t("اكتب ميزة تالتة", "Third benefit")],
      cta: { label: t("اعرف أكتر", "Learn more"), href: "/about" },
      imageAlt: t("صورة عن المتجر", "Store image"),
    }),
    P.faqSection(id, { title: t("أسئلة بتتسأل كتير", "Frequently asked questions"), items: faqItems(t) }, { tone: "surface" }),
    P.ctaSection(id, { title: t("لقيت اللي بتدور عليه؟", "Found what you're looking for?"), text: t("اطلب دلوقتي وادفع لما طلبك يوصل لحد باب البيت.", "Order now and pay when it reaches your door."), primary: { label: t("اطلب الآن", "Order now"), href: SHOP } }),
  ]);
  return { settings, pages: { home, ...standardPages("nile", t, { accentTone: "soft", heroTone: "soft" }) } };
}

function souq(locale: RendererLocale) {
  const t: T = (ar, en) => (locale === "ar" ? ar : en);
  const id = createIdFactory("souq-home");
  const settings = baseSettings(t, {
    preset: "souq",
    colors: { primary: "#e4572e", secondary: "#ffc233", background: "#ffffff", surface: "#fff5ef", text: "#1b1b1f", muted: "#5d5d66", border: "#f2e3da", buttonText: "auto" },
    typography: { arabicFont: "Tajawal", latinFont: "Poppins", baseSize: 16 },
    shape: { radius: "soft", buttonStyle: "solid", buttonShape: "pill" },
    layout: { density: "compact" },
    header: {
      layout: "logo-start",
      sticky: true,
      showSearch: false,
      announcement: { enabled: true, text: t("الدفع عند الاستلام · اكتب هنا تفاصيل التوصيل عندك", "Cash on delivery · write your delivery details here"), href: "", background: "#1b1b1f", color: "#ffffff" },
    },
    productCard: { imageRatio: "square", showComparePrice: true, quickOrder: true },
    footer: { ...DEFAULT_THEME_SETTINGS.footer, columns: 3 },
  });
  const home = tree([
    P.heroImageSection(id, {
      eyebrow: t("الدفع عند الاستلام", "Cash on delivery"),
      title: t("اكتب هنا أقوى جملة عن منتجك", "Write the strongest line about your product"),
      text: t("اكتب هنا المشكلة اللي منتجك بيحلها في سطرين، بكلام بسيط وواضح.", "Describe the problem your product solves in two simple lines."),
      primary: { label: t("اطلب الآن", "Order now"), href: "#order" },
      secondary: { label: t("اعرف التفاصيل", "See details"), href: "#details" },
    }),
    P.trustSection(id, { items: trustItems(t) }, { tone: "surface" }),
    withAnchor(P.featuredProductSection(id, { eyebrow: t("اطلب في دقيقة", "Order in a minute"), title: t("اكتب هنا اسم المنتج", "Write the product name"), text: t("اختار الكمية واكتب بياناتك، وهنكلمك نأكد قبل الشحن.", "Pick a quantity, enter your details and we'll call to confirm.") }), "order"),
    withAnchor(
      P.benefitsSection(id, {
        eyebrow: t("ليه المنتج ده؟", "Why this product?"),
        title: t("اكتب هنا أهم مميزات المنتج", "Write the product's key benefits"),
        items: [
          { icon: "sparkle", title: t("اكتب ميزة", "A benefit"), text: t("اشرحها للعميل في سطر", "Explain it in one line") },
          { icon: "shield", title: t("اكتب ميزة", "A benefit"), text: t("اشرحها للعميل في سطر", "Explain it in one line") },
          { icon: "clock", title: t("اكتب ميزة", "A benefit"), text: t("اشرحها للعميل في سطر", "Explain it in one line") },
          { icon: "heart", title: t("اكتب ميزة", "A benefit"), text: t("اشرحها للعميل في سطر", "Explain it in one line") },
        ],
      }),
      "details"
    ),
    P.imageTextSection(
      id,
      {
        title: t("اكتب هنا المنتج بيستخدم إزاي", "Write how the product is used"),
        text: t("اكتب هنا خطوات الاستخدام أو المواقف اللي المنتج هيفرق فيها مع العميل.", "Write how to use it or the moments it makes a difference."),
        bullets: [t("اكتب استخدام أول", "First use"), t("اكتب استخدام تاني", "Second use"), t("اكتب استخدام تالت", "Third use")],
        cta: { label: t("اطلب الآن", "Order now"), href: "#order" },
        imageAlt: t("صورة المنتج وهو مستخدم", "Product in use"),
      },
      {},
      { imageEnd: true }
    ),
    P.heroPosterSection(id, { title: t("شوف المنتج على الطبيعة", "See it for real"), text: t("حط هنا رابط فيديو حقيقي للمنتج.", "Add a real video link for the product here."), imageAlt: t("فيديو المنتج", "Product video") }, { padding: "md" }, 2),
    P.stepsSection(id, { title: t("اطلب في 3 خطوات", "Order in 3 steps"), items: orderSteps(t) }, { tone: "surface" }),
    P.testimonialsSection(id, { title: t("آراء عملائنا", "What our customers say"), text: t("اكتب آراء حقيقية وصلتك من عملاء اشتروا فعلًا.", "Add real feedback from customers who actually bought.") }, { tone: "default" }),
    P.faqSection(id, { title: t("أسئلة قبل ما تطلب", "Questions before you order"), items: faqItems(t) }),
    P.ctaSection(id, { title: t("متستناش، اطلب دلوقتي", "Don't wait — order now"), text: t("الدفع عند الاستلام، ولو عندك سؤال كلمنا.", "Cash on delivery, and we're here if you have questions."), primary: { label: t("اطلب الآن", "Order now"), href: "#order" } }, { tone: "primary" }),
  ]);
  const pages = standardPages("souq", t, { accentTone: "surface", heroTone: "surface" });
  return { settings, pages: { home, ...pages } };
}

function luxe(locale: RendererLocale) {
  const t: T = (ar, en) => (locale === "ar" ? ar : en);
  const id = createIdFactory("luxe-home");
  const settings = baseSettings(t, {
    preset: "luxe",
    colors: { primary: "#1c1917", secondary: "#b08d57", background: "#fbfaf7", surface: "#f3efe7", text: "#1c1917", muted: "#6b645c", border: "#e6dfd3", buttonText: "auto" },
    typography: { arabicFont: "IBM Plex Sans Arabic", latinFont: "Montserrat", baseSize: 16 },
    shape: { radius: "sharp", buttonStyle: "outline", buttonShape: "square" },
    layout: { density: "airy" },
    header: { layout: "logo-center", sticky: true, showSearch: true, announcement: { enabled: true, text: t("اكتب هنا جملة راقية عن التغليف أو التوصيل", "Write an elegant line about packaging or delivery"), href: "", background: "#1c1917", color: "#f3efe7" } },
    productCard: { imageRatio: "portrait", showComparePrice: false, quickOrder: false },
  });
  const home = tree([
    P.heroImageSection(
      id,
      {
        eyebrow: t("المجموعة الجديدة", "The new collection"),
        title: t("اكتب هنا اسم مجموعتك", "Name your collection"),
        text: t("اكتب هنا وصف قصير وهادي يعبّر عن ذوق البراند.", "A short, quiet line that captures your brand."),
        primary: { label: t("اكتشف المجموعة", "Discover"), href: SHOP },
      },
      { tone: "dark", decor: false }
    ),
    P.collectionListSection(id, { title: t("المجموعات", "Collections"), limit: 3, columns: 3 }),
    P.productGridSection(id, { eyebrow: t("مختارات", "Curated"), title: t("اكتب هنا عنوان مختاراتك", "Title your selection"), limit: 6, columns: 3, link: { label: t("كل المنتجات", "All products"), href: SHOP } }, { tone: "surface" }),
    P.imageTextSection(
      id,
      {
        eyebrow: t("الحكاية", "Our story"),
        title: t("اكتب هنا حكاية البراند", "Tell your brand's story"),
        text: t("اكتب هنا عن الخامات، وإزاي بتختار كل قطعة، والتفاصيل اللي بتهتم بيها.", "Write about materials, how each piece is chosen and the details you care about."),
        cta: { label: t("اقرأ أكتر", "Read more"), href: "/about" },
        imageAlt: t("صورة للبراند", "Brand image"),
      },
      {},
      { ratio: "4/5" }
    ),
    P.gallerySection(id, { title: t("من عالمنا", "From our world"), count: 4, columns: 4 }),
    P.richTextSection(id, { title: t("اكتب هنا وعد البراند", "Write your brand promise"), text: t("اكتب هنا فقرة قصيرة عن التغليف الهدية، والخدمة، وطريقة التوصيل.", "A short paragraph on gift packaging, service and delivery.") }, { tone: "surface" }),
    P.whatsappSection(id, { title: t("محتاج مساعدة تختار؟", "Need help choosing?"), text: t("كلمنا واتساب ونساعدك تختار المناسب ليك أو للهدية.", "Message us on WhatsApp and we'll help you choose — for you or as a gift."), buttonLabel: t("كلمنا واتساب", "Chat on WhatsApp") }, { tone: "default" }),
  ]);
  return { settings, pages: { home, ...standardPages("luxe", t, { accentTone: "surface", heroTone: "surface" }) } };
}

function bazaar(locale: RendererLocale) {
  const t: T = (ar, en) => (locale === "ar" ? ar : en);
  const id = createIdFactory("bazaar-home");
  const settings = baseSettings(t, {
    preset: "bazaar",
    colors: { primary: "#2563eb", secondary: "#f97316", background: "#ffffff", surface: "#f1f5f9", text: "#0f172a", muted: "#475569", border: "#e2e8f0", buttonText: "auto" },
    typography: { arabicFont: "Almarai", latinFont: "Inter", baseSize: 15 },
    shape: { radius: "rounded", buttonStyle: "solid", buttonShape: "rounded" },
    layout: { density: "compact" },
    header: { layout: "logo-start", sticky: true, showSearch: true, announcement: { enabled: true, text: t("اكتب هنا عن التوصيل أو طرق الدفع", "Write about delivery or payment options"), href: "", background: "#f97316", color: "#111111" } },
    productCard: { imageRatio: "square", showComparePrice: true, quickOrder: true },
  });
  const home = tree([
    P.heroSplitSection(
      id,
      {
        eyebrow: t("كل اللي بيتك محتاجه", "Everything for your home"),
        title: t("اكتب هنا عنوان لأهم عروضك الحقيقية", "Headline your real featured range"),
        text: t("اكتب هنا جملة عن تنوع منتجاتك: أجهزة، أدوات، مستلزمات البيت.", "Write about your range: gadgets, tools, home essentials."),
        primary: { label: t("تسوّق دلوقتي", "Shop now"), href: SHOP },
        secondary: { label: t("الأقسام", "Collections"), href: "#collections" },
        imageAlt: t("صورة لمنتجات المتجر", "Store products"),
      },
      { tone: "gradient" },
      { ratio: "4/3" }
    ),
    P.trustSection(id, { items: trustItems(t) }),
    withAnchor(P.collectionListSection(id, { title: t("الأقسام", "Collections"), limit: 6, columns: 3 }, { tone: "surface" }), "collections"),
    P.productGridSection(id, { eyebrow: t("وصل حديثًا", "Just arrived"), title: t("أحدث المنتجات", "Latest products"), limit: 8, columns: 4, link: { label: t("شوف الكل", "View all"), href: SHOP } }),
    P.ctaSection(id, { title: t("اكتب هنا عنوان لقسم مميز", "Spotlight a collection"), text: t("اكتب هنا جملة عن القسم ده وحط لينك ليه.", "Write a line about it and link to it."), primary: { label: t("تصفح القسم", "Browse"), href: SHOP } }, { tone: "secondary", decor: false }),
    P.benefitsSection(id, {
      title: t("ليه تشتري من عندنا؟", "Why shop with us?"),
      items: [
        { icon: "box", title: t("تغليف كويس", "Careful packaging"), text: t("اكتب إزاي بتغلّف الطلبات", "Write how you pack orders") },
        { icon: "phone", title: t("بنأكد بالتليفون", "Phone confirmation"), text: t("بنكلمك قبل ما نشحن", "We call before shipping") },
        { icon: "shield", title: t("منتجات أصلية", "Genuine products"), text: t("اكتب مصدر منتجاتك", "Write where your products come from") },
        { icon: "return", title: t("استبدال سهل", "Easy exchange"), text: t("اكتب شروط الاستبدال", "Write your exchange terms") },
      ],
    }, { tone: "surface" }),
    P.logoStripSection(id, { title: t("اكتب هنا البراندات اللي بتبيعها", "Brands you carry") }),
    P.faqSection(id, { title: t("أسئلة بتتسأل كتير", "Frequently asked questions"), items: faqItems(t) }),
  ]);
  return { settings, pages: { home, ...standardPages("bazaar", t, { accentTone: "soft", heroTone: "soft" }) } };
}

function lamsa(locale: RendererLocale) {
  const t: T = (ar, en) => (locale === "ar" ? ar : en);
  const id = createIdFactory("lamsa-home");
  const settings = baseSettings(t, {
    preset: "lamsa",
    colors: { primary: "#b24d78", secondary: "#f2c4b3", background: "#fffafb", surface: "#fcf0f3", text: "#3a2430", muted: "#7c6470", border: "#f1dde4", buttonText: "auto" },
    typography: { arabicFont: "Noto Sans Arabic", latinFont: "Poppins", baseSize: 16 },
    shape: { radius: "pill", buttonStyle: "solid", buttonShape: "pill" },
    layout: { density: "comfortable" },
    header: { layout: "logo-center", sticky: true, showSearch: true, announcement: { enabled: true, text: t("اكتب هنا جملة لطيفة عن التوصيل أو التغليف", "Write a friendly line about delivery or packaging"), href: "", background: "#fcf0f3", color: "#b24d78" } },
    productCard: { imageRatio: "portrait", showComparePrice: true, quickOrder: true },
  });
  const home = tree([
    P.heroCenteredSection(
      id,
      {
        eyebrow: t("لمسة عناية كل يوم", "A touch of care, every day"),
        title: t("اكتب هنا عنوان ناعم عن منتجاتك", "Write a gentle headline about your products"),
        text: t("اكتب هنا عن نوع البشرة أو الشعر اللي منتجاتك مناسبة ليه.", "Write which skin or hair types your products suit."),
        primary: { label: t("اكتشفي المنتجات", "Discover products"), href: SHOP },
        secondary: { label: t("روتين العناية", "Care routine"), href: "#routine" },
      },
      { tone: "soft", decor: true }
    ),
    P.benefitsSection(id, {
      title: t("اكتب هنا إيه اللي يميز منتجاتك", "What makes your products special"),
      items: [
        { icon: "leaf", title: t("اكتب المكونات", "Ingredients"), text: t("اكتب أهم المكونات بصدق", "List key ingredients honestly") },
        { icon: "heart", title: t("مناسبة لمين؟", "Who it's for"), text: t("اكتب أنواع البشرة المناسبة", "Suitable skin types") },
        { icon: "sparkle", title: t("النتيجة", "The result"), text: t("اكتب النتيجة المتوقعة بدون مبالغة", "Expected result, no exaggeration") },
      ],
    }, { tone: "default" }),
    P.productGridSection(id, { eyebrow: t("منتجاتنا", "Our range"), title: t("اختاري اللي يناسبك", "Find your match"), limit: 8, columns: 4, link: { label: t("كل المنتجات", "All products"), href: SHOP } }, { tone: "surface" }),
    P.imageTextSection(id, {
      title: t("اكتب هنا قصة منتجك", "Tell your product's story"),
      text: t("اكتب هنا عن طريقة التصنيع أو الاختيار، وإزاي بتهتمي بجودة كل منتج.", "Write how it's made or sourced and how you look after quality."),
      bullets: [t("اكتب نقطة أولى", "First point"), t("اكتب نقطة تانية", "Second point")],
      imageAlt: t("صورة المنتج", "Product image"),
    }, {}, { ratio: "4/5" }),
    withAnchor(
      P.stepsSection(id, {
        title: t("روتين بسيط", "A simple routine"),
        items: [
          { title: t("اكتب الخطوة الأولى", "Step one"), text: t("اشرحي الخطوة في سطر", "Explain in one line") },
          { title: t("اكتب الخطوة التانية", "Step two"), text: t("اشرحي الخطوة في سطر", "Explain in one line") },
          { title: t("اكتب الخطوة التالتة", "Step three"), text: t("اشرحي الخطوة في سطر", "Explain in one line") },
        ],
      }, { tone: "soft" }),
      "routine"
    ),
    P.testimonialsSection(id, { title: t("كلام عميلاتنا", "From our customers"), text: t("اكتبي آراء حقيقية بإذن أصحابها.", "Add real feedback, with permission.") }, { tone: "default" }),
    P.faqSection(id, { title: t("أسئلة بتتسأل كتير", "Frequently asked questions"), items: faqItems(t) }, { tone: "surface" }),
    P.whatsappSection(id, { title: t("محتارة تختاري إيه؟", "Not sure what to pick?"), text: t("ابعتيلنا على واتساب ونساعدك تختاري المناسب ليكي.", "Message us on WhatsApp and we'll help you choose."), buttonLabel: t("كلمينا واتساب", "Chat on WhatsApp") }),
  ]);
  return { settings, pages: { home, ...standardPages("lamsa", t, { accentTone: "soft", heroTone: "soft" }) } };
}

// ---------------------------------------------------------------------------
// Niche stores — page flows follow patterns proven by leading stores in each
// category (editorial fashion, routine-led skincare, spec-led tech…), rebuilt
// with our own sections and placeholder copy only.
// ---------------------------------------------------------------------------

type Item = { icon: string; title: string; text: string };
const item = (t: T, icon: string, title: [string, string], text: [string, string]): Item => ({ icon, title: t(...title), text: t(...text) });
const bullets = (t: T, n = 3) => [t("اكتب نقطة أولى", "First point"), t("اكتب نقطة تانية", "Second point"), t("اكتب نقطة تالتة", "Third point")].slice(0, n);

/** Fashion — editorial: big dark image, portrait cards, sizes up front. */
function moda(locale: RendererLocale) {
  const t: T = (ar, en) => (locale === "ar" ? ar : en);
  const id = createIdFactory("moda-home");
  const settings = baseSettings(t, {
    preset: "moda",
    colors: { primary: "#111111", secondary: "#c8b8a6", background: "#ffffff", surface: "#f4f2ef", text: "#111111", muted: "#5f5a54", border: "#e7e3de", buttonText: "auto" },
    typography: { arabicFont: "IBM Plex Sans Arabic", latinFont: "Montserrat", baseSize: 15 },
    shape: { radius: "sharp", buttonStyle: "solid", buttonShape: "square" },
    layout: { density: "airy" },
    header: { layout: "logo-center", sticky: true, showSearch: true, announcement: { enabled: true, text: t("الدفع عند الاستلام · استبدال المقاس سهل", "Cash on delivery · easy size exchange"), href: "", background: "#111111", color: "#ffffff" } },
    productCard: { imageRatio: "portrait", showComparePrice: true, quickOrder: false },
  });
  const home = tree([
    P.heroImageSection(id, { eyebrow: t("كوليكشن الموسم", "Season collection"), title: t("اكتب هنا اسم الكوليكشن", "Name your collection"), text: t("جملة قصيرة عن الستايل والخامات.", "One short line on the style and fabrics."), primary: { label: t("تسوّق الجديد", "Shop new in"), href: SHOP }, secondary: { label: t("الأقسام", "Categories"), href: "#categories" } }, { tone: "dark" }),
    withAnchor(P.collectionListSection(id, { title: t("تسوّق حسب القسم", "Shop by category"), limit: 4, columns: 4 }), "categories"),
    P.productGridSection(id, { eyebrow: t("وصل جديد", "New in"), title: t("أحدث القطع", "Latest pieces"), limit: 8, columns: 4, link: { label: t("شوف الكل", "View all"), href: SHOP } }),
    P.imageTextSection(id, { eyebrow: t("لوك الأسبوع", "Look of the week"), title: t("اكتب هنا اسم اللوك", "Name the look"), text: t("اشرح إزاي القطع دي بتتلبس مع بعض.", "Explain how these pieces work together."), cta: { label: t("تسوّق اللوك", "Shop the look"), href: SHOP }, imageAlt: t("صورة اللوك", "Look photo") }, { tone: "surface" }, { ratio: "4/5" }),
    P.gallerySection(id, { title: t("من الكوليكشن", "From the collection"), count: 4, columns: 4 }),
    P.sizeGuideSection(id, { title: t("دليل المقاسات", "Size guide"), text: t("اكتب مقاساتك الحقيقية بالسنتيمتر.", "Add your real measurements in cm."), table: t("المقاس | الصدر | الطول\nS | اكتب هنا | اكتب هنا\nM | اكتب هنا | اكتب هنا\nL | اكتب هنا | اكتب هنا", "Size | Chest | Length\nS | — | —\nM | — | —\nL | — | —") }),
    P.trustSection(id, { items: [item(t, "cash", ["الدفع عند الاستلام", "Cash on delivery"], ["جرّب وادفع لما يوصلك", "Pay when it arrives"]), item(t, "ruler", ["استبدال المقاس", "Size exchange"], ["اكتب شروط الاستبدال", "Write your exchange terms"]), item(t, "truck", ["توصيل لكل مصر", "Nationwide delivery"], ["اكتب مدة التوصيل", "Write delivery time"])] }, { tone: "surface" }),
  ]);
  return { settings, pages: { home, ...standardPages("moda", t, { accentTone: "surface", heroTone: "surface" }) } };
}

/** Modest wear & abayas — calm, elegant, fabric and length details. */
function sitara(locale: RendererLocale) {
  const t: T = (ar, en) => (locale === "ar" ? ar : en);
  const id = createIdFactory("sitara-home");
  const settings = baseSettings(t, {
    preset: "sitara",
    colors: { primary: "#5b4636", secondary: "#d8c3a5", background: "#fdfbf7", surface: "#f5eee4", text: "#2e241c", muted: "#6e6054", border: "#eadfce", buttonText: "auto" },
    typography: { arabicFont: "Almarai", latinFont: "Poppins", baseSize: 16 },
    shape: { radius: "soft", buttonStyle: "solid", buttonShape: "rounded" },
    layout: { density: "comfortable" },
    header: { layout: "logo-center", sticky: true, showSearch: true, announcement: { enabled: true, text: t("اكتب هنا عن التوصيل أو الكوليكشن الجديد", "Write about delivery or the new collection"), href: "", background: "#5b4636", color: "#fdfbf7" } },
    productCard: { imageRatio: "portrait", showComparePrice: true, quickOrder: true },
  });
  const home = tree([
    P.heroSplitSection(id, { eyebrow: t("أناقة بهدوء", "Quiet elegance"), title: t("اكتب هنا عنوان الكوليكشن", "Headline your collection"), text: t("اكتبي عن الخامة والقصّة والراحة في اللبس.", "Write about fabric, cut and comfort."), primary: { label: t("تسوّقي الآن", "Shop now"), href: SHOP }, imageAlt: t("صورة عباية", "Abaya photo") }, { tone: "soft" }, { ratio: "4/5" }),
    P.collectionListSection(id, { title: t("عبايات · طرح · إسدالات", "Abayas · scarves · prayer wear"), limit: 3, columns: 3 }),
    P.productGridSection(id, { title: t("الأكثر طلبًا", "Most requested"), text: t("اختاري القطع اللي عايزاها تظهر هنا.", "Choose which pieces appear here."), limit: 8, columns: 4, link: { label: t("كل المنتجات", "All products"), href: SHOP } }, { tone: "surface" }),
    P.benefitsSection(id, { title: t("تفاصيل تفرق", "Details that matter"), items: [item(t, "leaf", ["الخامة", "Fabric"], ["اكتبي نوع القماش", "Write the fabric type"]), item(t, "ruler", ["الأطوال", "Lengths"], ["اكتبي الأطوال المتاحة", "Write available lengths"]), item(t, "gift", ["التغليف", "Packaging"], ["اكتبي طريقة التغليف", "Describe packaging"]), item(t, "return", ["الاستبدال", "Exchange"], ["اكتبي شروط الاستبدال", "Write exchange terms"])] }),
    P.sizeGuideSection(id, { title: t("جدول الأطوال", "Length guide"), text: t("اكتبي الطول المناسب لكل مقاس.", "Add the right length per size."), table: t("طولك | طول العباية\nاكتب هنا | اكتب هنا\nاكتب هنا | اكتب هنا", "Your height | Abaya length\n— | —\n— | —") }, { tone: "surface" }),
    P.whatsappSection(id, { title: t("محتارة في المقاس؟", "Unsure about size?"), text: t("ابعتيلنا طولك ووزنك ونساعدك تختاري.", "Send us your height and we'll help you choose."), buttonLabel: t("كلمينا واتساب", "Chat on WhatsApp") }),
  ]);
  return { settings, pages: { home, ...standardPages("sitara", t, { accentTone: "soft", heroTone: "soft" }) } };
}

/** Jewellery & accessories — cream and gold, gifting and care. */
function dahab(locale: RendererLocale) {
  const t: T = (ar, en) => (locale === "ar" ? ar : en);
  const id = createIdFactory("dahab-home");
  const settings = baseSettings(t, {
    preset: "dahab",
    colors: { primary: "#8a6a2f", secondary: "#e9d8b4", background: "#fffdf8", surface: "#f7f1e6", text: "#2a2419", muted: "#6b604e", border: "#ece2cf", buttonText: "auto" },
    typography: { arabicFont: "IBM Plex Sans Arabic", latinFont: "Montserrat", baseSize: 16 },
    shape: { radius: "soft", buttonStyle: "outline", buttonShape: "pill" },
    layout: { density: "airy" },
    header: { layout: "logo-center", sticky: true, showSearch: true, announcement: { enabled: true, text: t("تغليف هدية مع كل طلب · اكتب التفاصيل هنا", "Gift wrapping on every order · add details here"), href: "", background: "#2a2419", color: "#e9d8b4" } },
    productCard: { imageRatio: "square", showComparePrice: false, quickOrder: false },
  });
  const home = tree([
    P.heroCenteredSection(id, { eyebrow: t("تفاصيل صغيرة بتلمع", "Small details that shine"), title: t("اكتب هنا عنوان مجموعتك", "Headline your collection"), text: t("اكتب عن الخامة: فضة، ستانلس، مطلي…", "Write the material: silver, steel, plated…"), primary: { label: t("اكتشفي القطع", "Discover pieces"), href: SHOP }, secondary: { label: t("هدايا", "Gifts"), href: "#gifts" } }, { tone: "surface", decor: true }),
    P.collectionListSection(id, { title: t("خواتم · سلاسل · أساور · حلقان", "Rings · necklaces · bracelets · earrings"), limit: 4, columns: 4 }),
    P.productGridSection(id, { eyebrow: t("مختارات", "Curated"), title: t("قطع مميزة", "Signature pieces"), limit: 6, columns: 3 }),
    withAnchor(P.imageTextSection(id, { eyebrow: t("هدية جاهزة", "Ready to gift"), title: t("اكتب هنا عن تغليف الهدايا", "Write about gift packaging"), text: t("علبة، كارت بإسمك، رسالة… اكتب اللي بتقدمه فعلًا.", "Box, card, message — write what you really offer."), bullets: bullets(t, 2), imageAlt: t("صورة علبة الهدية", "Gift box photo") }, { tone: "soft" }), "gifts"),
    P.sizeGuideSection(id, { title: t("مقاس الخاتم", "Ring sizes"), text: t("اكتب طريقة قياس الخاتم ومقاساتك.", "Explain how to measure and list your sizes."), table: t("المقاس | محيط الإصبع\nاكتب هنا | اكتب هنا\nاكتب هنا | اكتب هنا", "Size | Finger circumference\n— | —\n— | —") }),
    P.richTextSection(id, { title: t("إزاي تحافظي على قطعتك", "Caring for your piece"), text: t("اكتب نصايح العناية الحقيقية حسب الخامة.", "Write real care tips for the material.") }, { tone: "surface" }),
  ]);
  return { settings, pages: { home, ...standardPages("dahab", t, { accentTone: "surface", heroTone: "surface" }) } };
}

/** Skincare — routine-led, ingredients first, skin type finder. */
function glow(locale: RendererLocale) {
  const t: T = (ar, en) => (locale === "ar" ? ar : en);
  const id = createIdFactory("glow-home");
  const settings = baseSettings(t, {
    preset: "glow",
    colors: { primary: "#c0587e", secondary: "#fbd9c9", background: "#fffaf8", surface: "#fdeee9", text: "#3b2a2f", muted: "#76626a", border: "#f5dfd8", buttonText: "auto" },
    typography: { arabicFont: "Tajawal", latinFont: "Poppins", baseSize: 16 },
    shape: { radius: "pill", buttonStyle: "solid", buttonShape: "pill" },
    layout: { density: "comfortable" },
    header: { layout: "logo-start", sticky: true, showSearch: true, announcement: { enabled: true, text: t("اكتبي هنا عن التوصيل أو هدية مع الطلب", "Write about delivery or a free gift"), href: "", background: "#fdeee9", color: "#8f3c5b" } },
    productCard: { imageRatio: "square", showComparePrice: true, quickOrder: true },
  });
  const home = tree([
    P.heroSplitSection(id, { eyebrow: t("روتينك يبدأ هنا", "Your routine starts here"), title: t("اكتب هنا وعد منتجاتك بدون مبالغة", "Your product promise, no exaggeration"), text: t("اكتبي نوع البشرة اللي منتجاتك مناسبة ليها.", "Which skin types your products suit."), primary: { label: t("تسوّقي", "Shop"), href: SHOP }, secondary: { label: t("اعرفي نوع بشرتك", "Find your skin type"), href: "#skin" }, imageAlt: t("صورة المنتج", "Product photo") }, { tone: "soft" }),
    withAnchor(P.benefitsSection(id, { title: t("تسوّقي حسب نوع البشرة", "Shop by skin type"), items: [item(t, "sparkle", ["دهنية", "Oily"], ["اكتبي المنتج المناسب", "Write the matching product"]), item(t, "leaf", ["جافة", "Dry"], ["اكتبي المنتج المناسب", "Write the matching product"]), item(t, "heart", ["حساسة", "Sensitive"], ["اكتبي المنتج المناسب", "Write the matching product"]), item(t, "shield", ["مختلطة", "Combination"], ["اكتبي المنتج المناسب", "Write the matching product"])] }), "skin"),
    P.productGridSection(id, { eyebrow: t("الأساسيات", "Essentials"), title: t("منتجات الروتين", "Routine products"), limit: 4, columns: 4 }, { tone: "surface" }),
    P.stepsSection(id, { title: t("روتين في 3 خطوات", "A 3-step routine"), items: [{ title: t("نضّفي", "Cleanse"), text: t("اكتبي المنتج وطريقة الاستخدام", "Product and how to use") }, { title: t("رطّبي", "Moisturise"), text: t("اكتبي المنتج وطريقة الاستخدام", "Product and how to use") }, { title: t("احمي", "Protect"), text: t("اكتبي المنتج وطريقة الاستخدام", "Product and how to use") }] }),
    P.imageTextSection(id, { eyebrow: t("المكونات", "Ingredients"), title: t("اكتبي أهم المكونات بصدق", "List key ingredients honestly"), text: t("إيه فايدة كل مكوّن، ومين مايستخدموش.", "What each does, and who should avoid it."), bullets: bullets(t), imageAlt: t("صورة المكونات", "Ingredients photo") }, { tone: "soft" }, { imageEnd: true, ratio: "4/5" }),
    P.testimonialsSection(id, { title: t("تجارب حقيقية", "Real experiences"), text: t("آراء حقيقية بإذن أصحابها بس.", "Real feedback, with permission only.") }),
    P.faqSection(id, { title: t("أسئلة عن المنتجات", "Product questions"), items: faqItems(t) }, { tone: "surface" }),
  ]);
  return { settings, pages: { home, ...standardPages("glow", t, { accentTone: "soft", heroTone: "soft" }) } };
}

/** Perfume & oud — dark, gold, scent notes and gifting. */
function oud(locale: RendererLocale) {
  const t: T = (ar, en) => (locale === "ar" ? ar : en);
  const id = createIdFactory("oud-home");
  const settings = baseSettings(t, {
    preset: "oud",
    colors: { primary: "#b8893b", secondary: "#3a2b1e", background: "#faf7f2", surface: "#f0e9de", text: "#1d1712", muted: "#65594c", border: "#e4d9c8", buttonText: "auto" },
    typography: { arabicFont: "IBM Plex Sans Arabic", latinFont: "Montserrat", baseSize: 16 },
    shape: { radius: "sharp", buttonStyle: "solid", buttonShape: "square" },
    layout: { density: "airy" },
    header: { layout: "logo-center", sticky: true, showSearch: false, announcement: { enabled: true, text: t("اكتب هنا عن عينات أو تغليف الهدايا", "Write about samples or gift wrapping"), href: "", background: "#1d1712", color: "#e7c98f" } },
    productCard: { imageRatio: "portrait", showComparePrice: false, quickOrder: true },
  });
  const home = tree([
    P.heroImageSection(id, { eyebrow: t("عطور وعود", "Perfume & oud"), title: t("اكتب هنا جملة عن ريحة البراند", "A line about your signature scent"), text: t("اكتب عن التركيز والثبات بكلام صادق.", "Write about concentration and longevity honestly."), primary: { label: t("اكتشف العطور", "Discover scents"), href: SHOP } }, { tone: "dark" }),
    P.benefitsSection(id, { title: t("اختار حسب النوتة", "Choose by note"), items: [item(t, "leaf", ["خشبي", "Woody"], ["اكتب العطور هنا", "List scents here"]), item(t, "sparkle", ["شرقي", "Oriental"], ["اكتب العطور هنا", "List scents here"]), item(t, "heart", ["زهري", "Floral"], ["اكتب العطور هنا", "List scents here"]), item(t, "star", ["فريش", "Fresh"], ["اكتب العطور هنا", "List scents here"])] }, { tone: "surface" }),
    P.productGridSection(id, { eyebrow: t("المجموعة", "The collection"), title: t("عطورنا", "Our perfumes"), limit: 6, columns: 3 }),
    P.imageTextSection(id, { eyebrow: t("الهرم العطري", "Scent pyramid"), title: t("اكتب هنا نوتات عطرك الأشهر", "Notes of your signature perfume"), text: t("المقدمة، القلب، والقاعدة.", "Top, heart and base notes."), bullets: [t("المقدمة: اكتب هنا", "Top: write here"), t("القلب: اكتب هنا", "Heart: write here"), t("القاعدة: اكتب هنا", "Base: write here")], imageAlt: t("زجاجة العطر", "Perfume bottle") }, { tone: "dark" }, { ratio: "4/5" }),
    P.ctaSection(id, { title: t("هدية ريحتها حلوة", "A gift that smells wonderful"), text: t("اكتب عن تغليف الهدايا والكارت.", "Write about gift wrap and cards."), primary: { label: t("اختار هدية", "Choose a gift"), href: SHOP } }, { tone: "surface", decor: false }),
    P.whatsappSection(id, { title: t("مش عارف تختار؟", "Not sure which?"), text: t("قولنا بتحب أنهي ريحة ونرشحلك.", "Tell us what you like and we'll suggest."), buttonLabel: t("استشارة واتساب", "Ask on WhatsApp") }),
  ]);
  return { settings, pages: { home, ...standardPages("oud", t, { accentTone: "surface", heroTone: "surface" }) } };
}

/** Electronics & gadgets — clean, spec-led, video demo, warranty. */
function tech(locale: RendererLocale) {
  const t: T = (ar, en) => (locale === "ar" ? ar : en);
  const id = createIdFactory("tech-home");
  const settings = baseSettings(t, {
    preset: "tech",
    colors: { primary: "#0a66ff", secondary: "#0f172a", background: "#ffffff", surface: "#f3f5f8", text: "#0b1220", muted: "#4b5565", border: "#e3e8ef", buttonText: "auto" },
    typography: { arabicFont: "Cairo", latinFont: "Inter", baseSize: 16 },
    shape: { radius: "rounded", buttonStyle: "solid", buttonShape: "pill" },
    layout: { density: "comfortable" },
    header: { layout: "logo-start", sticky: true, showSearch: true, announcement: { enabled: true, text: t("ضمان حقيقي · اكتب مدته هنا", "Real warranty · write its length here"), href: "", background: "#0b1220", color: "#ffffff" } },
    productCard: { imageRatio: "square", showComparePrice: true, quickOrder: true },
  });
  const home = tree([
    P.heroCenteredSection(id, { eyebrow: t("جديد", "New"), title: t("اكتب هنا اسم الجهاز", "Name the device"), text: t("أهم ميزة في سطر واحد واضح.", "Its key feature in one clear line."), primary: { label: t("اطلب الآن", "Order now"), href: SHOP }, secondary: { label: t("المواصفات", "Specs"), href: "#specs" } }, { tone: "surface" }),
    P.heroPosterSection(id, { title: t("شوفه وهو شغال", "See it in action"), text: t("حط فيديو حقيقي للمنتج.", "Add a real product video."), imageAlt: t("فيديو المنتج", "Product video") }, { padding: "md" }, 2),
    P.benefitsSection(id, { title: t("ليه هتحبه", "Why you'll love it"), items: [item(t, "sparkle", ["اكتب ميزة", "A feature"], ["اشرحها في سطر", "One line"]), item(t, "clock", ["البطارية", "Battery"], ["اكتب المدة الحقيقية", "Real battery life"]), item(t, "shield", ["الضمان", "Warranty"], ["اكتب مدة وشروط الضمان", "Warranty length & terms"]), item(t, "box", ["في العلبة", "In the box"], ["اكتب محتويات العلبة", "What's in the box"])] }),
    withAnchor(P.sizeGuideSection(id, { title: t("المواصفات", "Specifications"), text: t("اكتب المواصفات من الشركة المصنعة.", "Use the manufacturer's specs."), table: t("المواصفة | القيمة\nالشاشة | اكتب هنا\nالبطارية | اكتب هنا\nالتوصيل | اكتب هنا\nالضمان | اكتب هنا", "Spec | Value\nScreen | —\nBattery | —\nConnectivity | —\nWarranty | —") }, { tone: "surface" }), "specs"),
    P.productGridSection(id, { title: t("إكسسوارات ومنتجات تانية", "Accessories & more"), limit: 8, columns: 4, link: { label: t("كل المنتجات", "All products"), href: SHOP } }),
    P.logoStripSection(id, { title: t("البراندات اللي بنبيعها", "Brands we carry") }, { tone: "surface" }),
    P.faqSection(id, { title: t("قبل ما تشتري", "Before you buy"), items: faqItems(t) }),
  ]);
  return { settings, pages: { home, ...standardPages("tech", t, { accentTone: "surface", heroTone: "surface" }) } };
}

/** Car accessories — bold dark, fitment by model, install video. */
function turbo(locale: RendererLocale) {
  const t: T = (ar, en) => (locale === "ar" ? ar : en);
  const id = createIdFactory("turbo-home");
  const settings = baseSettings(t, {
    preset: "turbo",
    colors: { primary: "#e11d2a", secondary: "#facc15", background: "#ffffff", surface: "#f2f2f3", text: "#111113", muted: "#52525b", border: "#e4e4e7", buttonText: "auto" },
    typography: { arabicFont: "Cairo", latinFont: "Montserrat", baseSize: 16 },
    shape: { radius: "soft", buttonStyle: "solid", buttonShape: "rounded" },
    layout: { density: "compact" },
    header: { layout: "logo-start", sticky: true, showSearch: true, announcement: { enabled: true, text: t("اكتب موديل عربيتك واسألنا قبل ما تطلب", "Tell us your car model before you order"), href: "", background: "#111113", color: "#facc15" } },
    productCard: { imageRatio: "square", showComparePrice: true, quickOrder: true },
  });
  const home = tree([
    P.heroSplitSection(id, { eyebrow: t("إكسسوارات عربيات", "Car accessories"), title: t("اكتب هنا أهم منتج عندك", "Headline your top product"), text: t("اكتب الموديلات اللي المنتج مناسب ليها.", "Which car models it fits."), primary: { label: t("اطلب الآن", "Order now"), href: SHOP }, secondary: { label: t("تركيب", "Installation"), href: "#install" }, imageAlt: t("صورة المنتج في العربية", "Product in the car") }, { tone: "dark" }),
    P.trustSection(id, { items: trustItems(t) }, { tone: "surface" }),
    P.collectionListSection(id, { title: t("تسوّق حسب القسم", "Shop by category"), text: t("إضاءة، فرش، شاشات، عناية…", "Lighting, covers, screens, care…"), limit: 6, columns: 3 }),
    P.productGridSection(id, { eyebrow: t("الأكثر طلبًا", "Top picks"), title: t("منتجاتنا", "Our products"), limit: 8, columns: 4 }, { tone: "surface" }),
    withAnchor(P.heroPosterSection(id, { title: t("التركيب سهل", "Easy to install"), text: t("حط فيديو تركيب حقيقي.", "Add a real installation video."), imageAlt: t("فيديو التركيب", "Install video") }, { padding: "md" }, 2), "install"),
    P.sizeGuideSection(id, { title: t("مناسب لعربيتك؟", "Does it fit your car?"), text: t("اكتب الموديلات والسنين المتوافقة.", "List compatible models and years."), table: t("الماركة | الموديل | السنة\nاكتب هنا | اكتب هنا | اكتب هنا", "Make | Model | Year\n— | — | —") }),
    P.whatsappSection(id, { title: t("ابعت صورة عربيتك", "Send a photo of your car"), text: t("ونقولك المنتج المناسب.", "We'll tell you what fits."), buttonLabel: t("واتساب", "WhatsApp") }),
  ]);
  return { settings, pages: { home, ...standardPages("turbo", t, { accentTone: "surface", heroTone: "surface" }) } };
}

/** Home & kitchen — warm neutrals, rooms, how-to. */
function beit(locale: RendererLocale) {
  const t: T = (ar, en) => (locale === "ar" ? ar : en);
  const id = createIdFactory("beit-home");
  const settings = baseSettings(t, {
    preset: "beit",
    colors: { primary: "#3f6b4f", secondary: "#e8c07d", background: "#fbfaf6", surface: "#f1eee6", text: "#23261f", muted: "#5d6157", border: "#e3dfd3", buttonText: "auto" },
    typography: { arabicFont: "Almarai", latinFont: "Inter", baseSize: 16 },
    shape: { radius: "rounded", buttonStyle: "solid", buttonShape: "rounded" },
    layout: { density: "comfortable" },
    header: { layout: "logo-start", sticky: true, showSearch: true, announcement: { enabled: true, text: t("اكتب هنا عن التوصيل للمنتجات الكبيرة", "Write about delivery for large items"), href: "", background: "#3f6b4f", color: "#ffffff" } },
    productCard: { imageRatio: "square", showComparePrice: true, quickOrder: true },
  });
  const home = tree([
    P.heroImageSection(id, { eyebrow: t("بيتك أحلى", "A nicer home"), title: t("اكتب هنا عنوان عن منتجات البيت", "Headline your home range"), text: t("مطبخ، تنظيم، ديكور… اكتب اللي بتبيعه.", "Kitchen, storage, decor — write what you sell."), primary: { label: t("تسوّق", "Shop"), href: SHOP }, secondary: { label: t("حسب الأوضة", "By room"), href: "#rooms" } }),
    withAnchor(P.collectionListSection(id, { title: t("تسوّق حسب الأوضة", "Shop by room"), text: t("المطبخ · الصالة · أوضة النوم · الحمام", "Kitchen · living · bedroom · bathroom"), limit: 4, columns: 4 }, { tone: "surface" }), "rooms"),
    P.productGridSection(id, { eyebrow: t("وصل حديثًا", "Just in"), title: t("أحدث المنتجات", "Latest products"), limit: 8, columns: 4, link: { label: t("شوف الكل", "View all"), href: SHOP } }),
    P.imageTextSection(id, { title: t("اكتب هنا فكرة تنظيم أو استخدام", "A storage or usage idea"), text: t("وري العميل المنتج في بيت حقيقي.", "Show the product in a real home."), bullets: bullets(t), cta: { label: t("اطلب", "Order"), href: SHOP }, imageAlt: t("المنتج في البيت", "Product at home") }, { tone: "soft" }, { imageEnd: true }),
    P.stepsSection(id, { title: t("الطلب سهل", "Ordering is easy"), items: orderSteps(t) }),
    P.benefitsSection(id, { title: t("ليه تشتري من عندنا", "Why shop with us"), items: [item(t, "box", ["تغليف آمن", "Safe packing"], ["للمنتجات القابلة للكسر", "For fragile items"]), item(t, "phone", ["تأكيد بالتليفون", "Phone confirmation"], ["قبل الشحن", "Before shipping"]), item(t, "return", ["استبدال", "Exchange"], ["اكتب الشروط", "Write your terms"])] }, { tone: "surface" }),
  ]);
  return { settings, pages: { home, ...standardPages("beit", t, { accentTone: "soft", heroTone: "soft" }) } };
}

/** Kids & toys — playful, by age, safety first. */
function atfal(locale: RendererLocale) {
  const t: T = (ar, en) => (locale === "ar" ? ar : en);
  const id = createIdFactory("atfal-home");
  const settings = baseSettings(t, {
    preset: "atfal",
    colors: { primary: "#6d4aff", secondary: "#ffc93c", background: "#ffffff", surface: "#f3f0ff", text: "#1f1a3d", muted: "#5b5675", border: "#e7e2fb", buttonText: "auto" },
    typography: { arabicFont: "Tajawal", latinFont: "Poppins", baseSize: 16 },
    shape: { radius: "pill", buttonStyle: "solid", buttonShape: "pill" },
    layout: { density: "comfortable" },
    header: { layout: "logo-start", sticky: true, showSearch: true, announcement: { enabled: true, text: t("اكتب هنا عن التوصيل أو تغليف الهدايا", "Write about delivery or gift wrap"), href: "", background: "#ffc93c", color: "#1f1a3d" } },
    productCard: { imageRatio: "square", showComparePrice: true, quickOrder: true },
  });
  const home = tree([
    P.heroSplitSection(id, { eyebrow: t("لعب وتعلّم", "Play & learn"), title: t("اكتب هنا عنوان مبهج", "A cheerful headline"), text: t("اكتب الأعمار المناسبة لمنتجاتك.", "Which ages your products suit."), primary: { label: t("تسوّق", "Shop"), href: SHOP }, imageAlt: t("أطفال بيلعبوا", "Kids playing") }, { tone: "soft", decor: true }),
    P.benefitsSection(id, { title: t("تسوّق حسب السن", "Shop by age"), items: [item(t, "heart", ["رُضّع", "Babies"], ["اكتب الأعمار", "Write the ages"]), item(t, "star", ["أطفال صغيرين", "Toddlers"], ["اكتب الأعمار", "Write the ages"]), item(t, "sparkle", ["أطفال", "Kids"], ["اكتب الأعمار", "Write the ages"]), item(t, "gift", ["هدايا", "Gifts"], ["لأي مناسبة", "For any occasion"])] }),
    P.productGridSection(id, { title: t("الأكثر حبًا", "Most loved"), limit: 8, columns: 4 }, { tone: "surface" }),
    P.trustSection(id, { items: [item(t, "shield", ["خامات آمنة", "Safe materials"], ["اكتب الخامات والشهادات الحقيقية", "Write real materials & certificates"]), item(t, "cash", ["الدفع عند الاستلام", "Cash on delivery"], ["ادفع لما يوصلك", "Pay on arrival"]), item(t, "gift", ["تغليف هدية", "Gift wrap"], ["اكتب التفاصيل", "Add details"])] }),
    P.imageTextSection(id, { eyebrow: t("للأهل", "For parents"), title: t("اكتب هنا إزاي اللعبة بتفيد الطفل", "How the toy helps your child"), text: t("مهارات، تركيز، خيال… بكلام صادق.", "Skills, focus, imagination — honestly."), bullets: bullets(t), imageAlt: t("صورة اللعبة", "Toy photo") }, { tone: "soft" }, { imageEnd: true }),
    P.faqSection(id, { title: t("أسئلة الأهل", "Parents' questions"), items: faqItems(t) }),
  ]);
  return { settings, pages: { home, ...standardPages("atfal", t, { accentTone: "soft", heroTone: "soft" }) } };
}

/** Sports & fitness — black and lime, poster hero, performance. */
function fit(locale: RendererLocale) {
  const t: T = (ar, en) => (locale === "ar" ? ar : en);
  const id = createIdFactory("fit-home");
  const settings = baseSettings(t, {
    preset: "fit",
    colors: { primary: "#111111", secondary: "#c6f432", background: "#ffffff", surface: "#f2f3f0", text: "#0d0d0d", muted: "#565a52", border: "#e2e4de", buttonText: "auto" },
    typography: { arabicFont: "Cairo", latinFont: "Montserrat", baseSize: 16 },
    shape: { radius: "soft", buttonStyle: "solid", buttonShape: "square" },
    layout: { density: "compact" },
    header: { layout: "logo-start", sticky: true, showSearch: true, announcement: { enabled: true, text: t("اكتب هنا عن الكوليكشن أو التوصيل", "Write about the drop or delivery"), href: "", background: "#c6f432", color: "#0d0d0d" } },
    productCard: { imageRatio: "portrait", showComparePrice: true, quickOrder: true },
  });
  const home = tree([
    P.heroPosterSection(id, { eyebrow: t("اتمرّن بثقة", "Train with confidence"), title: t("اكتب هنا عنوان قوي", "A bold headline"), text: t("لبس وأدوات للجيم والجري.", "Gear for the gym and the run."), primary: { label: t("تسوّق الآن", "Shop now"), href: SHOP } }),
    P.collectionListSection(id, { title: t("رجالي · حريمي · أدوات", "Men · women · equipment"), limit: 3, columns: 3 }),
    P.productGridSection(id, { eyebrow: t("جديد", "New drop"), title: t("أحدث القطع", "Latest gear"), limit: 8, columns: 4, link: { label: t("شوف الكل", "View all"), href: SHOP } }, { tone: "surface" }),
    P.benefitsSection(id, { title: t("معمول للحركة", "Built to move"), items: [item(t, "leaf", ["خامة بتتنفس", "Breathable"], ["اكتب الخامة", "Write the fabric"]), item(t, "shield", ["تحمّل", "Durable"], ["اكتب التفاصيل", "Add details"]), item(t, "ruler", ["مقاسات مظبوطة", "True fit"], ["شوف جدول المقاسات", "See the size guide"])] }, { tone: "dark" }),
    P.imageTextSection(id, { eyebrow: t("تمرين الأسبوع", "Workout of the week"), title: t("اكتب هنا تمرين أو نصيحة", "A workout or tip"), text: t("محتوى مفيد بيخلي العميل يرجعلك.", "Useful content that brings shoppers back."), bullets: bullets(t), imageAlt: t("صورة تمرين", "Workout photo") }, {}, { ratio: "4/5" }),
    P.sizeGuideSection(id, { title: t("دليل المقاسات", "Size guide"), text: t("اكتب مقاساتك الحقيقية.", "Add your real measurements."), table: t("المقاس | الصدر | الوسط\nS | اكتب هنا | اكتب هنا\nM | اكتب هنا | اكتب هنا\nL | اكتب هنا | اكتب هنا", "Size | Chest | Waist\nS | — | —\nM | — | —\nL | — | —") }, { tone: "surface" }),
  ]);
  return { settings, pages: { home, ...standardPages("fit", t, { accentTone: "surface", heroTone: "surface" }) } };
}

/** Food, coffee & organic — earthy, origin story, freshness. */
function taza(locale: RendererLocale) {
  const t: T = (ar, en) => (locale === "ar" ? ar : en);
  const id = createIdFactory("taza-home");
  const settings = baseSettings(t, {
    preset: "taza",
    colors: { primary: "#6b3e26", secondary: "#9bbf6a", background: "#fffcf6", surface: "#f6efe2", text: "#2b1d14", muted: "#6a5a4d", border: "#ecdfca", buttonText: "auto" },
    typography: { arabicFont: "Almarai", latinFont: "Poppins", baseSize: 16 },
    shape: { radius: "rounded", buttonStyle: "solid", buttonShape: "pill" },
    layout: { density: "comfortable" },
    header: { layout: "logo-center", sticky: true, showSearch: false, announcement: { enabled: true, text: t("اكتب هنا مواعيد التحميص أو التوصيل", "Write roasting or delivery days"), href: "", background: "#6b3e26", color: "#fffcf6" } },
    productCard: { imageRatio: "square", showComparePrice: false, quickOrder: true },
  });
  const home = tree([
    P.heroSplitSection(id, { eyebrow: t("طازة من عندنا", "Fresh from us"), title: t("اكتب هنا عن منتجك: قهوة، عسل، بهارات…", "Your product: coffee, honey, spices…"), text: t("اكتب مصدره وطريقة تحضيره.", "Where it comes from and how it's made."), primary: { label: t("اطلب", "Order"), href: SHOP }, secondary: { label: t("حكايتنا", "Our story"), href: "/about" }, imageAlt: t("صورة المنتج", "Product photo") }, { tone: "surface" }),
    P.productGridSection(id, { title: t("منتجاتنا", "Our products"), limit: 6, columns: 3 }),
    P.imageTextSection(id, { eyebrow: t("من المصدر", "From the source"), title: t("اكتب هنا منين بتجيب منتجاتك", "Where your products come from"), text: t("المزرعة، المنحل، أو طريقة الاختيار.", "The farm, apiary or how you select."), bullets: bullets(t), imageAlt: t("صورة المصدر", "Source photo") }, { tone: "soft" }),
    P.stepsSection(id, { title: t("إزاي تحضّره", "How to prepare"), items: [{ title: t("الخطوة الأولى", "Step one"), text: t("اكتب هنا", "Write here") }, { title: t("الخطوة التانية", "Step two"), text: t("اكتب هنا", "Write here") }, { title: t("استمتع", "Enjoy"), text: t("اكتب نصيحة التقديم", "Serving tip") }] }),
    P.benefitsSection(id, { title: t("وعدنا ليك", "Our promise"), items: [item(t, "leaf", ["طبيعي", "Natural"], ["اكتب المكونات بصدق", "List ingredients honestly"]), item(t, "clock", ["طازة", "Fresh"], ["اكتب تاريخ التعبئة", "Write packing date policy"]), item(t, "box", ["تغليف محكم", "Sealed packing"], ["اكتب طريقة الحفظ", "Write storage method"])] }, { tone: "surface" }),
    P.faqSection(id, { title: t("أسئلة بتتسأل كتير", "Frequently asked questions"), items: faqItems(t) }),
  ]);
  return { settings, pages: { home, ...standardPages("taza", t, { accentTone: "surface", heroTone: "surface" }) } };
}

/** Pet supplies — friendly teal and orange, shop by pet. */
function alifa(locale: RendererLocale) {
  const t: T = (ar, en) => (locale === "ar" ? ar : en);
  const id = createIdFactory("alifa-home");
  const settings = baseSettings(t, {
    preset: "alifa",
    colors: { primary: "#0e7c7b", secondary: "#ff9f43", background: "#ffffff", surface: "#eef7f6", text: "#12302f", muted: "#4e6665", border: "#dbeceb", buttonText: "auto" },
    typography: { arabicFont: "Tajawal", latinFont: "Poppins", baseSize: 16 },
    shape: { radius: "rounded", buttonStyle: "solid", buttonShape: "pill" },
    layout: { density: "comfortable" },
    header: { layout: "logo-start", sticky: true, showSearch: true, announcement: { enabled: true, text: t("اكتب هنا عن توصيل الأكل والرمل", "Write about food & litter delivery"), href: "", background: "#0e7c7b", color: "#ffffff" } },
    productCard: { imageRatio: "square", showComparePrice: true, quickOrder: true },
  });
  const home = tree([
    P.heroSplitSection(id, { eyebrow: t("لأصحاب الحيوانات الأليفة", "For pet parents"), title: t("اكتب هنا عنوان لطيف", "A friendly headline"), text: t("أكل، ألعاب، ومستلزمات لحيوانك.", "Food, toys and supplies for your pet."), primary: { label: t("تسوّق", "Shop"), href: SHOP }, imageAlt: t("قطة أو كلب", "Cat or dog") }, { tone: "soft", decor: true }),
    P.benefitsSection(id, { title: t("تسوّق حسب الحيوان", "Shop by pet"), items: [item(t, "heart", ["قطط", "Cats"], ["أكل ورمل وألعاب", "Food, litter, toys"]), item(t, "star", ["كلاب", "Dogs"], ["أكل وأطواق وألعاب", "Food, leads, toys"]), item(t, "leaf", ["طيور", "Birds"], ["أكل وأقفاص", "Food & cages"]), item(t, "sparkle", ["أسماك", "Fish"], ["أكل وأحواض", "Food & tanks"])] }),
    P.productGridSection(id, { title: t("الأكثر طلبًا", "Top picks"), limit: 8, columns: 4 }, { tone: "surface" }),
    P.imageTextSection(id, { title: t("اكتب هنا نصيحة لرعاية الحيوان", "A pet care tip"), text: t("محتوى مفيد بكلام بسيط.", "Useful content in simple words."), bullets: bullets(t), imageAlt: t("صورة حيوان", "Pet photo") }, {}, { imageEnd: true }),
    P.trustSection(id, { items: trustItems(t) }, { tone: "surface" }),
    P.whatsappSection(id, { title: t("محتاج ترشيح أكل؟", "Need a food recommendation?"), text: t("قولنا نوع وسن حيوانك.", "Tell us your pet's type and age."), buttonLabel: t("واتساب", "WhatsApp") }),
  ]);
  return { settings, pages: { home, ...standardPages("alifa", t, { accentTone: "soft", heroTone: "soft" }) } };
}

function withAnchor(section: TreeSection, anchor: string): TreeSection {
  return { ...section, settings: { ...(section.settings ?? {}), anchor } };
}

export type NicheId = "general" | "single" | "fashion" | "beauty" | "electronics" | "home" | "kids" | "sports" | "food" | "pets";

/** Store categories used to filter themes in the builder (order = display order). */
export const NICHES: Array<{ id: NicheId; label: { ar: string; en: string } }> = [
  { id: "general", label: { ar: "متجر عام", en: "General" } },
  { id: "single", label: { ar: "منتج واحد", en: "Single product" } },
  { id: "fashion", label: { ar: "أزياء وإكسسوارات", en: "Fashion & accessories" } },
  { id: "beauty", label: { ar: "تجميل وعطور", en: "Beauty & perfume" } },
  { id: "electronics", label: { ar: "إلكترونيات وعربيات", en: "Electronics & auto" } },
  { id: "home", label: { ar: "البيت والمطبخ", en: "Home & kitchen" } },
  { id: "kids", label: { ar: "أطفال وألعاب", en: "Kids & toys" } },
  { id: "sports", label: { ar: "رياضة", en: "Sports" } },
  { id: "food", label: { ar: "أكل وقهوة", en: "Food & coffee" } },
  { id: "pets", label: { ar: "حيوانات أليفة", en: "Pets" } },
];

function makeTheme(
  id: ThemeId,
  niche: NicheId,
  name: { ar: string; en: string },
  description: { ar: string; en: string },
  build: (locale: RendererLocale) => { settings: ThemeSettings; pages: ThemePages }
): ThemePreset {
  const ar = build("ar");
  return { id, niche, name, description, settings: ar.settings, pages: ar.pages, build };
}

export const THEMES: Record<ThemeId, ThemePreset> = {
  nile: makeTheme("nile", "general", { ar: "نيل", en: "Nile" }, { ar: "متجر عام نضيف وحديث، مناسب لأي نوع منتجات", en: "Clean, modern general store for any catalogue" }, nile),
  souq: makeTheme("souq", "single", { ar: "سوق", en: "Souq" }, { ar: "صفحة بيع قوية لمنتج واحد بالدفع عند الاستلام", en: "Bold, high-conversion single-product COD store" }, souq),
  luxe: makeTheme("luxe", "fashion", { ar: "لوكس", en: "Luxe" }, { ar: "شكل راقي وهادي للأزياء والبرفانات", en: "Premium, airy look for fashion and perfume" }, luxe),
  bazaar: makeTheme("bazaar", "general", { ar: "بازار", en: "Bazaar" }, { ar: "ألوان مبهجة لمتجر أجهزة ومستلزمات بيت بمنتجات كتير", en: "Colourful multi-product electronics & home store" }, bazaar),
  lamsa: makeTheme("lamsa", "beauty", { ar: "لمسة", en: "Lamsa" }, { ar: "ناعم ومريح لمنتجات التجميل والعناية", en: "Soft, gentle look for beauty and cosmetics" }, lamsa),
  moda: makeTheme("moda", "fashion", { ar: "مودا", en: "Moda" }, { ar: "أزياء بشكل مجلات الموضة: صور كبيرة وجدول مقاسات", en: "Editorial fashion: big imagery and a size guide" }, moda),
  sitara: makeTheme("sitara", "fashion", { ar: "سِتارة", en: "Sitara" }, { ar: "عبايات وطرح ولبس محتشم بشكل هادي وأنيق", en: "Calm, elegant modest wear and abayas" }, sitara),
  dahab: makeTheme("dahab", "fashion", { ar: "دهب", en: "Dahab" }, { ar: "إكسسوارات ومجوهرات مع هدايا ومقاسات الخواتم", en: "Jewellery with gifting and ring sizes" }, dahab),
  glow: makeTheme("glow", "beauty", { ar: "جلو", en: "Glow" }, { ar: "عناية بالبشرة بالروتين والمكونات ونوع البشرة", en: "Skincare led by routine, ingredients and skin type" }, glow),
  oud: makeTheme("oud", "beauty", { ar: "عود", en: "Oud" }, { ar: "عطور وعود بألوان داكنة ودهبي ونوتات عطرية", en: "Dark and gold perfume store with scent notes" }, oud),
  tech: makeTheme("tech", "electronics", { ar: "تِك", en: "Tech" }, { ar: "إلكترونيات وأجهزة بفيديو ومواصفات وضمان", en: "Gadgets with video, specs table and warranty" }, tech),
  turbo: makeTheme("turbo", "electronics", { ar: "تيربو", en: "Turbo" }, { ar: "إكسسوارات عربيات مع التوافق حسب الموديل", en: "Car accessories with fitment by model" }, turbo),
  beit: makeTheme("beit", "home", { ar: "بيت", en: "Beit" }, { ar: "منتجات البيت والمطبخ حسب كل أوضة", en: "Home & kitchen shopped by room" }, beit),
  atfal: makeTheme("atfal", "kids", { ar: "أطفال", en: "Atfal" }, { ar: "ألعاب ومستلزمات أطفال مبهجة حسب السن", en: "Playful kids' store shopped by age" }, atfal),
  fit: makeTheme("fit", "sports", { ar: "فِت", en: "Fit" }, { ar: "لبس وأدوات رياضية بشكل قوي", en: "Bold sportswear and equipment" }, fit),
  taza: makeTheme("taza", "food", { ar: "طازة", en: "Taza" }, { ar: "قهوة وعسل وأكل طبيعي بحكاية المصدر", en: "Coffee, honey and natural food with origin story" }, taza),
  alifa: makeTheme("alifa", "pets", { ar: "أليفة", en: "Alifa" }, { ar: "مستلزمات حيوانات أليفة حسب نوع الحيوان", en: "Pet supplies shopped by pet" }, alifa),
};

export const THEME_LIST: ThemePreset[] = Object.values(THEMES);
