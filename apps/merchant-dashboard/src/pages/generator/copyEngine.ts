import type { Brief, Category, PageLang, QA, SectionKey, Seeds, StyleOptions, Tone } from "./types";

/**
 * Deterministic copy engine — NOT an AI model.
 *
 * Every line on a generated page comes from the hand-written template library
 * below. A template is picked by (page language, tone, section seed) among the
 * variants whose placeholders the merchant actually filled in, then the
 * merchant's own inputs are interpolated. Same inputs + same seeds = same page.
 *
 * Writing rules followed by the library: no superlatives ("best in the
 * world"), no medical/financial claims, no invented numbers, no fake scarcity.
 * Urgency only ever references the real price, real delivery time, or a
 * countdown end date the merchant typed.
 *
 * Arabic is one library shared by the Egyptian-friendly and Gulf variants;
 * dialect-sensitive words go through `{lexicon}` tokens so each audience gets
 * natural phrasing ("لحد باب بيتك" vs "إلى باب بيتك", "دلوقتي" vs "الحين").
 */

type Pool = Record<Tone, string[]>;

export interface Step {
  title: string;
  text: string;
}

interface StepTpl {
  title: string;
  /** Alternatives, first one whose placeholders are all filled wins. */
  text: string[];
}

interface TrustTpl {
  delivery: { title: string; text: string };
  returns: { title: string; text: string };
  cod: { title: string; text: string };
}

interface Library {
  headline: Pool;
  sub: Pool;
  heroCta: Pool;
  priceWithCompare: string[];
  priceOnly: string[];
  benefitsTitle: Pool;
  benefitsIntro: Pool;
  howTitle: Pool;
  steps: StepTpl[][];
  step1ByCategory: Record<Category, string>;
  boxTitle: Pool;
  proofTitle: Pool;
  guaranteeTitle: Pool;
  trust: TrustTpl[];
  faqTitle: Pool;
  faqCod: QA[];
  faqDelivery: QA[];
  faqReturns: QA[];
  faqConfirm: QA[];
  faqCategory: Record<Category, QA[]>;
  ctaTitle: Pool;
  ctaBody: Pool;
  ctaButton: Pool;
  stickyText: Pool;
  stickyButton: Pool;
  countdownLabel: string[];
}

// ---------------------------------------------------------------------------
// Dialect lexicon
// ---------------------------------------------------------------------------

const LEX: Record<PageLang, Record<string, string>> = {
  "ar-eg": {
    door: "لحد باب بيتك",
    noPrepay: "من غير أي دفع مقدّم",
    inspect: "تستلم وتعاين الطلب الأول",
    pay: "وبعدها تدفع",
    orderNow: "اطلب دلوقتي",
    now: "دلوقتي",
    reach: "هيوصلك",
    call: "هنتصل بيك نأكد الطلب",
    why: "ليه",
    love: "هتحبه",
    how: "إزاي",
    forYou: "معمول علشانك",
    get: "هتستلم إيه بالظبط؟",
    phone: "موبايلك",
  },
  "ar-gulf": {
    door: "إلى باب بيتك",
    noPrepay: "بدون أي دفع مقدّم",
    inspect: "تستلم وتشيّك الطلب أول",
    pay: "وبعدها تدفع",
    orderNow: "اطلبه الحين",
    now: "الحين",
    reach: "يوصلك",
    call: "نتواصل معك نأكد الطلب",
    why: "ليش",
    love: "بيعجبك",
    how: "كيف",
    forYou: "مسوّى لك",
    get: "وش بيوصلك بالضبط؟",
    phone: "جوالك",
  },
  en: {
    door: "to your door",
    noPrepay: "no upfront payment",
    inspect: "you check it when it arrives",
    pay: "then pay in cash",
    orderNow: "Order now",
    now: "today",
    reach: "it arrives",
    call: "we call you to confirm",
    why: "Why",
    love: "you'll like it",
    how: "How",
    forYou: "is made for you",
    get: "What exactly do you get?",
    phone: "phone number",
  },
};

const all = (items: string[]): Pool => ({ confident: items, friendly: items, premium: items, urgent: items });

// ---------------------------------------------------------------------------
// Arabic library (4 variants per section per tone)
// ---------------------------------------------------------------------------

