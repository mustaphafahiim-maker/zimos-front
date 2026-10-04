import { Images, Layers3, MessageSquarePlus, SlidersHorizontal, type LucideIcon } from "lucide-react";
import type { PageElementType } from "@store-builder/api-client";
import type { BlockPreset, FieldSpec } from "./blocks";

/**
 * Builder elements added after the first set (SPEC §9.3, item 44; backend
 * pages/builderExtras.js, storefront page-renderer/builderExtras.tsx): a
 * gallery with thumbnails, the product's variant and bundle pickers, and the
 * shopper's review form. Merged into ELEMENT_SPECS / BLOCK_PRESETS and the
 * Arabic labels from here, as showcaseBlocks.ts is.
 */

type Spec = { label: string; icon: LucideIcon; defaultProps: Record<string, unknown>; fields: FieldSpec[] };

const PRODUCT_FIELD: FieldSpec = { key: "productId", label: "Product ID", kind: "text", hint: "Leave empty to use the page's product (else the newest)." };

export const EXTRA_ELEMENT_SPECS: Record<string, Spec> = {
  image_gallery: {
    label: "Gallery with thumbnails",
    icon: Images,
    defaultProps: { title: "", images: [], productId: "", thumbnails: "below" },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "images", label: "Images", kind: "imageList", hint: "Empty shows the product's own pictures." },
      PRODUCT_FIELD,
      {
        key: "thumbnails",
        label: "Thumbnails",
        kind: "select",
        options: [
          { value: "below", label: "Below the picture" },
          { value: "side", label: "Beside the picture" },
        ],
      },
    ],
  },
  variant_selector: {
    label: "Variant picker",
    icon: SlidersHorizontal,
    defaultProps: { title: "", productId: "", showPrice: true },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      PRODUCT_FIELD,
      { key: "showPrice", label: "Show the chosen option's price and stock", kind: "boolean" },
    ],
  },
  bundle_selector: {
    label: "Bundle picker",
    icon: Layers3,
    defaultProps: { title: "", productId: "" },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { ...PRODUCT_FIELD, hint: "Shows the product's quantity offers (Offers → Quantity offers). Leave empty for the page's product." },
    ],
  },
  review_form: {
    label: "Review form",
    icon: MessageSquarePlus,
    defaultProps: { title: "", productId: "" },
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { ...PRODUCT_FIELD, hint: "Customers who received the product review it with their order number and phone. Reviews wait for your approval." },
    ],
  },
};

const t = (type: string) => type as PageElementType;

export const EXTRA_PRESETS: BlockPreset[] = [
  {
    key: "image-gallery",
    label: "Gallery with thumbnails",
    description: "A big picture with a row of thumbnails — the product's own pictures unless you add some.",
    icon: Images,
    group: "commerce",
    elements: [t("image_gallery")],
  },
  {
    key: "variant-selector",
    label: "Variant picker",
    description: "The product's options (size, colour…) as buttons. The order form starts from the shopper's choice.",
    icon: SlidersHorizontal,
    group: "commerce",
    elements: [t("variant_selector")],
  },
  {
    key: "bundle-selector",
    label: "Bundle picker",
    description: "The product's quantity offers to choose from, with the saving.",
    icon: Layers3,
    group: "commerce",
    elements: [t("bundle_selector")],
  },
  {
    key: "review-form",
    label: "Review form",
    description: "Lets customers who received the product review it, with photos.",
    icon: MessageSquarePlus,
    group: "trust",
    elements: [t("review_form")],
  },
];

export const EXTRA_AR = {
  elements: {
    image_gallery: "معرض صور بمصغّرات",
    variant_selector: "اختيار النوع",
    bundle_selector: "اختيار العرض",
    review_form: "فورم التقييم",
  } as Record<string, string>,
  fields: {
    "image_gallery.thumbnails": "المصغّرات",
    "variant_selector.showPrice": "اعرض سعر ومخزون النوع المختار",
  } as Record<string, string>,
  hints: {
    "image_gallery.images": "لو فاضي بيعرض صور المنتج نفسه.",
    "image_gallery.productId": "سيبه فاضي عشان يستخدم منتج الصفحة (أو الأحدث).",
    "variant_selector.productId": "سيبه فاضي عشان يستخدم منتج الصفحة (أو الأحدث).",
    "bundle_selector.productId": "بيعرض عروض الكمية بتاعة المنتج (العروض ← عروض الكمية). سيبه فاضي لمنتج الصفحة.",
    "review_form.productId": "العملاء اللي استلموا المنتج بيقيّموه برقم الطلب والموبايل. التقييمات بتستنى موافقتك.",
  } as Record<string, string>,
  options: {
    "thumbnails.below": "تحت الصورة",
    "thumbnails.side": "جنب الصورة",
  } as Record<string, string>,
  presets: {
    "image-gallery": { label: "معرض صور بمصغّرات", description: "صورة كبيرة وتحتها صف مصغّرات — صور المنتج نفسه لو ماضفتش صور." },
    "variant-selector": { label: "اختيار النوع", description: "أنواع المنتج (المقاس، اللون…) كأزرار. فورم الطلب بيبدأ من اختيار العميل." },
    "bundle-selector": { label: "اختيار العرض", description: "عروض الكمية بتاعة المنتج يختار منها العميل، مع التوفير." },
    "review-form": { label: "فورم التقييم", description: "يخلّي العملاء اللي استلموا المنتج يقيّموه، بالصور." },
  } as Record<string, { label: string; description: string }>,
};
