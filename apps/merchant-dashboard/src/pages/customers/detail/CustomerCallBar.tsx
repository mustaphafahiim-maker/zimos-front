import { IconPhone, IconWhatsApp } from "@/components/icons";
import { PageActionBar } from "@/components/PageHeader";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { toWhatsAppNumber } from "@/lib/whatsapp";
import { orderTelHref } from "@/pages/home/today/OrderQuickLook";

const STRINGS = {
  en: {
    bar: "Reach the customer",
    call: "Call",
    whatsapp: "WhatsApp",
    callName: "Call {name}",
    whatsappName: "WhatsApp {name}",
  },
  ar: {
    bar: "كلّم العميل",
    call: "اتصل",
    whatsapp: "واتساب",
    callName: "اتصل بـ {name}",
    whatsappName: "ابعت واتساب لـ {name}",
  },
} satisfies Messages;

// Both are full pills, 44px tall: a press that gives, a visible focus ring. Only scale and colour move.
const PILL =
  "inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none motion-reduce:active:scale-100";

/**
 * The customer page's bar above the dock, on a phone: calling is the main
 * action — the brand fill, most of the width — and WhatsApp stands beside it.
 * The same two links the hero holds from md up (`ContactActions`), where the
 * thumb is. Nothing without a number that can be dialled; WhatsApp only when
 * the number can be placed in a country.
 */
export function CustomerCallBar({ phone, name }: { phone: string | null; name: string | null }) {
  const t = useT(STRINGS);
  if (!phone) return null;
  const whatsapp = toWhatsAppNumber(phone);
  const who = name?.trim() || phone;
  return (
    <PageActionBar>
      <div
        role="group"
        aria-label={t.bar}
        data-slot="customer-callbar"
        className="zimos-customer-callbar flex items-center gap-2 rounded-full bg-paper-raised p-1.5 ring-1 ring-line"
      >
        <a
          href={orderTelHref(phone)}
          aria-label={fmt(t.callName, { name: who })}
          data-slot="customer-call"
          className={`${PILL} flex-1 bg-primary text-primary-foreground`}
        >
          {/* A phone is not a direction: it is never mirrored. */}
          <IconPhone weight="fill" className="size-5 shrink-0" aria-hidden />
          {t.call}
        </a>
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noreferrer"
            aria-label={fmt(t.whatsappName, { name: who })}
            data-slot="contact-whatsapp"
            className={`${PILL} shrink-0 bg-success-soft text-success`}
          >
            <IconWhatsApp weight="fill" className="size-5 shrink-0" aria-hidden />
            {t.whatsapp}
          </a>
        )}
      </div>
    </PageActionBar>
  );
}
