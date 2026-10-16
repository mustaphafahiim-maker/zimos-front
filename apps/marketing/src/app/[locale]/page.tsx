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
import { ProductShowcase } from "@/components/product-showcase";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Service } from "@/components/service";
import { getPublicPlans } from "@/lib/plans";

// The pricing section reads the plans from the API: rebuilt at most every 5 minutes.
export const revalidate = 300;

export default async function MarketingHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const plans = await getPublicPlans();

  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero copy={dict.hero} brand={dict.brand} />
        <Service copy={dict.service} />
        <ProductShowcase locale={locale} />
        <Platform copy={dict.platform} />
        <Lifecycle copy={dict.lifecycle} />
        <HowItWorks copy={dict.howItWorks} />
        <DeepDives copy={dict.deepDives} />
        <Integrations copy={dict.integrations} />
        <Pricing copy={dict.pricing} locale={locale} plans={plans} />
        <Faq copy={dict.faq} />
        <FinalCta copy={dict.finalCta} brand={dict.brand} locale={locale} />
      </main>
      <SiteFooter copy={dict.footer} brand={dict.brand} locale={locale} />
    </>
  );
}