const AR: Library = {
  headline: {
    confident: [
      "{name}.. الحل العملي {forProblem}",
      "{name}: {b1} و{b2} في منتج واحد",
      "{name} {forAudience} — بدون تعقيد",
      "{name} يؤدي مهمته كما ينبغي",
    ],
    friendly: [
      "{audience}؟ {name} {forYou}",
      "تعرّف على {name}: {b1} و{b2}",
      "مع {name}، ودّع {problem}",
      "{name}.. خطوة بسيطة تفرق في يومك",
    ],
    premium: [
      "{name}: {b1} بمستوى تلاحظه",
      "لمن يهتم بالتفاصيل: {name}",
      "{name}.. اختيار مدروس {forAudience}",
      "{name}. تفاصيل مدروسة وتجربة تستحقها",
    ],
    urgent: [
      "{name} متاح الآن بسعر {price}",
      "لا تؤجّل التعامل مع {problem} — جرّب {name}",
      "{name} جاهز للتوصيل {door}",
      "{name}: اطلب اليوم وادفع عند الاستلام",
    ],
  },
  sub: {
    confident: [
      "صمّمنا {name} {forAudience}، ليمنحك {b1} و{b2}. {inspect} {pay}.",
      "{b1}، و{b2}، و{b3} — كل ذلك في {name}.",
      "إذا كنت تواجه {problem}، فـ{name} يقدّم لك حلًا واضحًا وسهل الاستخدام.",
      "اطلب {name} {noPrepay}: {inspect} {pay}.",
    ],
    friendly: [
      "{name} يساعدك في {b1}، ومعه {b2}. جرّبه براحتك: {inspect} {pay}.",
      "اخترناه {forAudience} ليكون سهلًا ومريحًا في الاستخدام اليومي.",
      "اطلبه {noPrepay}، و{reach} {door} خلال {delivery}.",
      "طلبك بسيط: {inspect} {pay}.",
    ],
    premium: [
      "{name} يجمع بين {b1} و{b2} في تصميم متقن {forAudience}.",
      "تفاصيل مدروسة وتجربة شراء هادئة: توصيل {door} خلال {delivery}، والدفع عند الاستلام.",
      "لأن التعامل مع {problem} يستحق حلًا مدروسًا، اخترنا لك {name}.",
      "{name} — تجربة شراء مطمئنة: {inspect} {pay}.",
    ],
    urgent: [
      "السعر الحالي {price}. اطلب {now}، و{reach} {door} خلال {delivery}.",
      "لا تنتظر أكثر مع {problem}: {name} يقدّم لك {b1} — {noPrepay}.",
      "{b1} و{b2} بسعر {price}، والدفع عند الاستلام.",
      "خطوات الطلب بسيطة: اكتب بياناتك، {call}، {inspect} {pay}.",
    ],
  },
  heroCta: {
    confident: ["{orderNow}", "اطلب {name}", "اطلب والدفع عند الاستلام", "ابدأ طلبك"],
    friendly: ["{orderNow}", "اطلبه وجرّبه", "ابدأ طلبك", "اطلب والدفع عند الاستلام"],
    premium: ["اطلب {name}", "أكمل طلبك", "اطلب الآن", "احجز طلبك"],
    urgent: ["{orderNow}", "اطلب اليوم", "ثبّت طلبك الآن", "اطلب بسعر {price}"],
  },
  priceWithCompare: [
    "السعر: {price} بدلًا من {compare}",
    "{price} بدلًا من {compare} — توفّر {save}",
    "الآن بـ{price} (كان {compare})",
    "بـ{price} فقط بدلًا من {compare}",
  ],
  priceOnly: [
    "السعر: {price} — والدفع عند الاستلام",
    "بـ{price}، تدفعها عند الاستلام",
    "{price} — ادفع عند الاستلام",
    "السعر {price}، {noPrepay}",
  ],
  benefitsTitle: {
    confident: ["{why} {name}؟", "ماذا يقدّم لك {name}؟", "المميزات باختصار", "ما الذي يميّز {name}؟"],
    friendly: ["{why} {love}؟", "مميزات تفرق فعلًا", "باختصار، هذا ما ستحصل عليه", "تفاصيل صغيرة تصنع فرقًا"],
    premium: ["تفاصيل صُنعت بعناية", "ما يجعل {name} مختلفًا", "الجودة في التفاصيل", "صُمّم {forAudience}"],
    urgent: ["لماذا تطلبه اليوم؟", "ما ستحصل عليه فور الاستلام", "{name} باختصار", "مميزات تستحق الطلب الآن"],
  },
  benefitsIntro: {
    confident: [
      "صمّمناه ليتعامل مع {problem} بشكل مباشر:",
      "كل ميزة هنا لها سبب:",
      "هذا ما تحصل عليه مع {name}:",
      "بدون مبالغة، هذه أهم المميزات:",
    ],
    friendly: [
      "إذا كنت من {audience}، فهذا ما يهمّك:",
      "جمعنا لك أهم ما يهمّك:",
      "ببساطة:",
      "هذا ما يجعل {name} خيارًا مريحًا:",
    ],
    premium: [
      "صُمّم {forAudience}، وهذه أبرز مزاياه:",
      "تفاصيل مدروسة تلاحظها مع الاستخدام:",
      "ما يميّزه عن البدائل المعتادة:",
      "في كل تفصيلة سبب:",
    ],
    urgent: [
      "إذا كنت تواجه {problem}، فهذا ما سيتغيّر:",
      "باختصار وبدون إطالة:",
      "أهم ما تحتاج معرفته قبل الطلب:",
      "لهذا يستحق أن تطلبه الآن:",
    ],
  },
  howTitle: {
    confident: ["طريقة الطلب", "3 خطوات فقط", "كيف تطلب؟", "من الطلب إلى الاستلام"],
    friendly: ["الطلب سهل جدًا", "{how} تطلب؟", "3 خطوات وطلبك عندك", "طلبك {reach} {door}"],
    premium: ["تجربة شراء بسيطة", "كيف يصلك طلبك", "خطوات الطلب", "من الطلب حتى الاستلام"],
    urgent: ["اطلب في 3 خطوات", "الطلب يأخذ دقائق", "ابدأ الآن في 3 خطوات", "كيف تطلب اليوم"],
  },
  steps: [
    [
      { title: "اطلب", text: ["اكتب اسمك ورقم {phone} وعنوانك في نموذج الطلب."] },
      { title: "نأكد طلبك", text: ["{call} قبل الشحن."] },
      { title: "استلم وادفع", text: ["{reach} {door} خلال {delivery}، {inspect} {pay}.", "{reach} {door}، {inspect} {pay}."] },
    ],
    [
      { title: "املأ النموذج", text: ["بياناتك الأساسية فقط: الاسم، الرقم، والعنوان."] },
      { title: "مكالمة تأكيد", text: ["{call}، ونراجع معك التفاصيل."] },
      { title: "الدفع عند الاستلام", text: ["التوصيل خلال {delivery}، {noPrepay}.", "{noPrepay} — تدفع فقط عند الاستلام."] },
    ],
    [
      { title: "اختر", text: ["اضغط زر الطلب وأكمل بياناتك."] },
      { title: "نجهّز", text: ["نجهّز طلبك ونشحنه بعد التأكيد."] },
      { title: "تستلم", text: ["{reach} {door} خلال {delivery}، {inspect} {pay}.", "{reach} {door}، {inspect} {pay}."] },
    ],
    [
      { title: "سجّل طلبك", text: ["مباشرة من هذه الصفحة."] },
      { title: "نتواصل معك", text: ["{call}."] },
      { title: "استلم باطمئنان", text: ["{inspect} {pay}، ولك حق الإرجاع خلال {returns}.", "{inspect} {pay}."] },
    ],
  ],
  step1ByCategory: {
    fashion: "اختر المقاس واللون، ثم اكتب اسمك ورقم {phone} وعنوانك.",
    electronics: "راجع المواصفات، ثم اكتب اسمك ورقم {phone} وعنوانك.",
    home: "اختر الكمية المناسبة، ثم اكتب بياناتك في نموذج الطلب.",
    beauty: "راجع المكوّنات وطريقة الاستخدام، ثم أكمل بياناتك.",
    food: "اختر الكمية، ثم اكتب اسمك ورقم {phone} وعنوانك.",
    kids: "راجع العمر المناسب، ثم أكمل بياناتك في نموذج الطلب.",
    other: "",
  },
  boxTitle: {
    confident: ["ماذا ستستلم؟", "محتويات الطلب", "داخل العلبة", "ما يصلك مع {name}"],
    friendly: ["{get}", "داخل العلبة", "هذا ما يصلك", "كل ما في الطلب"],
    premium: ["محتويات العبوة", "ما يصلك بالتفصيل", "داخل العلبة", "مع {name} ستجد"],
    urgent: ["ما ستستلمه خلال {delivery}", "محتويات الطلب", "داخل العلبة", "كل ما يصلك"],
  },
  proofTitle: {
    confident: ["من رسائل عملائنا", "قالوا عن {name}", "آراء عملاء استلموا طلبهم", "تجارب عملائنا"],
    friendly: ["عملاؤنا قالوا", "كلام عملائنا", "من تجارب عملائنا", "رسائل وصلتنا"],
    premium: ["تجارب عملائنا", "بكلمات عملائنا", "انطباعات عملائنا", "ما قاله عملاؤنا"],
    urgent: ["عملاء جرّبوه قبلك", "من رسائل عملائنا", "آراء عملاء استلموا طلبهم", "قالوا عن {name}"],
  },
  guaranteeTitle: {
    confident: ["اشترِ وأنت مطمئن", "الضمانات بوضوح", "حقك محفوظ", "شروط واضحة من البداية"],
    friendly: ["اطمّن، طلبك في أمان", "براحتك تمامًا", "بدون قلق", "حقك محفوظ"],
    premium: ["التزامنا تجاهك", "خدمة تليق بطلبك", "شروط واضحة وشفافة", "شراء مطمئن"],
    urgent: ["اطلب الآن بدون قلق", "اطلب وأنت مطمئن", "الشروط بوضوح قبل الطلب", "حقك محفوظ"],
  },
  trust: [
    {
      delivery: { title: "توصيل {door}", text: "خلال {delivery}." },
      returns: { title: "إرجاع خلال {returns}", text: "وفق سياسة الاسترجاع." },
      cod: { title: "الدفع عند الاستلام", text: "{noPrepay}." },
    },
    {
      delivery: { title: "التوصيل", text: "مدة التوصيل المتوقعة {delivery}." },
      returns: { title: "الاسترجاع", text: "متاح خلال {returns} من الاستلام." },
      cod: { title: "الدفع", text: "كاش عند الاستلام، {inspect} {pay}." },
    },
    {
      delivery: { title: "شحن {door}", text: "يصل عادةً خلال {delivery}." },
      returns: { title: "استرجاع واضح", text: "من حقك الإرجاع خلال {returns}." },
      cod: { title: "ادفع عند الاستلام", text: "{inspect} {pay}." },
    },
    {
      delivery: { title: "{delivery}", text: "المدة المتوقعة لوصول طلبك {door}." },
      returns: { title: "{returns}", text: "مهلة الإرجاع المتاحة لك." },
      cod: { title: "كاش عند الاستلام", text: "{noPrepay}." },
    },
  ],
  faqTitle: {
    confident: ["الأسئلة الشائعة", "أسئلة قبل الطلب", "إجابات واضحة", "كل ما تحتاج معرفته"],
    friendly: ["عندك سؤال؟", "أسئلة تتكرر كثيرًا", "قبل ما تطلب", "نجاوبك بوضوح"],
    premium: ["معلومات مهمة", "الأسئلة المتكررة", "تفاصيل الطلب", "قبل أن تطلب"],
    urgent: ["أسئلة سريعة قبل الطلب", "الأسئلة الشائعة", "إجابات مختصرة", "قبل أن تطلب"],
  },
  faqCod: [
    { q: "هل الدفع عند الاستلام متاح؟", a: "نعم، {noPrepay}. {inspect} {pay}." },
    { q: "هل أحتاج إلى الدفع مقدّمًا؟", a: "لا، الدفع بالكامل عند الاستلام." },
  ],
  faqDelivery: [
    { q: "كم يستغرق التوصيل؟", a: "عادةً خلال {delivery}، والطلب {reach} {door}." },
    { q: "متى يصلني الطلب؟", a: "المدة المتوقعة {delivery} بعد تأكيد الطلب." },
  ],
  faqReturns: [
    { q: "هل يمكنني إرجاع المنتج؟", a: "نعم، يمكنك طلب الإرجاع خلال {returns} وفق سياسة الاسترجاع." },
    { q: "ماذا لو لم يناسبني المنتج؟", a: "من حقك الإرجاع خلال {returns} حسب سياسة الاسترجاع." },
  ],
  faqConfirm: [
    { q: "كيف أتأكد أن طلبي تم تسجيله؟", a: "بعد إرسال الطلب {call}." },
    { q: "هل سيتواصل معي أحد؟", a: "نعم، {call} قبل الشحن." },
  ],
  faqCategory: {
    fashion: [{ q: "كيف أختار المقاس المناسب؟", a: "راجع جدول المقاسات في صفحة المنتج، وإن احتجت مساعدة اسألنا عند تأكيد الطلب." }],
    electronics: [{ q: "هل يعمل مع أجهزتي؟", a: "راجع المواصفات في صفحة المنتج، ويمكنك سؤالنا عند تأكيد الطلب قبل الشحن." }],
    home: [{ q: "هل استخدامه سهل؟", a: "صُمّم للاستخدام اليومي، ويمكنك سؤالنا عن أي تفصيلة عند تأكيد الطلب." }],
    beauty: [{ q: "هل يناسب نوع بشرتي؟", a: "راجع المكوّنات وطريقة الاستخدام، وجرّبه على مساحة صغيرة أولًا. لأي حالة خاصة استشر مختصًا." }],
    food: [{ q: "ما المكوّنات ومدة الصلاحية؟", a: "المكوّنات وتاريخ الصلاحية مكتوبة على العبوة، ويمكنك سؤالنا عنها قبل الشحن." }],
    kids: [{ q: "هل يناسب عمر طفلي؟", a: "راجع العمر المناسب الموضّح في صفحة المنتج، ويُنصح دائمًا بإشراف الكبار." }],
    other: [],
  },
  ctaTitle: {
    confident: ["جاهز تطلب {name}؟", "اطلب {name} الآن", "خطوة واحدة تفصلك عن {name}", "أكمل طلبك"],
    friendly: ["جاهز نبدأ؟", "طلبك على بُعد خطوة", "جرّب {name} بنفسك", "اطلبه و{reach} {door}"],
    premium: ["أكمل طلبك", "{name} بانتظارك", "اطلب {name}", "ابدأ تجربتك مع {name}"],
    urgent: ["اطلب {name} بسعر {price}", "ثبّت طلبك الآن", "لا تؤجّل طلبك", "اطلب اليوم"],
  },
  ctaBody: {
    confident: [
      "التوصيل خلال {delivery}، والإرجاع متاح خلال {returns}.",
      "السعر {price}، والدفع عند الاستلام.",
      "أكمل بياناتك في نموذج الطلب، و{call}. {noPrepay}.",
      "{inspect} {pay}.",
    ],
    friendly: [
      "اطلبه {noPrepay}، ولك حق الإرجاع خلال {returns}.",
      "خطوات بسيطة وبعدها {reach} {door}.",
      "تقدر تطمّن: {inspect} {pay}.",
      "أكمل بياناتك و{call}.",
    ],
    premium: [
      "توصيل {door} خلال {delivery}، والدفع عند الاستلام.",
      "السعر {price}. {inspect} {pay}.",
      "نراجع طلبك معك قبل الشحن، لتستلمه كما تتوقع.",
      "أكمل طلبك في خطوات قليلة، ونتولى الباقي.",
    ],
    urgent: [
      "اطلب اليوم و{reach} {door} خلال {delivery}.",
      "السعر الحالي {price}. أكمل بياناتك الآن و{call}.",
      "الطلب بسيط، والدفع عند الاستلام {noPrepay}.",
      "أكمل بياناتك الآن، و{call}.",
    ],
  },
  ctaButton: {
    confident: ["أكمل الطلب", "{orderNow}", "اطلب الآن", "اطلب والدفع عند الاستلام"],
    friendly: ["{orderNow}", "ابدأ طلبك", "اطلبه الآن", "اطلب بسهولة"],
    premium: ["أكمل الطلب", "اطلب {name}", "إلى نموذج الطلب", "اطلب الآن"],
    urgent: ["{orderNow}", "اطلب اليوم", "ثبّت طلبك", "اطلب بسعر {price}"],
  },
  stickyText: {
    confident: ["{name} — {price}", "الدفع عند الاستلام {noPrepay}", "جاهز تطلب؟", "{name} بسعر {price}"],
    friendly: ["طلبك على بُعد ضغطة", "الدفع عند الاستلام", "جاهز؟", "{name} — {price}"],
    premium: ["{name}", "{name} — {price}", "الدفع عند الاستلام", "أكمل طلبك"],
    urgent: ["{price} — اطلب اليوم", "اطلب {now}", "الدفع عند الاستلام", "{name} — {price}"],
  },
  stickyButton: {
    confident: ["{orderNow}", "اطلب الآن", "أكمل الطلب", "اطلب"],
    friendly: ["{orderNow}", "ابدأ طلبك", "اطلبه", "اطلب الآن"],
    premium: ["أكمل الطلب", "اطلب الآن", "اطلب {name}", "إلى الطلب"],
    urgent: ["{orderNow}", "اطلب اليوم", "ثبّت طلبك", "اطلب الآن"],
  },
  countdownLabel: [
    "ينتهي العرض الحالي يوم {end}",
    "العرض ساري حتى {end}",
    "آخر موعد للعرض: {end}",
    "السعر الحالي متاح حتى {end}",
  ],
};

