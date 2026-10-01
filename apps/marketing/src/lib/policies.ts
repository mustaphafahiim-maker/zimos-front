import content from "@/content/policies.json";
import type { Locale } from "@/i18n/config";

/**
 * The policy pages' text — refund policy, terms, privacy, contact — and the
 * company details they and the footer show, all from one file:
 * src/content/policies.json. A value still to be decided is written in square
 * brackets there; scripts/check-policy-placeholders.mjs refuses a production
 * build while any is left.
 *
 * `{email}`, `{phone}`, `{address}`, `{legalName}`, `{registration}` and
 * `{governingLaw}` in the text are filled in from the company details, so
 * each is written once.
 */

export type PolicySlug = "refund-policy" | "terms" | "privacy" | "contact";

export const POLICY_SLUGS: PolicySlug[] = ["refund-policy", "terms", "privacy", "contact"];

export interface PolicySection {
  heading: string;
  body: string[];
}

export interface PolicyPage {
  title: string;
  description: string;
  intro: string;
  sections: PolicySection[];
}

export interface CompanyDetails {
  brand: string;
  legalName: string;
  registration: string;
  address: string;
  email: string;
  phone: string;
  hours: string;
  governingLaw: string;
}

/** The date on the pages ("last updated"). The backend stores it with each acceptance (TERMS_VERSION). */
export const POLICIES_LAST_UPDATED: string = content.lastUpdated;

export function companyDetails(locale: Locale): CompanyDetails {
  return content.company[locale];
}

function fill(text: string, company: CompanyDetails): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in company ? company[key as keyof CompanyDetails] : match
  );
}

export function policyPage(slug: PolicySlug, locale: Locale): PolicyPage {
  const company = companyDetails(locale);
  const page = content.pages[slug][locale] as PolicyPage;
  return {
    title: page.title,
    description: page.description,
    intro: fill(page.intro, company),
    sections: page.sections.map((section) => ({
      heading: section.heading,
      body: section.body.map((paragraph) => fill(paragraph, company)),
    })),
  };
}
