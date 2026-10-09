import type { Messages } from "@/i18n/LocaleContext";

/** The words of Store settings → Our branches (frontend-handoff 233). */
export const BRANCH_STRINGS = {
  en: {
    title: "Our branches",
    description:
      "A page on your store that lists your branches — address, opening hours, phone and directions — so shoppers can find the one nearest to them.",
    on: "On",
    off: "Off",
    enabled: "Show the “Our stores” page on your store",
    enabledHint: "Shoppers get an “Our stores” link at the bottom of the store, and a page with each branch you show below.",
    openPage: "Open the page",
    pageNote: "The page opens once you save.",
    fromInventory: "Branches are your locations in Inventory → Locations. Their name and address are changed there.",
    openLocations: "Open locations",
    noneVisible: "No branch is shown yet — turn on “Show on site” for at least one.",
    emptyTitle: "No locations yet",
    emptyHint: "Add your first location — a shop or a warehouse — and it can be shown here as a branch.",
    addLocation: "Add a location",
    noAddress: "No address yet — add it in Inventory → Locations.",
    hiddenNote: "Not listed on the branches page. Switch it on to add its phone, hours and map pin.",
    inactive: "This location is switched off, so it won't appear on the store even when shown here.",
    visible: "Show on site",
    visibleFor: "Show {name} on site",
    phone: "Phone",
    whatsapp: "WhatsApp",
    whatsappHint: "With the country code, for example 201001234567",
    hoursAr: "Opening hours (Arabic)",
    hoursEn: "Opening hours (English)",
    hoursHint: "For example: Sat – Thu, 10 am – 10 pm",
    noteAr: "Note (Arabic)",
    noteEn: "Note (English)",
    noteHint: "For example: second floor, parking behind the building",
    pin: "Map pin",
    pinHelp: "In Google Maps, right-click the branch's spot and copy the two numbers, then paste them in the first box.",
    lat: "Latitude",
    lng: "Longitude",
    checkPin: "Check the pin on the map",
    noPin: "Without a pin, “Directions” uses the address, and “Nearest to me” can't measure the distance to this branch.",
    pinBoth: "Type both numbers: latitude and longitude.",
    latRange: "Latitude is a number between -90 and 90.",
    lngRange: "Longitude is a number between -180 and 180.",
    fixFirst: "Check the map pin of {name}.",
    counter: "{n}/{max}",
    saved: "Branches saved.",
  },
  ar: {
    title: "فروعنا",
    description: "صفحة في متجرك فيها فروعك — العنوان ومواعيد العمل والتليفون والاتجاهات — عشان العميل يوصل لأقرب فرع ليه.",
    on: "شغّالة",
    off: "مقفولة",
    enabled: "اعرض صفحة «فروعنا» في المتجر",
    enabledHint: "العميل هيلاقي لينك «فروعنا» تحت في المتجر، وصفحة فيها كل فرع بتعرضه هنا.",
    openPage: "افتح الصفحة",
    pageNote: "الصفحة هتفتح بعد ما تحفظ.",
    fromInventory: "الفروع هي المخازن اللي في المخزون ← المخازن. الاسم والعنوان بيتعدّلوا من هناك.",
    openLocations: "افتح المخازن",
    noneVisible: "مفيش فرع ظاهر لسه — فعّل «اعرضه في المتجر» لفرع واحد على الأقل.",
    emptyTitle: "مفيش مخازن لسه",
    emptyHint: "ضيف أول مخزن عندك — محل أو مخزن — وبعدها تقدر تعرضه هنا كفرع.",
    addLocation: "ضيف مخزن",
    noAddress: "مفيش عنوان لسه — ضيفه من المخزون ← المخازن.",
    hiddenNote: "مش ظاهر في صفحة «فروعنا». شغّله عشان تكتب تليفونه ومواعيده ومكانه على الخريطة.",
    inactive: "المخزن ده متوقف، فمش هيظهر في المتجر حتى لو معروض هنا.",
    visible: "اعرضه في المتجر",
    visibleFor: "اعرض {name} في المتجر",
    phone: "رقم التليفون",
    whatsapp: "واتساب",
    whatsappHint: "الرقم بكود الدولة، زي 201001234567",
    hoursAr: "مواعيد العمل (عربي)",
    hoursEn: "مواعيد العمل (إنجليزي)",
    hoursHint: "مثلًا: السبت – الخميس، ١٠ ص – ١٠ م",
    noteAr: "ملاحظة (عربي)",
    noteEn: "ملاحظة (إنجليزي)",
    noteHint: "مثلًا: الدور التاني، وفيه جراج ورا العمارة",
    pin: "مكان الفرع على الخريطة",
    pinHelp: "في خرائط جوجل: دوس كليك يمين على مكان الفرع وانسخ الرقمين، والصقهم في أول خانة.",
    lat: "خط العرض (Latitude)",
    lng: "خط الطول (Longitude)",
    checkPin: "شوف المكان على الخريطة",
    noPin: "من غير مكان على الخريطة: زرار «الاتجاهات» هيستخدم العنوان، و«أقرب فرع ليا» مش هيحسب المسافة للفرع ده.",
    pinBoth: "اكتب الرقمين مع بعض: خط العرض وخط الطول.",
    latRange: "خط العرض رقم بين ‎-90 و 90.",
    lngRange: "خط الطول رقم بين ‎-180 و 180.",
    fixFirst: "راجع مكان «{name}» على الخريطة.",
    counter: "{n}/{max}",
    saved: "الفروع اتحفظت.",
  },
} satisfies Messages;

export type BranchStrings = (typeof BRANCH_STRINGS)["en"];

/** Arabic-Indic and Persian digits and the Arabic decimal mark, as a plain number's text. */
export function latinNumberText(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/−/g, "-")
    .trim();
}

/** A coordinate as typed → a number, or null when it is not one. */
export function coordinateOf(raw: string): number | null {
  const text = latinNumberText(raw);
  if (!/^-?\d{1,3}(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/**
 * "30.0444, 31.2357" — what Google Maps copies — as the two numbers, or null
 * when the text is not a pair.
 */
export function pastedPin(raw: string): { lat: string; lng: string } | null {
  const text = latinNumberText(raw).replace(/،/g, ",");
  const match = /^\(?\s*(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*\)?$/.exec(text);
  return match ? { lat: match[1], lng: match[2] } : null;
}
