/**
 * SECTION_LIBRARY — the builder palette. Every `create()` returns one valid
 * backend section (checked by validatePageTree in tests), with fresh ids on
 * every call so the same preset can be inserted twice into a page.
 */
import * as P from "./presets";
import type { RendererLocale } from "./strings";
import { createIdFactory, type IdFactory, type TreeSection } from "./tree";

export type SectionGroup = "announcement" | "hero" | "products" | "content" | "trust" | "media" | "contact" | "layout";

export interface L10n {
  ar: string;
  en: string;
}

export interface SectionPreset {
  id: string;
  group: SectionGroup;
  label: L10n;
  /** What the thumbnail should depict — the builder draws it. */
  thumbnail: L10n;
  create: (opts?: { locale?: RendererLocale; id?: IdFactory }) => TreeSection;
}

export const SECTION_GROUPS: Array<{ id: SectionGroup; label: L10n }> = [
  { id: "announcement", label: { ar: "إعلانات", en: "Announcements" } },
  { id: "hero", label: { ar: "واجهة المتجر", en: "Hero" } },
  { id: "products", label: { ar: "المنتجات", en: "Products" } },
  { id: "content", label: { ar: "محتوى", en: "Content" } },
  { id: "trust", label: { ar: "الثقة والطمأنينة", en: "Trust" } },
  { id: "media", label: { ar: "صور وفيديو", en: "Media" } },
  { id: "contact", label: { ar: "التواصل", en: "Contact" } },
  { id: "layout", label: { ar: "تنسيق", en: "Layout" } },
];

const L = (ar: string, en: string): L10n => ({ ar, en });

function preset(
  id: string,
  group: SectionGroup,
  label: L10n,
  thumbnail: L10n,
  build: (id: IdFactory, tr: (x: L10n) => string) => TreeSection
): SectionPreset {
  return {
    id,
    group,
    label,
    thumbnail,
    create: (opts = {}) => {
      const locale = opts.locale ?? "ar";
      // Readable but unique per call: "benefits-k3x9q-heading-4".
      return build(opts.id ?? createIdFactory(`${id}-${Math.random().toString(36).slice(2, 7)}`), (x) => x[locale]);
    },
  };
}

const SHOP_ALL = "/?search=1#products";

