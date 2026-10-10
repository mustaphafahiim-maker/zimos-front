import { IconWhatsApp, IconPhone } from "@/components/icons";
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
    call: "اتصال",
    whatsapp: "واتساب",
    callName: "اتصال بـ {name}",
    whatsappName: "إرسال رسالة واتساب إلى {name}",
  },
} satisfies Messages;

/** Digits a phone dialer accepts: Arabic-Indic digits folded, spaces and dashes dropped. */
function telHref(phone: string): string {
  const ascii = phone.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  return `tel:${ascii.replace(/[^\d+]/g, "")}`;
}

// Both pills: full radius, a press that gives (0.97), a visible focus ring. Only
// scale and colour move (Tailwind 4 writes scale-* as the `scale` property, so
// that is the one named in the transition).
const PILL =
  "inline-flex shrink-0 items-center justify-center rounded-full font-semibold transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none motion-reduce:active:scale-100";

// A thumb gets the full 44px wherever it is; a mouse gets the compact size
// (36px in rows and cards, 40px in a page header).
const LABELLED = {
  sm: "h-11 gap-1.5 px-4 text-sm pointer-fine:h-9 pointer-fine:px-3.5 pointer-fine:text-[13px]",
  md: "h-11 gap-2 px-5 text-sm pointer-fine:h-10 pointer-fine:px-4",
} as const;
const ICON_ONLY = {
  sm: "size-11 pointer-fine:size-9",
  md: "size-11 pointer-fine:size-10",
} as const;

// On their own (glass off) the pills are the soft token fills, and turn solid
// under the pointer. Under the glass layer (glass/states.css, the two
// data-slots) they are tints over the pane with the deeper ink, 4.5:1 at rest
// and under the pointer.
const CALL = "bg-primary-soft text-primary-dark hover:bg-primary hover:text-primary-foreground";
const WHATSAPP = "bg-success-soft text-success hover:bg-success hover:text-paper-raised";

/**
 * One-tap call and WhatsApp for a customer's phone. Renders nothing without a phone; the WhatsApp
 * button only when the number can be placed in a country.
 *
 * `size="sm"` for cards and table rows, `"md"` for the order page header.
 * `variant="icon"` draws the same two actions as round icon-only buttons, for
 * rows too dense for words; they keep the same accessible names.
 */
export function ContactActions({
  phone,
  name,
  size = "sm",
  variant = "labelled",
  className,
  onCall,
}: {
  phone: string | null | undefined;
  name?: string | null;
  size?: "sm" | "md";
  /** With the words (the default), or two round icon buttons. */
  variant?: "labelled" | "icon";
  className?: string;
  /** Called when the call link is followed (e.g. claim the confirmation task first). */
  onCall?: () => void;
}) {
  const t = useT(STRINGS);
  if (!phone?.trim()) return null;
  const wa = toWhatsAppNumber(phone);
  const who = name?.trim() || phone;
  const iconOnly = variant === "icon";
  const shape = iconOnly ? ICON_ONLY[size] : LABELLED[size];
  const glyph = iconOnly ? "size-5" : "size-4";
  return (
    <div data-slot="contact-actions" className={cn("flex items-center gap-2", className)}>
      <a
        href={telHref(phone)}
        onClick={onCall}
        aria-label={fmt(t.callName, { name: who })}
        title={iconOnly ? t.call : undefined}
        data-slot="contact-call"
        className={cn(PILL, shape, CALL)}
      >
        {/* A phone is not a direction: it is never mirrored. */}
        <IconPhone className={glyph} aria-hidden />
        {!iconOnly && t.call}
      </a>
      {wa && (
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noreferrer"
          aria-label={fmt(t.whatsappName, { name: who })}
          title={iconOnly ? t.whatsapp : undefined}
          data-slot="contact-whatsapp"
          className={cn(PILL, shape, WHATSAPP)}
        >
          <IconWhatsApp className={glyph} aria-hidden />
          {!iconOnly && t.whatsapp}
        </a>
      )}
    </div>
  );
}
