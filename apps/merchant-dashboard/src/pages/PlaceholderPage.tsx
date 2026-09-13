import { Construction } from "lucide-react";
import { useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { body: "This section isn't built yet. It's next on the roadmap." },
  ar: { body: "هذا القسم قيد الإنشاء، وهو التالي في خطة العمل." },
};

export function PlaceholderPage({ title }: { title: string }) {
  const t = useT(STRINGS);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-paper-raised px-6 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Construction className="size-6" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-soft">{t.body}</p>
    </div>
  );
}
