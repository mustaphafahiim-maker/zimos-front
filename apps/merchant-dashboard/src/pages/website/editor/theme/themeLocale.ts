import { fmt } from "@/i18n/LocaleContext";
import { plural } from "@/lib/plural";
import { editorUi, type EditorLocale, type EditorUi } from "../editorLocale";

/**
 * The words of the theme panel and of the header / footer / announcement
 * panels, on top of the editor's own locale layer (editorLocale.ts):
 *
 *  - `themeUi(locale)` — everything these panels say that the editor did not
 *    say before (presets, font pairs, the link-target picker…);
 *  - `lookUi(locale)` — the editor's own strings (`editorUi`) with the Arabic
 *    of the ones these panels show re-voiced the way an Egyptian merchant
 *    talks. English is `editorUi("en")` untouched.
 *
 * Both follow the editor's language (EditorLocaleContext), like every other
 * piece of the editor.
 */

const EN = {
  presets: "Ready styles",
  presetsHint: "One tap sets the theme, colours, font and corners together. Change anything after.",
  presetUse: (name: string) => `Use the ${name} style`,
  presetApplied: (name: string) => `${name} style applied.`,
  presetUndo: "Undo",
  presetsPrev: "Previous styles",
  presetsNext: "More styles",

  brandColor: "Brand colour",
  useColor: (hex: string) => `Use ${hex}`,
  colorPicker: (label: string) => `${label} colour picker`,
  colorCode: (label: string) => `${label}: colour code`,
  colorInvalid: "Enter a colour code like",
  colorSwatches: (label: string) => `Ready colours — ${label}`,

  fontPair: "Font pair",
  fontPairHint: "Headings and text across your whole store.",
  fontOverTheme: "Store font",
  fontThemeOwn: "Theme font",
  fontPairName: (heading: string, body: string) => `${heading} + ${body}`,
  fontsMore: "More fonts",
  fontsLess: "Fewer fonts",

  cornersFromTheme: (theme: string) => `Corners and button shape come with the ${theme} theme.`,
  themeBlockHint: "Sets the shape of buttons and cards, the spacing and the top of the page.",
  themePaid: "Paid",
  themePaidNote: "Paid themes can't be bought yet — they will be soon.",
  shellTitle: "On every page",

  linkTargetTitle: "Where does this link go?",
  linkTargetEmpty: "Choose where it goes",
  back: "Back",
  searchList: "Search",
  noMatches: "Nothing matches.",
  done: "Done",
  retry: "Try again",
  submenuKept: (n: number) =>
    `Has a dropdown of ${plural(n, { one: "1 link", other: "{n} links" })} — kept as it is.`,
  groupLinks: (n: number) => plural(n, { one: "1 link", other: "{n} links" }),
};

export type ThemeUi = typeof EN;

const AR: ThemeUi = {
  presets: "ستايلات جاهزة",
  presetsHint: "دوسة واحدة تظبّط الثيم والألوان والخط والحواف مع بعض. وتغيّر أي حاجة بعدها.",
  presetUse: (name) => `استخدم ستايل ${name}`,
  presetApplied: (name) => `اتطبّق ستايل ${name}.`,
  presetUndo: "تراجع",
  presetsPrev: "الستايلات اللي قبل",
  presetsNext: "ستايلات أكتر",

  brandColor: "لون البراند",
  useColor: (hex) => `استخدم ${hex}`,
  colorPicker: (label) => `${label}: اختار لون`,
  colorCode: (label) => `${label}: كود اللون`,
  colorInvalid: "اكتب كود لون زي",
  colorSwatches: (label) => `ألوان جاهزة — ${label}`,

  fontPair: "الخطوط",
  fontPairHint: "خط العناوين وخط الكلام في متجرك كله.",
  fontOverTheme: "خط المتجر",
  fontThemeOwn: "خط الثيم",
  fontPairName: (heading, body) => `${heading} + ${body}`,
  fontsMore: "خطوط أكتر",
  fontsLess: "خطوط أقل",

  cornersFromTheme: (theme) => `الحواف وشكل الزراير جايين مع ثيم ${theme}.`,
  themeBlockHint: "بيحدد شكل الزراير والكروت والمسافات وأول الصفحة.",
  themePaid: "مدفوع",
  themePaidNote: "الثيمات المدفوعة مش متاحة للشراء لسه — قريب.",
  shellTitle: "ثابت في كل الصفحات",

  linkTargetTitle: "الرابط ده يودّي فين؟",
  linkTargetEmpty: "اختار يودّي فين",
  back: "رجوع",
  searchList: "دوّر",
  noMatches: "مفيش حاجة بالاسم ده.",
  done: "تمام",
  retry: "جرّب تاني",
  submenuKept: (n) =>
    `تحته قايمة فيها ${plural(n, { one: "رابط واحد", two: "رابطين", few: "{n} روابط", other: "{n} رابط" })} — هتفضل زي ما هي.`,
  groupLinks: (n) => plural(n, { one: "رابط واحد", two: "رابطين", few: "{n} روابط", other: "{n} رابط" }),
};