// ---------------------------------------------------------------------------
// English library (2+ variants per section per tone)
// ---------------------------------------------------------------------------

const EN: Library = {
  headline: {
    confident: ["{name}: a practical fix for {problem}", "{name} — {b1} and {b2} in one", "{name}, made to do its job well"],
    friendly: ["{audience}? {name} {forYou}", "Meet {name}: {b1}, made easy", "Say hello to {name}"],
    premium: ["{name}, thoughtfully made {forAudience}", "{name}. Considered details, calm experience"],
    urgent: ["{name} is available now at {price}", "Stop putting up with {problem} — try {name}", "{name}: order today, pay on delivery"],
  },
  sub: {
    confident: [
      "Built {forAudience}, with {b1} and {b2}. No upfront payment — pay cash when it arrives.",
      "{b1}, {b2} and {b3}, all in {name}.",
      "Order {name} with no upfront payment and pay cash when it arrives.",
    ],
    friendly: [
      "{name} helps with {b1} and adds {b2}. Check it when it arrives, then pay.",
      "Order with no upfront payment — delivered to your door in {delivery}.",
      "Simple to order: pay cash when it arrives.",
    ],
    premium: [
      "{name} brings {b1} and {b2} together in one considered design.",
      "Delivered to your door in {delivery}. Pay on delivery.",
      "A calm, simple way to buy: pay cash when it arrives.",
    ],
    urgent: [
      "Current price {price}. Order today and it arrives in {delivery}.",
      "Done with {problem}? {name} gives you {b1} — no upfront payment.",
      "Order today, pay cash on delivery.",
    ],
  },
  heroCta: {
    confident: ["Order now", "Get {name}"],
    friendly: ["Order now", "Try it yourself"],
    premium: ["Order {name}", "Continue to order"],
    urgent: ["Order today", "Order at {price}"],
  },
  priceWithCompare: ["Price: {price} (was {compare})", "{price} instead of {compare} — you save {save}"],
  priceOnly: ["Price: {price} · pay on delivery", "{price}, paid in cash on delivery"],
  benefitsTitle: {
    confident: ["Why {name}?", "What you get"],
    friendly: ["Why you'll like it", "The good stuff"],
    premium: ["In the details", "What sets {name} apart"],
    urgent: ["Why order today?", "{name} at a glance"],
  },
  benefitsIntro: {
    confident: ["Every feature has a reason:", "Here's what {name} does for you:"],
    friendly: ["The things that matter most:", "Simply put:"],
    premium: ["Designed {forAudience}:", "Details you notice with use:"],
    urgent: ["If {problem} slows you down, here's what changes:", "The short version:"],
  },
  howTitle: {
    confident: ["How to order", "3 simple steps"],
    friendly: ["Ordering is easy", "How it works"],
    premium: ["A simple buying experience", "From order to your door"],
    urgent: ["Order in 3 steps", "Start now in 3 steps"],
  },
  steps: [
    [
      { title: "Order", text: ["Enter your name, phone number and address in the order form."] },
      { title: "We confirm", text: ["We call you to confirm before shipping."] },
      { title: "Receive & pay", text: ["It arrives in {delivery}; check it, then pay in cash.", "Check it when it arrives, then pay in cash."] },
    ],
    [
      { title: "Fill the form", text: ["Just the basics: name, phone and address."] },
      { title: "Quick call", text: ["We call to confirm the details with you."] },
      { title: "Pay on delivery", text: ["Delivery in {delivery}, no upfront payment.", "No upfront payment — you pay on delivery."] },
    ],
  ],
  step1ByCategory: {
    fashion: "Pick your size and colour, then enter your details.",
    electronics: "Check the specs, then enter your name, phone and address.",
    home: "Choose the quantity, then fill in the order form.",
    beauty: "Check the ingredients and directions, then enter your details.",
    food: "Choose the quantity, then enter your name, phone and address.",
    kids: "Check the recommended age, then fill in the order form.",
    other: "",
  },
  boxTitle: all(["What's in the box", "What you receive"]),
  proofTitle: all(["From our customers' messages", "What customers told us"]),
  guaranteeTitle: {
    confident: ["Buy with confidence", "Clear terms"],
    friendly: ["No worries", "You're covered"],
    premium: ["Our commitment", "Clear, transparent terms"],
    urgent: ["Order today, worry-free", "The terms, upfront"],
  },
  trust: [
    {
      delivery: { title: "Delivery", text: "Expected in {delivery}." },
      returns: { title: "Returns", text: "Within {returns} of delivery." },
      cod: { title: "Cash on delivery", text: "No upfront payment." },
    },
    {
      delivery: { title: "{delivery}", text: "Expected delivery time to your door." },
      returns: { title: "{returns}", text: "Your return window." },
      cod: { title: "Pay when it arrives", text: "Check it first, then pay in cash." },
    },
  ],
  faqTitle: {
    confident: ["Frequently asked questions", "Before you order"],
    friendly: ["Got a question?", "Quick answers"],
    premium: ["Good to know", "Order details"],
    urgent: ["Quick questions before ordering", "FAQ"],
  },
  faqCod: [
    { q: "Can I pay cash on delivery?", a: "Yes. There's no upfront payment — check your order when it arrives, then pay." },
    { q: "Do I need to pay in advance?", a: "No, you pay the full amount on delivery." },
  ],
  faqDelivery: [
    { q: "How long does delivery take?", a: "Usually {delivery}, delivered to your door." },
    { q: "When will my order arrive?", a: "Expect it within {delivery} after we confirm your order." },
  ],
  faqReturns: [
    { q: "Can I return it?", a: "Yes, you can request a return within {returns} under our return policy." },
    { q: "What if it doesn't suit me?", a: "You can return it within {returns} according to our return policy." },
  ],
  faqConfirm: [
    { q: "How do I know my order went through?", a: "After you submit, we call you to confirm." },
    { q: "Will someone contact me?", a: "Yes, we call you to confirm before shipping." },
  ],
  faqCategory: {
    fashion: [{ q: "How do I pick the right size?", a: "Check the size chart on the product page, or ask us when we call to confirm." }],
    electronics: [{ q: "Will it work with my devices?", a: "Check the specs on the product page, or ask us before we ship." }],
    home: [{ q: "Is it easy to use?", a: "It's designed for everyday use; ask us about any detail when we confirm your order." }],
    beauty: [{ q: "Will it suit my skin?", a: "Check the ingredients and directions and patch-test first. For specific conditions, consult a professional." }],
    food: [{ q: "What are the ingredients and shelf life?", a: "Both are printed on the pack, and you can ask us before shipping." }],
    kids: [{ q: "Is it right for my child's age?", a: "Check the recommended age on the product page. Adult supervision is always advised." }],
    other: [],
  },
  ctaTitle: {
    confident: ["Ready to order {name}?", "Order {name} now"],
    friendly: ["Ready when you are", "Try {name} yourself"],
    premium: ["Complete your order", "{name} is waiting"],
    urgent: ["Order {name} at {price}", "Place your order today"],
  },
  ctaBody: {
    confident: ["Delivery in {delivery}, returns within {returns}.", "Fill in your details and we call you to confirm. No upfront payment."],
    friendly: ["No upfront payment, and returns within {returns}.", "A few quick steps and it's on its way to your door."],
    premium: ["Delivered to your door in {delivery}. Pay on delivery.", "We confirm your order with you before shipping."],
    urgent: ["Order today and it arrives in {delivery}.", "Fill in your details now — pay cash on delivery."],
  },
  ctaButton: {
    confident: ["Complete order", "Order now"],
    friendly: ["Order now", "Start your order"],
    premium: ["Complete order", "Go to order form"],
    urgent: ["Order today", "Order at {price}"],
  },
  stickyText: {
    confident: ["{name} — {price}", "Ready to order?"],
    friendly: ["One tap away", "Cash on delivery"],
    premium: ["{name} — {price}", "Complete your order"],
    urgent: ["{price} — order today", "Cash on delivery"],
  },
  stickyButton: all(["Order now", "Complete order"]),
  countdownLabel: ["This offer ends on {end}", "Current price available until {end}"],
};

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export interface TrustItem {
  icon: "truck" | "shield" | "check";
  title: string;
  text: string;
}

