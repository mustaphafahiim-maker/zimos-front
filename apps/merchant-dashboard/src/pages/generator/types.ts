import type { ProductMedia } from "@store-builder/api-client";

/** Language of the generated page copy (independent of the dashboard UI language). */
export type PageLang = "ar-eg" | "ar-gulf" | "en";
export type Tone = "confident" | "friendly" | "premium" | "urgent";
export type Category = "fashion" | "electronics" | "home" | "beauty" | "food" | "kids" | "other";

export const SECTION_KEYS = ["hero", "benefits", "how", "box", "proof", "guarantee", "faq", "cta", "sticky"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export interface Quote {
  quote: string;
  author: string;
}

export interface QA {
  q: string;
  a: string;
}

export interface Brief {
  productId: string | null;
  productSlug: string | null;
  name: string;
  /** Integer minor units; null when not entered / invalid. */
  priceMinor: number | null;
  compareAtMinor: number | null;
  currency: string;
  description: string;
  benefits: string[];
  audience: string;
  problem: string;
  box: string;
  delivery: string;
  returns: string;
  guarantee: string;
  quotes: Quote[];
  faqs: QA[];
  images: ProductMedia[];
}

export interface StyleOptions {
  lang: PageLang;
  tone: Tone;
  category: Category;
  accent: string;
  sections: Record<SectionKey, boolean>;
  countdownOn: boolean;
  /** `datetime-local` input value. */
  countdownEnd: string;
}

export type Seeds = Record<SectionKey, number>;

/** Inline preview edits: elementId -> prop -> value. Applied on top of the generated tree. */
export type Overrides = Record<string, Record<string, string>>;
