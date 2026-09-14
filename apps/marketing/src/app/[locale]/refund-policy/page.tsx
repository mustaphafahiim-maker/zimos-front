import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import { PageShell } from "@/components/page-shell";
import { getLegalDoc } from "@/i18n/pages/legal";
import { pageMetadata, resolveLocale, type LocaleParams } from "@/lib/page";

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const doc = getLegalDoc("refund", locale);
  return pageMetadata(locale, "/refund-policy", doc.title, doc.description);
}

export default async function LegalPage({ params }: { params: LocaleParams }) {
  const locale = await resolveLocale(params);
  return (
    <PageShell locale={locale}>
      <LegalDocument doc={getLegalDoc("refund", locale)} locale={locale} />
    </PageShell>
  );
}
