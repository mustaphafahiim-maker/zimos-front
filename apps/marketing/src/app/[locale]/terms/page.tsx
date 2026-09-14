import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import { PageShell } from "@/components/page-shell";
import { getLegalDoc } from "@/i18n/pages/legal";
import { pageMetadata, resolveLocale, type LocaleParams } from "@/lib/page";

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const doc = getLegalDoc("terms", locale);
  return pageMetadata(locale, "/terms", doc.title, doc.description);
}

export default async function LegalPage({ params }: { params: LocaleParams }) {
  const locale = await resolveLocale(params);
  return (
    <PageShell locale={locale}>
      <LegalDocument doc={getLegalDoc("terms", locale)} locale={locale} />
    </PageShell>
  );
}
