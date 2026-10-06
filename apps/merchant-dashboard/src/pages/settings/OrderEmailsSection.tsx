import { useT, type Messages } from "@/i18n/LocaleContext";
import { OrderEmailSender } from "./OrderEmailSender";
import { SendingDomainSection } from "./SendingDomainSection";
import { OrderEmailTemplates } from "./OrderEmailTemplates";

/**
 * Settings → "Order emails" (SPEC §14.5): the emails customers get about
 * their orders — who they are from (sender name, Reply-To, the store's own
 * sending domain) and the emails themselves (OrderEmailTemplates.tsx): each
 * switched on, written as plain text or designed from blocks, previewed with
 * sample values and sent to yourself as a test. Funnels and websites can
 * have their own versions (item 175), edited from the funnel or website.
 */

const STRINGS = {
  en: {
    title: "Order emails",
    description:
      "Emails your customers get about their orders, sent under your store's name. Each one goes out only when it is switched on and the order has an email address.",
    perFunnel: "A funnel or website can have its own version of each email: open the funnel → Tests and settings → Emails.",
  },
  ar: {
    title: "إيميلات الطلبات",
    description: "الرسائل التي تصل عملاءك بالبريد عن طلباتهم، باسم متجرك. كل رسالة تُرسل فقط إذا كانت مفعّلة وللطلب بريد إلكتروني.",
    perFunnel: "ممكن يبقى لكل مسار بيع أو موقع نسخة خاصة من كل إيميل: افتح مسار البيع ← الاختبارات والإعدادات ← الإيميلات.",
  },
} satisfies Messages;

export function OrderEmailsSection() {
  const t = useT(STRINGS);
  return (
    <section id="order-emails" className="scroll-mt-6 rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
      {/* The sender name and Reply-To (OrderEmailSender.tsx). */}
      <OrderEmailSender />
      {/* The store's own From domain (SendingDomainSection.tsx, item 173). */}
      <SendingDomainSection />

      <div className="mt-4">
        <OrderEmailTemplates />
      </div>
      <p className="mt-2 text-xs text-ink-soft">{t.perFunnel}</p>
    </section>
  );
}
