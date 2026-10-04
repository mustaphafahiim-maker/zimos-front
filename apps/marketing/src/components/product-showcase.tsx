import { SectionHeading } from "./section-heading";

/**
 * The product itself: three real screens of the merchant dashboard, each
 * beside what it does for the merchant. The pictures are captures of the
 * dashboard with its demo store (public/product), one set per language.
 */

type Locale = "ar" | "en";

const COPY = {
  ar: {
    kicker: "المنتج من الداخل",
    heading: "داشبورد واحدة تشغّل بها متجرك كله",
    intro: "هذه شاشات حقيقية من ZIMOS، وليست رسومات. ما تراه هنا هو ما ستفتحه أول يوم.",
    alt: "لقطة من داشبورد ZIMOS",
    rows: [
      {
        image: "home",
        kicker: "الرئيسية",
        heading: "يومك كله في شاشة واحدة",
        body: "تفتح الداشبورد فتجد ما تحتاجه الآن: اختصارات لأكثر ما تفعله، ومبيعاتك وطلباتك، وزوار متجرك لحظة بلحظة.",
        points: ["اختصارات لطلب جديد، إضافة منتج وتأكيد الطلبات", "المبيعات وصافي الربح ونسبة التسليم مقارنةً بالفترة السابقة", "تحليلات الموقع: الزوار، أكثر الصفحات زيارة ومصادر الزيارات"],
      },
      {
        image: "orders",
        kicker: "الطلبات",
        heading: "الطلب من لحظة وصوله حتى باب العميل",
        body: "كل طلب في مكانه حسب حالته: جديد، في انتظار التأكيد، جاهز للشحن، خرج للتوصيل، تم التسليم أو مرتجع.",
        points: ["بحث برقم الطلب أو اسم العميل أو هاتفه", "تصفية حسب الحالة ودرجة الخطورة", "إنشاء طلب يدوي، تصدير، وكشف تسليم اليوم بضغطة"],
      },
      {
        image: "affiliates",
        kicker: "المسوّقون بالعمولة",
        heading: "مسوّقون يبيعون لك، والعمولة تُحسب وحدها",
        body: "أضف المسوّق، أرسل له رابطه على واتساب، وكل طلب مُسلَّم جاء من رابطه يُسجَّل باسمه. تدفع له ثم تسجّل الدفع.",
        points: ["رابط خاص لكل مسوّق وبوابة يتابع منها طلباته ورصيده", "العمولة تُستحق عند التسليم وتُلغى إذا رجع الطلب", "سجل بالمدفوعات وطريقة كل دفعة"],
      },
    ],
  },
  en: {
    kicker: "Inside the product",
    heading: "One dashboard to run the whole store",
    intro: "These are real ZIMOS screens, not illustrations. What you see here is what you open on day one.",
    alt: "A screen of the ZIMOS dashboard",
    rows: [
      {
        image: "home",
        kicker: "Home",
        heading: "Your whole day on one screen",
        body: "Open the dashboard and what you need is there: shortcuts to what you do most, your sales and orders, and your store's visitors as they arrive.",
        points: ["Shortcuts to a new order, a new product and orders to confirm", "Sales, net profit and delivery rate against the period before", "Website analytics: visitors, most visited pages and where they come from"],
      },
      {
        image: "orders",
        kicker: "Orders",
        heading: "The order, from arrival to the customer's door",
        body: "Every order sits where its status puts it: new, awaiting confirmation, ready to ship, out for delivery, delivered or returned.",
        points: ["Search by order number, customer name or phone", "Filter by status and by risk", "Manual orders, export and today's delivery sheet in one click"],
      },
      {
        image: "affiliates",
        kicker: "Affiliates",
        heading: "Marketers sell for you; the commission works itself out",
        body: "Add a marketer, send their link on WhatsApp, and every delivered order that came through it is recorded in their name. Pay them, then record it.",
        points: ["A link per marketer and a portal where they follow their orders and balance", "Commission is earned on delivery and cancelled if the order comes back", "A record of payments and how each one was paid"],
      },
    ],
  },
} as const;

export function ProductShowcase({ locale }: { locale: string }) {
  const lang: Locale = locale === "ar" ? "ar" : "en";
  const copy = COPY[lang];

  return (
    <section aria-labelledby="showcase-heading" className="showcase relative overflow-hidden py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <span className="showcase-glow" data-n="1" />
        <span className="showcase-glow" data-n="2" />
      </div>
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="showcase-heading" kicker={copy.kicker} heading={copy.heading} intro={copy.intro} />

        <div className="mt-14 space-y-20 sm:space-y-28">
          {copy.rows.map((row, index) => (
            <div key={row.image} className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
              <div className={index % 2 === 1 ? "lg:order-2 lg:col-span-5" : "lg:col-span-5"}>
                <p className="text-sm font-semibold text-primary">{row.kicker}</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{row.heading}</h3>
                <p className="mt-4 text-base leading-relaxed text-ink-soft">{row.body}</p>
                <ul className="mt-6 space-y-3">
                  {row.points.map((point) => (
                    <li key={point} className="flex items-start gap-3 text-sm leading-relaxed text-ink">
                      <span className="showcase-tick mt-1" aria-hidden />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lg:col-span-7">
                <div className="showcase-frame">
                  <div className="showcase-chrome" aria-hidden>
                    <i />
                    <i />
                    <i />
                  </div>
                  {/* A plain img: the captures are already sized and compressed for the page. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/product/${row.image}-${lang}.jpg`} alt={`${copy.alt}: ${row.kicker}`} width={1440} height={900} loading="lazy" decoding="async" className="block h-auto w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
