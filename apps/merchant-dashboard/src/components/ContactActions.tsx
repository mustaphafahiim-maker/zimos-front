import { MessageCircle, Phone } from "lucide-react";
import { cn } from "@store-builder/ui";
import { toWhatsAppNumber } from "@/lib/whatsapp";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    call: "Call",
    whatsapp: "WhatsApp",
    callName: "Call {name}",
    whatsappName: "WhatsApp {name}",
  },
  ar: {
    call: "اتصل",
    whatsapp: "واتساب",
    callName: "اتصل بـ {name}",
    whatsappName: "واتساب لـ {name}",
  },
} satisfies Messages;

/** Digits a phone dialer accepts: Arabic-Indic digits folded, spaces and dashes dropped. */
function telHref(phone: string): string {
  const ascii = phone.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  return `tel:${ascii.replace(/[^\d+]/g, "")}`;
}

/**
 * One-tap call and WhatsApp for a customer's phone (docs/ux/05-proposal.md §2:
 * calling a customer is 1 tap). Renders nothing without a phone; the WhatsApp
 * button only when the number can be placed in a country.
 *
 * `size="sm"` for cards and table rows, `"md"` for the order page header.
 */
export function ContactActions({
  phone,
  name,
  size = "sm",
  className,
  onCall,
}: {
  phone: string | null | undefined;
  name?: string | null;
  size?: "sm" | "md";
  className?: string;
  /** Called when the call link is followed (e.g. claim the confirmation task first). */
  onCall?: () => void;
}) {
  const t = useT(STRINGS);
  if (!phone?.trim()) return null;
  const wa = toWhatsAppNumber(phone);
  const who = name?.trim() || phone;
  const base =
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius)] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const sizing = size === "md" ? "h-11 px-4 text-sm" : "h-10 px-3 text-[13px]";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <a
        href={telHref(phone)}
        onClick={onCall}
        aria-label={fmt(t.callName, { name: who })}
        className={cn(base, sizing, "bg-primary-soft text-primary-dark hover:bg-primary hover:text-primary-foreground")}
      >
        <Phone className="size-4" aria-hidden />
        {t.call}
      </a>
      {wa && (
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noreferrer"
          aria-label={fmt(t.whatsappName, { name: who })}
          className={cn(base, sizing, "bg-success-soft text-success hover:bg-success hover:text-paper-raised")}
        >
          <MessageCircle className="size-4" aria-hidden />
          {t.whatsapp}
        </a>
      )}
    </div>
  );
}
