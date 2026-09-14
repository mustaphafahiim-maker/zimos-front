import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { ArrowIcon, ChatIcon } from "@/components/icons";
import { PageHero, PageShell } from "@/components/page-shell";
import { container } from "@/components/ui";
import { contactPage } from "@/i18n/pages/contact-page";
import { COMPANY, isPlaceholder, whatsappUrl } from "@/lib/company";
import { pageMetadata, resolveLocale, type LocaleParams } from "@/lib/page";

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const copy = contactPage[locale];
  return pageMetadata(locale, "/contact", copy.metaTitle, copy.metaDescription);
}

export default async function ContactPage({ params }: { params: LocaleParams }) {
  const locale = await resolveLocale(params);
  const copy = contactPage[locale];
  const whatsapp = whatsappUrl();
  const emailConfigured = !isPlaceholder(COMPANY.supportEmail);

  return (
    <PageShell locale={locale}>
      <PageHero kicker={copy.kicker} heading={copy.heading} intro={copy.intro} />

      <div className={`${container} grid gap-10 py-16 sm:py-20 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16`}>
        <div className="rounded-3xl border border-line bg-paper-raised p-6 shadow-card sm:p-10">
          <ContactForm copy={copy} supportEmail={COMPANY.supportEmail} emailConfigured={emailConfigured} />
        </div>

        <aside aria-labelledby="contact-aside" className="space-y-4">
          <h2 id="contact-aside" className="text-lg font-semibold text-ink">
            {copy.aside.heading}
          </h2>
          <div className="rounded-2xl border border-line bg-paper-raised p-5">
            <p className="text-sm text-ink-soft">{copy.aside.emailLabel}</p>
            {emailConfigured ? (
              <a href={`mailto:${COMPANY.supportEmail}`} dir="ltr" className="mt-1 block font-medium break-all text-primary hover:underline">
                {COMPANY.supportEmail}
              </a>
            ) : (
              <p className="mt-1 font-medium text-ink">{COMPANY.supportEmail}</p>
            )}
          </div>
          {whatsapp ? (
            <div className="rounded-2xl border border-line bg-paper-raised p-5">
              <p className="text-sm text-ink-soft">{copy.aside.whatsappLabel}</p>
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-2 font-medium text-primary hover:underline">
                <ChatIcon width="1rem" height="1rem" />
                {copy.aside.whatsappCta}
              </a>
            </div>
          ) : null}
          <div className="rounded-2xl border border-line bg-primary-soft p-5">
            <p className="text-sm text-ink-soft">{copy.aside.helpLabel}</p>
            <a href={`/${locale}/help`} className="mt-1 inline-flex items-center gap-2 font-medium text-primary hover:underline">
              {copy.aside.helpCta}
              <ArrowIcon width="0.9rem" height="0.9rem" />
            </a>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