export interface Copy {
  headline: string;
  sub: string;
  heroCta: string;
  priceLine: string;
  benefitsTitle: string;
  benefitsIntro: string;
  howTitle: string;
  steps: Step[];
  boxTitle: string;
  proofTitle: string;
  guaranteeTitle: string;
  trust: TrustItem[];
  faqTitle: string;
  faq: QA[];
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
  stickyText: string;
  stickyButton: string;
  countdownLabel: string;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const TOKEN = /\{(\w+)\}/g;

function filled(template: string, vars: Record<string, string>): boolean {
  for (const m of template.matchAll(TOKEN)) {
    if (!vars[m[1]]?.trim()) return false;
  }
  return true;
}

function fill(template: string, vars: Record<string, string>): string {
  return template
    .replace(TOKEN, (_, k: string) => vars[k] ?? "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function pick<T>(items: T[], seed: number, salt: string): T {
  return items[hash(`${seed}|${salt}`) % items.length];
}

/** Picks among variants whose placeholders are all filled; falls back to the least-demanding one. */
function pickText(pool: string[], seed: number, salt: string, vars: Record<string, string>): string {
  const eligible = pool.filter((tpl) => filled(tpl, vars));
  if (eligible.length > 0) return fill(pick(eligible, seed, salt), vars);
  const fewest = [...pool].sort((a, b) => (a.match(TOKEN)?.length ?? 0) - (b.match(TOKEN)?.length ?? 0))[0] ?? "";
  return fill(fewest, vars);
}

/** Arabic "لـ" preposition: "الأمهات" -> "للأمهات", "كل" -> "لكل". */
function arabicLi(word: string): string {
  const w = word.trim();
  if (!w) return "";
  if (w.startsWith("ال")) return `لل${w.slice(2)}`;
  return `ل${w}`;
}

export function intlLocaleForPage(lang: PageLang): string {
  return lang === "en" ? "en-US" : lang === "ar-gulf" ? "ar-AE" : "ar-EG";
}

export function formatPagePrice(minor: number | null, currency: string, lang: PageLang): string {
  if (minor === null || !Number.isFinite(minor) || minor <= 0) return "";
  const major = minor / 100;
  try {
    return new Intl.NumberFormat(intlLocaleForPage(lang), {
      style: "currency",
      currency,
      minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${major} ${currency}`;
  }
}

export function formatPageDate(value: string, lang: PageLang): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(intlLocaleForPage(lang), {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildVars(brief: Brief, style: StyleOptions): Record<string, string> {
  const { lang } = style;
  const benefits = brief.benefits.map((b) => b.trim()).filter(Boolean);
  const price = formatPagePrice(brief.priceMinor, brief.currency, lang);
  const hasCompare =
    brief.priceMinor !== null && brief.compareAtMinor !== null && brief.compareAtMinor > brief.priceMinor;
  const en = lang === "en";
  return {
    ...LEX[lang],
    name: brief.name.trim(),
    price,
    compare: hasCompare ? formatPagePrice(brief.compareAtMinor, brief.currency, lang) : "",
    save: hasCompare ? formatPagePrice(brief.compareAtMinor! - brief.priceMinor!, brief.currency, lang) : "",
    audience: brief.audience.trim(),
    forAudience: brief.audience.trim() ? (en ? `for ${brief.audience.trim()}` : arabicLi(brief.audience)) : "",
    problem: brief.problem.trim(),
    forProblem: brief.problem.trim() ? (en ? `for ${brief.problem.trim()}` : arabicLi(brief.problem)) : "",
    b1: benefits[0] ?? "",
    b2: benefits[1] ?? "",
    b3: benefits[2] ?? "",
    delivery: brief.delivery.trim(),
    returns: brief.returns.trim(),
    end: style.countdownOn ? formatPageDate(style.countdownEnd, lang) : "",
  };
}

export function generateCopy(brief: Brief, style: StyleOptions, seeds: Seeds): Copy {
  const lib = style.lang === "en" ? EN : AR;
  const vars = buildVars(brief, style);
  const tone = style.tone;
  const base = `${style.lang}|${tone}`;
  const seedOf = (key: SectionKey) => hash(`${base}|${seeds[key]}`);
  const text = (pool: string[], key: SectionKey, salt: string) => pickText(pool, seedOf(key), salt, vars);

  // Steps: one variant set, per-step first eligible alternative; category tweaks step 1.
  const stepSet = pick(lib.steps, seedOf("how"), "steps");
  const steps: Step[] = stepSet.map((s, i) => {
    const alternatives = i === 0 && lib.step1ByCategory[style.category] ? [lib.step1ByCategory[style.category], ...s.text] : s.text;
    const chosen = alternatives.find((a) => filled(a, vars)) ?? alternatives[alternatives.length - 1];
    return { title: fill(s.title, vars), text: fill(chosen, vars) };
  });

  const trustTpl = pick(lib.trust, seedOf("guarantee"), "trust");
  const trust: TrustItem[] = [];
  if (vars.delivery) trust.push({ icon: "truck", title: fill(trustTpl.delivery.title, vars), text: fill(trustTpl.delivery.text, vars) });
  if (vars.returns) trust.push({ icon: "shield", title: fill(trustTpl.returns.title, vars), text: fill(trustTpl.returns.text, vars) });
  trust.push({ icon: "check", title: fill(trustTpl.cod.title, vars), text: fill(trustTpl.cod.text, vars) });

  const faqSeed = seedOf("faq");
  const qa = (list: QA[], salt: string): QA | null => {
    const eligible = list.filter((x) => filled(x.q, vars) && filled(x.a, vars));
    if (eligible.length === 0) return null;
    const chosen = pick(eligible, faqSeed, salt);
    return { q: fill(chosen.q, vars), a: fill(chosen.a, vars) };
  };
  const faq = [
    qa(lib.faqCod, "cod"),
    qa(lib.faqDelivery, "delivery"),
    qa(lib.faqReturns, "returns"),
    qa(lib.faqConfirm, "confirm"),
    ...lib.faqCategory[style.category].map((x) => ({ q: fill(x.q, vars), a: fill(x.a, vars) })),
    ...brief.faqs
      .filter((x) => x.q.trim() && x.a.trim())
      .map((x) => ({ q: x.q.trim(), a: x.a.trim() })),
  ].filter((x): x is QA => x !== null);

  return {
    headline: text(lib.headline[tone], "hero", "headline"),
    sub: text(lib.sub[tone], "hero", "sub"),
    heroCta: text(lib.heroCta[tone], "hero", "cta"),
    priceLine: vars.price
      ? text(vars.compare ? lib.priceWithCompare : lib.priceOnly, "hero", "price")
      : "",
    benefitsTitle: text(lib.benefitsTitle[tone], "benefits", "title"),
    benefitsIntro: text(lib.benefitsIntro[tone], "benefits", "intro"),
    howTitle: text(lib.howTitle[tone], "how", "title"),
    steps,
    boxTitle: text(lib.boxTitle[tone], "box", "title"),
    proofTitle: text(lib.proofTitle[tone], "proof", "title"),
    guaranteeTitle: text(lib.guaranteeTitle[tone], "guarantee", "title"),
    trust,
    faqTitle: text(lib.faqTitle[tone], "faq", "title"),
    faq,
    ctaTitle: text(lib.ctaTitle[tone], "cta", "title"),
    ctaBody: text(lib.ctaBody[tone], "cta", "body"),
    ctaButton: text(lib.ctaButton[tone], "cta", "button"),
    stickyText: text(lib.stickyText[tone], "sticky", "text"),
    stickyButton: text(lib.stickyButton[tone], "sticky", "button"),
    countdownLabel: vars.end ? text(lib.countdownLabel, "cta", "countdown") : "",
  };
}
