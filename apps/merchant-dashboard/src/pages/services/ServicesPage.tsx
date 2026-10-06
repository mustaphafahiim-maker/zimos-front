import { useState } from "react";
import { ExternalLink, Handshake, Mail, MessageCircle } from "lucide-react";
import { Card, buttonVariants } from "@store-builder/ui";
import { SERVICE_CATEGORIES, serviceListingsList, type ServiceCategory, type ServiceListing } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { formatMoney } from "@/lib/format";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs } from "@/components/FilterTabs";

const STRINGS = {
  en: {
    title: "Services",
    description: "Freelancers and agencies who help merchants. You agree the work and the payment with the provider directly — Zimos is not a party to it.",
    filter: "Service category",
    all: "All",
    cat_page_management: "Page management",
    cat_landing_pages: "Landing pages",
    cat_ugc: "UGC content",
    cat_video: "Video",
    cat_marketing: "Marketing",
    cat_programming: "Programming",
    cat_consulting: "Consulting",
    cat_store_setup: "Store setup",
    cat_design: "Design",
    cat_accounting: "Accounting",
    quote: "Price on request",
    whatsapp: "WhatsApp",
    website: "Visit",
    email: "Email",
    emptyTitle: "No services listed yet",
    emptyDescription: "Providers will appear here as they are added.",
    emptyCategory: "No services in this category yet.",
    hello: "Hello, I found your service “{title}” on Zimos.",
  },
  ar: {
    title: "الخدمات",
    description: "مستقلون وشركات يساعدون التجار. تتفق على العمل والدفع مع مقدم الخدمة مباشرة — زيموس ليست طرفًا في الاتفاق.",
    filter: "تصنيف الخدمة",
    all: "الكل",
    cat_page_management: "إدارة الصفحات",
    cat_landing_pages: "صفحات الهبوط",
    cat_ugc: "محتوى UGC",
    cat_video: "فيديو",
    cat_marketing: "تسويق",
    cat_programming: "برمجة",
    cat_consulting: "استشارات",
    cat_store_setup: "تجهيز المتجر",
    cat_design: "تصميم",
    cat_accounting: "محاسبة",
    quote: "السعر عند الطلب",
    whatsapp: "واتساب",
    website: "زيارة",
    email: "بريد",
    emptyTitle: "مفيش خدمات لسه",
    emptyDescription: "سيظهر مقدمو الخدمات هنا عند إضافتهم.",
    emptyCategory: "مفيش خدمات في هذا التصنيف لسه.",
    hello: "مرحبًا، وجدت خدمتك «{title}» على زيموس.",
  },
} satisfies Messages;

/** Services marketplace (SPEC §20.5): the providers directory, by category. */
export function ServicesPage() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const list = useAsync(() => serviceListingsList(apiClient), []);
  const [category, setCategory] = useState<"all" | ServiceCategory>("all");
  const listings = list.data ?? [];
  const used = SERVICE_CATEGORIES.filter((key) => listings.some((l) => l.category === key));
  const shown = category === "all" ? listings : listings.filter((l) => l.category === category);

  const titleOf = (l: ServiceListing) => (locale === "ar" && l.titleAr ? l.titleAr : l.title);
  const descriptionOf = (l: ServiceListing) => (locale === "ar" && l.descriptionAr ? l.descriptionAr : l.description);
  const outline = buttonVariants({ variant: "outline", size: "sm" });

  return (
    <div className="max-w-6xl">
      <PageHeader title={t.title} description={t.description} />
      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        {listings.length === 0 ? (
          <EmptyState icon={<Handshake className="size-6" aria-hidden />} title={t.emptyTitle} description={t.emptyDescription} />
        ) : (
          <>
            <FilterTabs
              className="mb-4"
              label={t.filter}
              value={category}
              onChange={setCategory}
              tabs={[{ value: "all" as const, label: t.all }, ...used.map((key) => ({ value: key, label: t[`cat_${key}`] }))]}
            />
            {shown.length === 0 ? (
              <EmptyState title={t.emptyCategory} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {shown.map((listing) => (
                  <Card key={listing.id} className="gap-0 p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft text-primary">
                        {listing.providerLogoUrl ? (
                          <img src={listing.providerLogoUrl} alt="" className="size-full object-cover" />
                        ) : (
                          <Handshake className="size-5" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h2 dir="auto" className="text-base font-semibold text-ink">
                          {titleOf(listing)}
                        </h2>
                        <p className="truncate text-xs text-ink-soft">
                          <bdi>{listing.providerName}</bdi> · {t[`cat_${listing.category}`]}
                        </p>
                      </div>
                    </div>
                    <p dir="auto" className="mt-3 flex-1 whitespace-pre-line text-sm text-ink-soft">
                      {descriptionOf(listing)}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-ink">
                      {listing.priceAmount !== null && listing.priceCurrency ? (
                        <>
                          {formatMoney(listing.priceAmount, listing.priceCurrency)}
                          {listing.priceUnit && <span className="font-normal text-ink-soft"> · {listing.priceUnit}</span>}
                        </>
                      ) : (
                        <span className="font-normal text-ink-soft">{t.quote}</span>
                      )}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {listing.contactWhatsapp && (
                        <a
                          href={`https://wa.me/${listing.contactWhatsapp}?text=${encodeURIComponent(t.hello.replace("{title}", titleOf(listing)))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonVariants({ size: "sm" })}
                        >
                          <MessageCircle className="size-4" aria-hidden />
                          {t.whatsapp}
                        </a>
                      )}
                      {listing.contactUrl && (
                        <a href={listing.contactUrl} target="_blank" rel="noopener noreferrer" className={outline}>
                          <ExternalLink className="size-4" aria-hidden />
                          {t.website}
                        </a>
                      )}
                      {listing.contactEmail && (
                        <a href={`mailto:${listing.contactEmail}`} className={outline}>
                          <Mail className="size-4" aria-hidden />
                          {t.email}
                        </a>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </DataState>
    </div>
  );
}
