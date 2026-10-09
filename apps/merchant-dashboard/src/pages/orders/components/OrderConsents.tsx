import { checkoutHardeningOrderConsents, type Order } from "@store-builder/api-client";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatDateTime } from "@/lib/format";

const STRINGS = {
  en: {
    marketing: "Agreed to marketing at checkout",
    optedOut: "Ticked marketing at checkout, but had unsubscribed earlier, so wasn't added",
    terms: "Accepted the terms (version {version}) on {date}",
    termsNoVersion: "Accepted the terms on {date}",
  },
  ar: {
    marketing: "وافق على الرسائل التسويقية وقت الطلب",
    optedOut: "وافق وقت الطلب، بس كان لاغي اشتراكه قبل كده فما اتضافش",
    terms: "وافق على الشروط (نسخة {version}) في {date}",
    termsNoVersion: "وافق على الشروط في {date}",
  },
} satisfies Messages;

/**
 * In the order page's customer card: what the buyer agreed to at checkout
 * (handoff 374, `order.consents`) — the marketing box, said differently when
 * they had unsubscribed earlier and so were not added, and the terms with the
 * version they accepted. Nothing for an order whose store showed neither box.
 */
export function OrderConsents({ order }: { order: Order }) {
  const t = useT(STRINGS);
  const consents = checkoutHardeningOrderConsents(order);
  const marketing = consents?.marketing?.accepted ? consents.marketing : null;
  const terms = consents?.terms?.accepted ? consents.terms : null;
  if (!marketing && !terms) return null;
  const version = (terms?.version ?? "").slice(0, 8);
  return (
    <div className="space-y-0.5 text-[13px] leading-5 text-ink-soft" data-order-consents="">
      {marketing && <p>{marketing.applied === false && marketing.reason === "opted_out" ? t.optedOut : t.marketing}</p>}
      {terms && <p>{fmt(version ? t.terms : t.termsNoVersion, { version, date: formatDateTime(terms.at) })}</p>}
    </div>
  );
}
