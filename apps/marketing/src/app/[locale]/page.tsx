import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { DeepDives } from "@/components/deep-dives";
import { Faq } from "@/components/faq";
import { FinalCta } from "@/components/final-cta";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { Integrations } from "@/components/integrations";
import { Lifecycle } from "@/components/lifecycle";
import { Platform } from "@/components/platform";
import { Pricing } from "@/components/pricing";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default async function MarketingHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);

  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero copy={dict.hero} brand={dict.brand} />
        <Platform copy={dict.platform} />
        <Lifecycle copy={dict.lifecycle} />
        <HowItWorks copy={dict.howItWorks} />
        <DeepDives copy={dict.deepDives} />
        <Integrations copy={dict.integrations} />
        <Pricing copy={dict.pricing} locale={locale} />
        <Faq copy={dict.faq} />
        <FinalCta copy={dict.finalCta} brand={dict.brand} locale={locale} />
      </main>
      <SiteFooter copy={dict.footer} brand={dict.brand} locale={locale} />
    </>
  );
}
