import type { PublicPlatformSettings } from "@store-builder/ui/platform-info";
import content from "@/content/policies.json";
import type { Locale } from "@/i18n/config";

/**
 * The policy pages' text — refund policy, terms, privacy, contact — and the
 * company details they and the footer show, all from one file:
 * src/content/policies.json. A value still to be decided is written in square
 * brackets there; scripts/check-policy-placeholders.mjs refuses a production
 * build while any is left.
 *
 * The tax registration number is the one company detail kept here instead
 * (TAX_REGISTRATION_NUMBER): it is the same in both languages.
 *
 * `{email}`, `{phone}`, `{address}`, `{legalName}`, `{registration}`,
 * `{taxRegistration}` and `{governingLaw}` in the text are filled in from the
 * company details, so each is written once.
 *
 * With PLATFORM_SETTINGS_ENABLED on, the contact and company details saved in
 * the console (lib/platform-settings.ts) take the place of these, field by
 * field; a group never saved keeps the values here. The text of the pages and
 * the governing law always come from this file.
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
  taxRegistration: string;
  address: string;
  email: string;
  phone: string;
  hours: string;
  governingLaw: string;
}

/** The date on the pages ("last updated"). The backend stores it with each acceptance (TERMS_VERSION). */
export const POLICIES_LAST_UPDATED: string = content.lastUpdated;

/** ZIMOS's tax registration number, shown in the footer and the contact page's entity details. */
export const TAX_REGISTRATION_NUMBER = "783-889-615";

export function companyDetails(locale: Locale, settings?: PublicPlatformSettings | null): CompanyDetails {
  const own: CompanyDetails = { ...content.company[locale], taxRegistration: TAX_REGISTRATION_NUMBER };
  const contact = settings?.contact;
  const company = settings?.company;
  return {
    ...own,
    ...(contact && {
      email: contact.supportEmail ?? own.email,
      phone: contact.phone ?? own.phone,
      address: contact.address[locale],
      hours: contact.hours[locale],
    }),
    ...(company && {
      brand: company.platformName,
      legalName: company.legalName[locale],
      registration: company.registration[locale],
      taxRegistration: company.taxRegistration ?? own.taxRegistration,
    }),
  };
}

function fill(text: string, company: CompanyDetails): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in company ? company[key as keyof CompanyDetails] : match
  );
}

export function policyPage(slug: PolicySlug, locale: Locale, settings?: PublicPlatformSettings | null): PolicyPage {
  const company = companyDetails(locale, settings);
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
