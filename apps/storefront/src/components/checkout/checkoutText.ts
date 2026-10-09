/**
 * The checkout's own words — the order form's as-you-type lines and the
 * summary strip on a phone — kept beside the components that say them, in
 * the store's three languages (read with `pickText`). Everything else on the
 * checkout still comes from the store's dictionary (lib/i18n), which the
 * merchant can reword.
 *
 * Numbers arrive already formatted (the caller uses the page's Intl locale),
 * so Arabic copy carries Arabic-Indic digits like the prices beside it. The
 * prefixes 01 / 010 … stay as they are typed on the keypad.
 */
export const CHECKOUT_TEXT = {
  ar: {
    /** Read out once when the number becomes a valid mobile; the tick beside the field is the visible half. */
    phoneOk: "الرقم صحيح",
    phonePrefix: "الرقم لازم ١١ رقم ويبدأ بـ 01.",
    phoneOperator: "الرقم لازم يبدأ بـ 010 أو 011 أو 012 أو 015.",
    phoneShort: (typed: string, needed: string) => `الرقم ناقص: كتبت ${typed} من ${needed} رقم.`,
    phoneLong: "الرقم أطول من اللازم: لازم ١١ رقم بس ويبدأ بـ 01.",
    phoneLetters: "اكتب أرقام بس: ١١ رقم ويبدأ بـ 01.",

    pieces: (n: number, shown: string) => (n === 1 ? "قطعة واحدة" : n === 2 ? "قطعتين" : n <= 10 ? `${shown} قطع` : `${shown} قطعة`),
    showDetails: "عرض التفاصيل",
    hideDetails: "إخفاء التفاصيل",
    openDetails: "تفاصيل الطلب والخصومات",
    browse: "تصفّح المنتجات",

    couponNote: "بيتخصم من الإجمالي عند تأكيد الطلب.",
    couponInvalid: (code: string) => `الكود «${code}» مش بينطبق على طلبك. شيله عشان الطلب يتأكّد.`,
    beforeCoupon: "قبل الكوبون",

    showProblem: "اعرضها",
  },
  en: {
    phoneOk: "The number is valid",
    phonePrefix: "The number should be 11 digits and start with 01.",
    phoneOperator: "The number should start with 010, 011, 012 or 015.",
    phoneShort: (typed: string, needed: string) => `Too short: you typed ${typed} of ${needed} digits.`,
    phoneLong: "Too long: it should be just 11 digits, starting with 01.",
    phoneLetters: "Digits only: 11 digits starting with 01.",

    pieces: (n: number, shown: string) => `${shown} item${n === 1 ? "" : "s"}`,
    showDetails: "Show details",
    hideDetails: "Hide details",
    openDetails: "Order details and discounts",
    browse: "Browse products",

    couponNote: "Taken off your total when the order is confirmed.",
    couponInvalid: (code: string) => `Code “${code}” doesn't apply to this order. Remove it to place the order.`,
    beforeCoupon: "before the coupon",

    showProblem: "Show",
  },
  fr: {
    phoneOk: "Le numéro est valide",
    phonePrefix: "Le numéro doit compter 11 chiffres et commencer par 01.",
    phoneOperator: "Le numéro doit commencer par 010, 011, 012 ou 015.",
    phoneShort: (typed: string, needed: string) => `Numéro incomplet : ${typed} chiffres saisis sur ${needed}.`,
    phoneLong: "Numéro trop long : 11 chiffres seulement, en commençant par 01.",
    phoneLetters: "Des chiffres uniquement : 11 chiffres en commençant par 01.",

    pieces: (n: number, shown: string) => `${shown} article${n > 1 ? "s" : ""}`,
    showDetails: "Voir le détail",
    hideDetails: "Masquer le détail",
    openDetails: "Détail de la commande et réductions",
    browse: "Voir les produits",

    couponNote: "Déduit du total à la confirmation de la commande.",
    couponInvalid: (code: string) => `Le code « ${code} » ne s'applique pas à cette commande. Retirez-le pour commander.`,
    beforeCoupon: "avant le coupon",

    showProblem: "Voir",
  },
};

export type CheckoutText = (typeof CHECKOUT_TEXT)["en"];