export function themeUi(locale: EditorLocale): ThemeUi {
  return locale === "ar" ? AR : EN;
}

/**
 * The Arabic of the editor strings these panels show, the way a merchant in
 * Egypt says it. Only wording: every key and signature is editorLocale's.
 */
const AR_VOICE = {
  closePanel: "اقفل",
  addLink: "ضيف رابط",
  linkAria: (i) => fmt("الرابط {n}", { n: i }),
  removeLink: (i) => fmt("امسح الرابط {n}", { n: i }),

  lookHint: "شكل متجرك كله: الثيم والألوان والشعار. بيظهر للعملاء أول ما تحفظ — من غير نشر.",
  theme: "الثيم",
  themeHint: "الثيم بيحدد الخطوط والحواف والزراير والكروت والمسافات وشكل أول الصفحة. إنت بتختار اللون.",
  themeOriginalHint: "في الشكل الأصلي إنت اللي بتختار الخط والحواف.",
  accentColors: "لون البراند",
  accentColorsHint: "لون الزراير واللينكات. اختار لون للوضع الفاتح ولون للغامق.",
  lightMode: "الوضع الفاتح",
  darkMode: "الوضع الغامق",
  accentLightHint: "بيتستخدم في الوضع الفاتح.",
  accentDarkHint: "بيتستخدم في الوضع الغامق.",
  accentDarkFollows: "نفس لون الوضع الفاتح لحد ما تختار لون.",
  themeDefaultColor: "لسه ما اخترتش — متجرك ماشي بلون الثيم نفسه.",
  matchLightMode: "خليه زي لون الوضع الفاتح",
  contrastOk: (label, text) => `واضح وسهل يتقري — كلام الزراير ${label}، واللينكات ${text}.`,
  contrastLow: (mode) => (mode === "dark" ? "صعب يتقري في الوضع الغامق" : "صعب يتقري في الوضع الفاتح"),
  contrastLabel: (ratio) => `كلام الزراير على اللون ده: ${ratio}`,
  contrastText: (ratio) => `اللون ده ككلام على خلفية متجرك: ${ratio}`,
  contrastTarget: "الأحسن ما يقلّش عن ٤٫٥ : ١. وتقدر تحفظه برضه.",
  contrastUse: "استخدم",
  contrastUseAria: (hex, mode) =>
    `استخدم اللون المقترح ${hex} في ${mode === "dark" ? "الوضع الغامق" : "الوضع الفاتح"}`,
  contrastNoSuggestion: "جرّب لون أغمق للوضع الفاتح، أو أفتح للوضع الغامق.",
  palettes: "ألوان جاهزة",
  usePalette: (name) => `استخدم ألوان ${name}`,
  secondColor: "اللون التاني",
  secondColorHint: "للشارات واللمسات الصغيرة.",
  storeDefaultColor: "لسه ما اخترتش — متجرك ماشي باللون الأساسي.",
  font: "الخط",
  corners: "الحواف",
  logo: "الشعار",
  logoHint: "بيظهر فوق في هيدر متجرك.",

  shellHeader: "الهيدر",
  shellFooter: "الفوتر",
  shellEditHint: "شريط الإعلان والهيدر والفوتر ثابتين في كل صفحات متجرك.",
  headerHint: "الشريط اللي فوق في كل صفحات متجرك.",
  footerHint: "آخر كل صفحة في متجرك.",
  announcementHint: "سطر واحد فوق الهيدر، في كل الصفحات.",
  menuLinks: "روابط القايمة",
  menuDefaultNote: "الهيدر فيه الروابط الأساسية: الرئيسية والسلة وتتبّع الأوردر.",
  customiseLinks: "عدّل الروابط",
  useStandardLinks: "رجّع الروابط الأساسية",
  menuLinksHint: "بتظهر في الهيدر على الشاشات الكبيرة وفي القايمة على الموبايل. اسحب عشان ترتّبها.",
  linkLabel: "اسم الرابط",
  linkLabelAuto: "بيتكتب بلغة العميل لوحده",
  linkLabelRequired: "اكتب اسم للرابط، وإلا مش هيظهر.",
  linkTarget: "بيودّي على",
  linkKind: (kind) =>
    (
      ({
        home: "الصفحة الرئيسية",
        cart: "السلة",
        track: "تتبّع الأوردر",
        page: "صفحة من موقعك",
        product: "منتج",
        collection: "مجموعة",
        url: "لينك خارجي",
      }) as Record<string, string>
    )[kind] ?? kind,
  choosePage: "اختار صفحة",
  chooseProduct: "اختار منتج",
  chooseCollection: "اختار مجموعة",
  listFailed: "ماعرفناش نحمّل القايمة.",
  webAddress: "اللينك",
  webAddressHint: "بيفتح في تبويب جديد.",
  dragLink: (i) => fmt("اسحب الرابط {n} عشان ترتّبه", { n: i }),
  maxLinks: (n) => fmt("لحد {n} روابط.", { n }),
  logoSize: "حجم الشعار",
  logoPlacement: "مكان الشعار",
  logoPlacementName: (align) => (align === "center" ? "في النص" : "في الأول"),
  showInHeader: "يظهر في الهيدر",
  showLanguage: "زرار اللغة (ع / EN)",
  showTheme: "زرار الوضع الغامق",
  showTrackOrder: "رابط تتبّع الأوردر",
  stickyHeader: "الهيدر يفضل ظاهر وإنت بتنزل في الصفحة",
  footerText: "النص اللي تحت اسم المتجر",
  footerTextHint: "سيبه فاضي عشان يظهر وصف متجرك.",
  footerDefaultNote: "الفوتر فيه المجموعة الأساسية: الرئيسية والسلة وتتبّع الأوردر.",
  customiseGroups: "عدّل المجموعات",
  useStandardGroup: "رجّع المجموعة الأساسية",
  groupAria: (i) => fmt("مجموعة الروابط {n}", { n: i }),
  addGroup: "ضيف مجموعة",
  removeGroup: (i) => fmt("امسح مجموعة الروابط {n}", { n: i }),
  maxGroups: (n) => fmt("لحد {n} مجموعات.", { n }),
  shellTooLarge:
    "إعدادات متجرك أطول من اللي ينفع يتحفظ (الحد حوالي ٥٠٠٠ حرف). امسح كام رابط أو قصّر شوية نصوص.",
  shellSizeWarning: (pct) => fmt("إعدادات المتجر واخدة {n}٪ من المساحة المتاحة.", { n: pct }),
  announcementBarHint: "سطر واحد فوق الهيدر — عرض، أو ملحوظة عن الشحن، أو ميعاد إجازة.",
  announcementMessages: "الرسايل",
  announcementMessagePlaceholder: "مثلًا: شحن مجاني للأوردرات فوق ٥٠٠ جنيه",
  announcementMessageAria: (i) => fmt("الرسالة {n}", { n: i }),
  announcementAddMessage: "ضيف رسالة",
  announcementRemoveMessage: (i) => fmt("امسح الرسالة {n}", { n: i }),
  announcementMoveUp: (i) => fmt("طلّع الرسالة {n} لفوق", { n: i }),
  announcementMoveDown: (i) => fmt("نزّل الرسالة {n} لتحت", { n: i }),
  announcementNeedsMessage: "اكتب رسالة واحدة على الأقل — وإلا الشريط هيتحفظ مقفول.",
  announcementLinkHint: "العميل لما يدوس على الشريط يروح فين.",
  announcementTextColor: "لون كلام الشريط",
  announcementColorSetHint: "على شريط الإعلان بس.",
} satisfies Partial<EditorUi>;

const LOOK_EN: EditorUi = editorUi("en");
const LOOK_AR: EditorUi = { ...editorUi("ar"), ...AR_VOICE };

/** `editorUi` for the theme and shell panels: the same keys, Egyptian Arabic. */
export function lookUi(locale: EditorLocale): EditorUi {
  return locale === "ar" ? LOOK_AR : LOOK_EN;
}
