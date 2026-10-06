import { useT, type Messages } from "@/i18n/LocaleContext";
import { OrderEmailTemplates } from "@/pages/settings/OrderEmailTemplates";

const STRINGS = {
  en: {
    intro: "The emails customers get about orders placed in this funnel. Each one is the store's email until you change it here — then this funnel gets its own version.",
  },
  ar: {
    intro: "الإيميلات اللي العملاء بياخدوها عن الأوردرات اللي جاية من الفانل ده. كل إيميل زي إيميل المتجر لحد ما تغيّره هنا — ساعتها الفانل ياخد نسخة خاصة بيه.",
  },
} satisfies Messages;

/**
 * Funnel → Tests and settings → "Emails" (handoff item 175): the store's
 * order emails as they apply to this funnel, each either the store's or the
 * funnel's own version. The editor opens in place: this tab already sits in
 * a dialog.
 */
export function FunnelEmailsTab({ funnelId }: { funnelId: string }) {
  const t = useT(STRINGS);
  return (
    <div className="space-y-3 pb-2">
      <p className="text-sm text-ink-soft">{t.intro}</p>
      <OrderEmailTemplates scope={{ kind: "funnel", id: funnelId }} editorLayout="inline" />
    </div>
  );
}
