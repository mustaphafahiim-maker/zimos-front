import { ComingLater } from "@/components/ComingLater";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Suppliers",
    description: "Fulfilment partners applying to the network.",
    summary: "The supplier network and its approval queue are planned for a later release.",
  },
  ar: {
    title: "الموردون",
    description: "شركاء التوريد المتقدّمون للانضمام إلى الشبكة.",
    summary: "شبكة الموردين وقائمة الموافقة عليها مخطط لهما في إصدار لاحق.",
  },
} satisfies Messages;

export function SuppliersPage() {
  const t = useT(STRINGS);
  return <ComingLater title={t.title} description={t.description} summary={t.summary} />;
}
