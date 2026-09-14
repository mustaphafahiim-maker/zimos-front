import type { Locale } from "../config";
import { cookies } from "./legal-cookies";
import { privacy } from "./legal-privacy";
import { refund } from "./legal-refund";
import { terms } from "./legal-terms";

/**
 * Legal TEMPLATES. They are structure and plain-language starting points, not
 * legal advice, and every page shows a "must be reviewed by a lawyer" banner.
 * Business details come from src/lib/company.ts.
 */
export interface LegalSection {
  /** Anchor id, stable across locales. */
  id: string;
  heading: string;
  paragraphs: string[];
  list?: string[];
}

export interface LegalDoc {
  kicker: string;
  title: string;
  description: string;
  intro: string;
  sections: LegalSection[];
}

export type LegalDocId = "terms" | "privacy" | "refund" | "cookies";

const docs: Record<LegalDocId, Record<Locale, LegalDoc>> = { terms, privacy, refund, cookies };

export function getLegalDoc(id: LegalDocId, locale: Locale): LegalDoc {
  return docs[id][locale];
}
