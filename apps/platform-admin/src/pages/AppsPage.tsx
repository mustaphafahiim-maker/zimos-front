import { ComingLater } from "@/components/ComingLater";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Marketplace apps",
    description: "Integrations merchants can install.",
    summary: "The app marketplace is planned for a later release.",
  },
  ar: {
    title: "تطبيقات السوق",
    description: "تكاملات يمكن للتجار تثبيتها.",
    summary: "سوق التطبيقات مخطط له في إصدار لاحق.",
  },
} satisfies Messages;

export function AppsPage() {
  const t = useT(STRINGS);
  return <ComingLater title={t.title} description={t.description} summary={t.summary} />;
}
