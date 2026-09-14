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

function withAnchor(section: TreeSection, anchor: string): TreeSection {
  return { ...section, settings: { ...(section.settings ?? {}), anchor } };
}

function makeTheme(
  id: ThemeId,
  name: { ar: string; en: string },
  description: { ar: string; en: string },
  build: (locale: RendererLocale) => { settings: ThemeSettings; pages: ThemePages }
): ThemePreset {
  const ar = build("ar");
  return { id, name, description, settings: ar.settings, pages: ar.pages, build };
}

export const THEMES: Record<ThemeId, ThemePreset> = {
  nile: makeTheme("nile", { ar: "نيل", en: "Nile" }, { ar: "متجر عام نضيف وحديث، مناسب لأي نوع منتجات", en: "Clean, modern general store for any catalogue" }, nile),
  souq: makeTheme("souq", { ar: "سوق", en: "Souq" }, { ar: "صفحة بيع قوية لمنتج واحد بالدفع عند الاستلام", en: "Bold, high-conversion single-product COD store" }, souq),
  luxe: makeTheme("luxe", { ar: "لوكس", en: "Luxe" }, { ar: "شكل راقي وهادي للأزياء والبرفانات", en: "Premium, airy look for fashion and perfume" }, luxe),
  bazaar: makeTheme("bazaar", { ar: "بازار", en: "Bazaar" }, { ar: "ألوان مبهجة لمتجر أجهزة ومستلزمات بيت بمنتجات كتير", en: "Colourful multi-product electronics & home store" }, bazaar),
  lamsa: makeTheme("lamsa", { ar: "لمسة", en: "Lamsa" }, { ar: "ناعم ومريح لمنتجات التجميل والعناية", en: "Soft, gentle look for beauty and cosmetics" }, lamsa),
};

export const THEME_LIST: ThemePreset[] = Object.values(THEMES);