export const SECTION_LIBRARY: SectionPreset[] = [
  preset("marquee-strip", "trust", L("شريط مميزات متحرك", "Moving features strip"), L("شريط بيتحرك فيه مميزات متجرك", "A scrolling strip of your selling points"), (id, t) =>
    P.marqueeSection(id, {
      items: [
        t(L("الدفع عند الاستلام", "Cash on delivery")),
        t(L("توصيل لكل المحافظات", "Delivery nationwide")),
        t(L("استبدال سهل", "Easy exchange")),
        t(L("اكتب ميزة هنا", "Write a benefit here")),
      ],
    })
  ),
  preset("comparison", "trust", L("مقارنة: إحنا وغيرنا", "Us vs others"), L("جدول بعلامات صح وغلط يوضح ميزتك", "A ✓ / ✗ table showing why you're the better choice"), (id, t) =>
    P.comparisonSection(id, {
      eyebrow: t(L("ليه تختارنا؟", "Why choose us?")),
      title: t(L("الفرق واضح", "See the difference")),
      text: t(L("اكتب مقارنة حقيقية وعادلة. ✓ و ✗ بيتحولوا لعلامات ملونة.", "Keep it real and fair. ✓ and ✗ turn into coloured marks.")),
      table: t(
        L(
          "الميزة | إحنا | غيرنا\nالدفع عند الاستلام | ✓ | ✗\nاكتب ميزة | ✓ | ✗\nاكتب ميزة | ✓ | ✗\nاكتب ميزة | ✓ | ✓",
          "Feature | Us | Others\nCash on delivery | ✓ | ✗\nWrite a feature | ✓ | ✗\nWrite a feature | ✓ | ✗\nWrite a feature | ✓ | ✓"
        )
      ),
    })
  ),
  preset("bundles", "products", L("عروض الكميات", "Bundle offers"), L("كروت لعروض قطعة وقطعتين و3 قطع", "Cards for 1, 2 and 3-piece offers"), (id, t) =>
    P.bundleSection(id, {
      eyebrow: t(L("وفّر أكتر", "Get more")),
      title: t(L("اختار العرض المناسب", "Choose your offer")),
      text: t(L("اكتب أسعار العروض الحقيقية بتاعتك في كل كارت.", "Write your real offer prices in each card.")),
      tiers: [
        { name: t(L("قطعة واحدة", "One piece")), text: t(L("اكتب هنا سعر القطعة", "Write the single price")), cta: { label: t(L("اختار", "Choose")), href: "#order" } },
        { name: t(L("قطعتين", "Two pieces")), text: t(L("اكتب هنا سعر العرض الحقيقي", "Write the real offer price")), badge: t(L("العرض المقترح", "Suggested")), cta: { label: t(L("اختار العرض", "Choose offer")), href: "#order" } },
        { name: t(L("3 قطع", "Three pieces")), text: t(L("اكتب هنا سعر العرض الحقيقي", "Write the real offer price")), cta: { label: t(L("اختار", "Choose")), href: "#order" } },
      ],
    })
  ),
  preset("before-after", "media", L("صور قبل وبعد", "Before & after"), L("صورتين فوق بعض بخط بيتسحب", "Two photos with a draggable divider"), (id, t) =>
    P.beforeAfterSection(id, {
      title: t(L("شوف الفرق بنفسك", "See the difference yourself")),
      text: t(L("ارفع صور حقيقية بإذن أصحابها: الأولى قبل، والتانية بعد.", "Upload real photos with permission: first is before, second is after.")),
      beforeLabel: t(L("قبل", "Before")),
      afterLabel: t(L("بعد", "After")),
    })
  ),
  preset("announcement-bar", "announcement", L("شريط إعلان", "Announcement bar"), L("شريط رفيع ملوّن بجملة قصيرة ولينك", "Thin coloured strip with one line and a link"), (id, t) =>
    P.announcementSection(id, { text: t(L("اكتب هنا جملة قصيرة عن عرضك أو التوصيل", "Write a short line about your offer or delivery")), link: { label: t(L("اعرف أكتر", "Learn more")), href: SHOP_ALL } })
  ),

  preset("hero-image", "hero", L("واجهة بصورة خلفية", "Hero with background image"), L("صورة كبيرة بعرض الشاشة وعليها عنوان وزرارين", "Full-width image with headline and two buttons"), (id, t) =>
    P.heroImageSection(id, {
      eyebrow: t(L("جديد عندنا", "New in store")),
      title: t(L("اكتب هنا عنوان يشد العميل", "Write a headline that grabs attention")),
      text: t(L("اكتب هنا جملة أو اتنين عن متجرك وليه الناس هتحب تشتري منك.", "Write a sentence or two about your store and why people will love buying from you.")),
      primary: { label: t(L("تسوّق دلوقتي", "Shop now")), href: SHOP_ALL },
      secondary: { label: t(L("تتبّع طلبك", "Track your order")), href: "/track" },
    })
  ),

  preset("hero-split", "hero", L("واجهة صورة ونص", "Split hero"), L("نص على جنب وصورة المنتج على الجنب التاني", "Text on one side, product image on the other"), (id, t) =>
    P.heroSplitSection(id, {
      eyebrow: t(L("الدفع عند الاستلام", "Cash on delivery")),
      title: t(L("اكتب هنا اسم منتجك أو أهم ميزة فيه", "Write your product name or its best feature")),
      text: t(L("اكتب هنا وصف قصير وواضح: المنتج بيعمل إيه ويفيد العميل إزاي.", "Write a short, clear description: what it does and how it helps.")),
      primary: { label: t(L("اطلب الآن", "Order now")), href: SHOP_ALL },
      imageAlt: t(L("صورة المنتج", "Product image")),
    })
  ),

  preset("hero-centered", "hero", L("واجهة بسيطة في النص", "Centered minimal hero"), L("عنوان كبير في نص الصفحة وزرار واحد", "Big centred headline and one button"), (id, t) =>
    P.heroCenteredSection(id, {
      eyebrow: t(L("أهلًا بيك", "Welcome")),
      title: t(L("اكتب هنا رسالة متجرك في جملة واحدة", "Say what your store is about in one line")),
      text: t(L("اكتب هنا تفاصيل بسيطة تطمّن العميل وتشجعه يكمّل.", "Add a few details that reassure shoppers and invite them in.")),
      primary: { label: t(L("شوف المنتجات", "Browse products")), href: SHOP_ALL },
    })
  ),

  preset("hero-poster", "hero", L("واجهة بفيديو", "Video poster hero"), L("عنوان فوق مساحة فيديو كبيرة بخلفية داكنة", "Headline above a large video area on a dark background"), (id, t) =>
    P.heroPosterSection(id, {
      title: t(L("اكتب هنا عنوان الفيديو", "Write the video headline")),
      text: t(L("حط رابط فيديو يوتيوب يوضح المنتج وهو شغال.", "Add a YouTube link showing the product in action.")),
      primary: { label: t(L("اطلب الآن", "Order now")), href: SHOP_ALL },
      imageAlt: t(L("فيديو المنتج", "Product video")),
    })
  ),

  preset("featured-product", "products", L("منتج مميز مع فورم الطلب", "Featured product with order form"), L("صور المنتج والسعر وفورم الدفع عند الاستلام في بلوك واحد", "Product gallery, price and the COD order form in one block"), (id, t) =>
    P.featuredProductSection(id, { eyebrow: t(L("اطلب في دقيقة", "Order in a minute")), title: t(L("اكتب هنا اسم المنتج", "Write the product name")), text: t(L("املأ بياناتك وهنكلمك نأكد الطلب قبل الشحن.", "Fill in your details and we'll call to confirm before shipping.")) })
  ),

  preset("product-grid", "products", L("شبكة منتجات", "Product grid"), L("كروت المنتجات في صفوف", "Product cards in rows"), (id, t) =>
    P.productGridSection(id, { title: t(L("منتجاتنا", "Our products")), text: t(L("اكتب هنا جملة قصيرة عن المنتجات دي", "Write a short line about these products")), link: { label: t(L("شوف كل المنتجات", "View all products")), href: SHOP_ALL } })
  ),

  preset("collection-list", "products", L("الأقسام", "Collections"), L("كروت الأقسام علشان العميل يختار", "Collection cards to browse by category"), (id, t) =>
    P.collectionListSection(id, { title: t(L("تسوّق حسب القسم", "Shop by collection")), text: t(L("اختار القسم اللي يهمك", "Pick the category you're after")) })
  ),

  preset("image-text", "content", L("صورة ونص", "Image with text"), L("صورة على اليمين ونص ونقاط على الشمال", "Image first, then text with bullet points"), (id, t) =>
    P.imageTextSection(id, {
      eyebrow: t(L("عن المنتج", "About the product")),
      title: t(L("اكتب هنا عن منتجك", "Write about your product")),
      text: t(L("اكتب هنا القصة ورا المنتج، مصنوع من إيه، وليه هيفرق مع العميل.", "Tell the story behind it, what it's made of, and why it makes a difference.")),
      bullets: [t(L("اكتب ميزة أولى", "First benefit")), t(L("اكتب ميزة تانية", "Second benefit")), t(L("اكتب ميزة تالتة", "Third benefit"))],
      cta: { label: t(L("اطلب الآن", "Order now")), href: SHOP_ALL },
    })
  ),

  preset("text-image", "content", L("نص وصورة (معكوس)", "Text with image (reversed)"), L("النص الأول والصورة في الناحية التانية", "Text first, image on the opposite side"), (id, t) =>
    P.imageTextSection(
      id,
      {
        title: t(L("اكتب هنا ليه تختارنا", "Write why customers choose you")),
        text: t(L("اكتب هنا اللي بيميز متجرك: الخامة، التغليف، خدمة العملاء.", "What sets you apart: quality, packaging, customer care.")),
        bullets: [t(L("اكتب سبب أول", "First reason")), t(L("اكتب سبب تاني", "Second reason"))],
      },
      {},
      { imageEnd: true }
    )
  ),

  preset("benefits", "trust", L("مميزات بأيقونات", "Benefits with icons"), L("4 كروت صغيرة بأيقونة وعنوان وسطر", "Four small cards with icon, title and a line"), (id, t) =>
    P.benefitsSection(id, {
      title: t(L("ليه تشتري مننا؟", "Why shop with us?")),
      items: [
        { icon: "sparkle", title: t(L("اكتب ميزة", "A benefit")), text: t(L("اشرحها في سطر واحد", "Explain it in one line")) },
        { icon: "shield", title: t(L("اكتب ميزة", "A benefit")), text: t(L("اشرحها في سطر واحد", "Explain it in one line")) },
        { icon: "gift", title: t(L("اكتب ميزة", "A benefit")), text: t(L("اشرحها في سطر واحد", "Explain it in one line")) },
        { icon: "heart", title: t(L("اكتب ميزة", "A benefit")), text: t(L("اشرحها في سطر واحد", "Explain it in one line")) },
      ],
    })
  ),

  preset("how-it-works", "content", L("خطوات الطلب", "How it works"), L("3 خطوات مترقّمة", "Three numbered steps"), (id, t) =>
    P.stepsSection(id, {
      title: t(L("اطلب في 3 خطوات", "Order in 3 steps")),
      items: [
        { title: t(L("اختار المنتج", "Pick your product")), text: t(L("اختار اللون أو المقاس اللي يناسبك", "Choose the colour or size that suits you")) },
        { title: t(L("اكتب بياناتك", "Enter your details")), text: t(L("الاسم والموبايل والعنوان بس", "Just name, phone and address")) },
        { title: t(L("استلم وادفع", "Receive and pay")), text: t(L("بتدفع للمندوب لما الطلب يوصلك", "Pay the courier when it arrives")) },
      ],
    })
  ),

  preset("trust-badges", "trust", L("شارات الثقة", "Trust badges"), L("الدفع عند الاستلام، التوصيل، الاسترجاع", "Cash on delivery, delivery, returns"), (id, t) =>
    P.trustSection(id, {
      items: [
        { icon: "cash", title: t(L("الدفع عند الاستلام", "Cash on delivery")), text: t(L("ادفع لما طلبك يوصل", "Pay when your order arrives")) },
        { icon: "truck", title: t(L("توصيل لكل المحافظات", "Delivery nationwide")), text: t(L("اكتب مدة التوصيل عندك", "Write your delivery time")) },
        { icon: "return", title: t(L("استرجاع سهل", "Easy returns")), text: t(L("اكتب سياسة الاسترجاع بتاعتك", "Write your returns policy")) },
      ],
    })
  ),

  preset("faq", "content", L("الأسئلة الشائعة", "FAQ"), L("أسئلة وأجوبة بتتفتح وتتقفل", "Expandable questions and answers"), (id, t) =>
    P.faqSection(id, {
      title: t(L("أسئلة بتتسأل كتير", "Frequently asked questions")),
      items: [
        { q: t(L("الدفع إزاي؟", "How do I pay?")), a: t(L("الدفع كاش عند الاستلام، مش محتاج تدفع أونلاين.", "Cash on delivery — nothing to pay online.")) },
        { q: t(L("التوصيل بياخد قد إيه؟", "How long is delivery?")), a: t(L("اكتب هنا مدة التوصيل الحقيقية عندك.", "Write your real delivery time here.")) },
        { q: t(L("ينفع أرجّع المنتج؟", "Can I return it?")), a: t(L("اكتب هنا سياسة الاسترجاع والاستبدال.", "Write your returns and exchange policy here.")) },
      ],
    })
  ),

  preset("rich-text", "content", L("نص طويل", "Rich text"), L("عنوان وفقرة طويلة للقصة أو السياسات", "Heading and long text for stories or policies"), (id, t) =>
    P.richTextSection(id, { title: t(L("اكتب هنا العنوان", "Write the heading")), text: t(L("اكتب هنا الكلام اللي عايز تقوله بالتفصيل. تقدر تسيب سطر فاضي بين الفقرات.", "Write your text in detail. Leave an empty line between paragraphs.")) })
  ),

  preset("cta-band", "content", L("شريط دعوة للشراء", "Call-to-action band"), L("خلفية ملوّنة بعنوان وزرار كبير", "Coloured band with headline and big button"), (id, t) =>
    P.ctaSection(id, { title: t(L("جاهز تطلب؟", "Ready to order?")), text: t(L("اطلب دلوقتي وادفع لما الطلب يوصلك.", "Order now and pay when it arrives.")), primary: { label: t(L("اطلب الآن", "Order now")), href: SHOP_ALL } })
  ),

  preset("gallery", "media", L("معرض صور", "Gallery"), L("شبكة صور مربعة", "Grid of square images"), (id, t) =>
    P.gallerySection(id, { title: t(L("صور من منتجاتنا", "From our collection")), text: t(L("ارفع صور حقيقية لمنتجاتك", "Upload real photos of your products")) })
  ),

  preset("video", "media", L("فيديو", "Video"), L("عنوان وفيديو بعرض الصفحة", "Heading and a full-width video"), (id, t) =>
    P.videoSection(id, { title: t(L("شوف المنتج على الطبيعة", "See it in action")), text: t(L("حط رابط الفيديو من يوتيوب", "Paste a YouTube link")) })
  ),

  preset("countdown", "trust", L("عداد العرض", "Offer countdown"), L("عداد تنازلي بيظهر بس لما تحدد نهاية حقيقية", "Countdown shown only once you set a real end date"), (id, t) =>
    P.countdownSection(id, { title: t(L("اكتب هنا اسم العرض", "Write the offer name")), text: t(L("اكتب تفاصيل العرض الحقيقية", "Describe the real offer")), label: t(L("العرض ينتهي خلال", "Offer ends in")), cta: { label: t(L("اطلب الآن", "Order now")), href: SHOP_ALL } })
  ),

  preset("whatsapp-contact", "contact", L("تواصل واتساب", "WhatsApp contact"), L("كارت بأيقونة واتساب وزرار كلمنا", "Card with WhatsApp icon and a chat button"), (id, t) =>
    P.whatsappSection(id, { title: t(L("عندك سؤال؟ كلمنا واتساب", "Questions? Chat with us")), text: t(L("حط رقم الواتساب بتاعك في الزرار علشان يظهر للعملاء.", "Add your WhatsApp number to the button so shoppers can reach you.")), buttonLabel: t(L("كلمنا واتساب", "Chat on WhatsApp")) })
  ),

  preset("logo-strip", "trust", L("شريط شعارات", "Logo strip"), L("صف شعارات (شركات الشحن أو البراندات اللي بتبيعها)", "Row of logos (couriers or brands you carry)"), (id, t) =>
    P.logoStripSection(id, { title: t(L("اكتب هنا عنوان للشعارات", "Write a title for the logos")) })
  ),

  preset("testimonials", "trust", L("آراء العملاء", "Testimonials"), L("كروت لآراء عملاء حقيقية — مش بتظهر وهي فاضية", "Cards for real customer quotes — hidden while empty"), (id, t) =>
    P.testimonialsSection(id, { title: t(L("آراء عملائنا", "What customers say")) })
  ),

  preset("size-guide", "content", L("جدول المقاسات", "Size guide"), L("جدول مقاسات بسيط", "Simple size table"), (id, t) =>
    P.sizeGuideSection(id, {
      title: t(L("دليل المقاسات", "Size guide")),
      text: t(L("عدّل الجدول بمقاساتك الحقيقية. كل سطر صف، والعلامة | بتفصل الأعمدة.", "Edit with your real sizes. One line per row, | separates columns.")),
      table: t(L("المقاس | الصدر | الطول\nS | اكتب هنا | اكتب هنا\nM | اكتب هنا | اكتب هنا\nL | اكتب هنا | اكتب هنا", "Size | Chest | Length\nS | — | —\nM | — | —\nL | — | —")),
    })
  ),

  preset("contact-info", "contact", L("بيانات التواصل", "Contact info"), L("كروت للتليفون والواتساب والإيميل ومواعيد العمل", "Cards for phone, WhatsApp, email and hours"), (id, t) =>
    P.contactInfoSection(id, {
      title: t(L("تواصل معانا", "Get in touch")),
      items: [
        { icon: "phone", title: t(L("التليفون", "Phone")), text: t(L("اكتب رقمك هنا", "Write your number")) },
        { icon: "whatsapp", title: t(L("واتساب", "WhatsApp")), text: t(L("اكتب رقم الواتساب", "Write your WhatsApp number")) },
        { icon: "mail", title: t(L("الإيميل", "Email")), text: t(L("اكتب الإيميل", "Write your email")) },
        { icon: "clock", title: t(L("مواعيد العمل", "Working hours")), text: t(L("اكتب المواعيد", "Write your hours")) },
      ],
    })
  ),

  preset("map-address", "contact", L("العنوان والخريطة", "Map & address"), L("عنوانك مع زرار يفتح الخريطة", "Your address with an open-in-maps button"), (id, t) =>
    P.mapSection(id, { title: t(L("مكاننا", "Find us")), text: t(L("اكتب هنا تفاصيل توصف المكان", "Describe how to find you")), address: t(L("اكتب العنوان بالتفصيل", "Write your full address")) })
  ),

  preset("spacer", "layout", L("مسافة فاضية", "Spacer"), L("مسافة بين الأقسام", "Vertical space between sections"), (id) => P.spacerSection(id, 48)),

  preset("divider", "layout", L("خط فاصل", "Divider"), L("خط رفيع بين الأقسام", "Thin line between sections"), (id) => P.dividerSection(id)),
];

export const SECTION_BY_ID: Record<string, SectionPreset> = Object.fromEntries(SECTION_LIBRARY.map((s) => [s.id, s]));
