import type { PageTree } from "@store-builder/api-client";

export type StepId = "basics" | "look" | "product" | "delivery" | "launch";
export const STEP_IDS: StepId[] = ["basics", "look", "product", "delivery", "launch"];
export const SKIPPABLE: StepId[] = ["look", "product", "delivery"];

export function isStepId(v: string | null | undefined): v is StepId {
  return !!v && (STEP_IDS as string[]).includes(v);
}

export const CURRENCIES = ["EGP", "SAR", "AED", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CATEGORIES = ["fashion", "electronics", "home", "beauty", "food", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * The 27 Egyptian governorates. The storefront checkout sends the buyer's
 * governorate as `province: "<ar> (<en>)"` (apps/storefront/src/lib/orderForm.ts)
 * and the backend matches a zone's `regions[]` against that exact string
 * (shippingPricing.matchesZone), so zones must be written in the same format.
 */
export const GOVERNORATES = [
  { code: "cairo", ar: "القاهرة", en: "Cairo" },
  { code: "giza", ar: "الجيزة", en: "Giza" },
  { code: "alexandria", ar: "الإسكندرية", en: "Alexandria" },
  { code: "qalyubia", ar: "القليوبية", en: "Qalyubia" },
  { code: "sharqia", ar: "الشرقية", en: "Sharqia" },
  { code: "dakahlia", ar: "الدقهلية", en: "Dakahlia" },
  { code: "gharbia", ar: "الغربية", en: "Gharbia" },
  { code: "monufia", ar: "المنوفية", en: "Monufia" },
  { code: "beheira", ar: "البحيرة", en: "Beheira" },
  { code: "kafr-el-sheikh", ar: "كفر الشيخ", en: "Kafr El Sheikh" },
  { code: "damietta", ar: "دمياط", en: "Damietta" },
  { code: "port-said", ar: "بورسعيد", en: "Port Said" },
  { code: "ismailia", ar: "الإسماعيلية", en: "Ismailia" },
  { code: "suez", ar: "السويس", en: "Suez" },
  { code: "faiyum", ar: "الفيوم", en: "Faiyum" },
  { code: "beni-suef", ar: "بني سويف", en: "Beni Suef" },
  { code: "minya", ar: "المنيا", en: "Minya" },
  { code: "asyut", ar: "أسيوط", en: "Asyut" },
  { code: "sohag", ar: "سوهاج", en: "Sohag" },
  { code: "qena", ar: "قنا", en: "Qena" },
  { code: "luxor", ar: "الأقصر", en: "Luxor" },
  { code: "aswan", ar: "أسوان", en: "Aswan" },
  { code: "red-sea", ar: "البحر الأحمر", en: "Red Sea" },
  { code: "new-valley", ar: "الوادي الجديد", en: "New Valley" },
  { code: "matrouh", ar: "مطروح", en: "Matrouh" },
  { code: "north-sinai", ar: "شمال سيناء", en: "North Sinai" },
  { code: "south-sinai", ar: "جنوب سيناء", en: "South Sinai" },
] as const;

export function regionLabel(code: string): string {
  const g = GOVERNORATES.find((x) => x.code === code);
  return g ? `${g.ar} (${g.en})` : code;
}

/** Mirrors backend core/utils/workspaceSlug.toWorkspaceSlug. */
export function slugFromName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/, "");
  if (slug.length === 0) return "";
  if (slug.length < 3) return `${slug}-store`;
  return slug;
}

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export const STOREFRONT_BASE: string =
  (import.meta.env.VITE_STOREFRONT_URL as string | undefined)?.replace(/\/$/, "") ?? "http://localhost:3000";

export function storefrontUrl(workspaceId: string): string {
  return `${STOREFRONT_BASE}/store/${workspaceId}`;
}

let idSeq = 0;
function nid(prefix: string) {
  idSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSeq}`;
}

/**
 * A website created without a template has no pages, and publish refuses a
 * site without a non-empty home page — so "Start blank" seeds a minimal one.
 */
export function blankHomeTree(storeName: string, tagline: string): PageTree {
  return {
    version: 1,
    sections: [
      {
        id: nid("sec"),
        type: "section",
        rows: [
          {
            id: nid("row"),
            type: "row",
            columns: [
              {
                id: nid("col"),
                type: "column",
                span: 12,
                elements: [
                  { id: nid("el"), type: "heading", props: { text: storeName, level: 1 } },
                  { id: nid("el"), type: "text", props: { text: tagline } },
                  { id: nid("el"), type: "product_list", props: {} },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

/** Card tint when a template's globalStyles carry no primaryColor. */
export const FALLBACK_TINT = "#1D4ED8";
