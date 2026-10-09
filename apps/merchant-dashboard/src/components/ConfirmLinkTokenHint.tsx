import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    name: "Order confirmation link",
    hint: "Empty when the option is off or the order isn't waiting for confirmation",
  },
  ar: {
    name: "لينك تأكيد الطلب",
    hint: "فاضي لو الخاصية مقفولة أو الطلب مش مستني تأكيد",
  },
} satisfies Messages;

/**
 * What `{{confirm_link}}` is, under a message's variable chips (handoff 388):
 * the link a shopper confirms a cash-on-delivery order from. Shown only where
 * the editor's own variable list offers it (SMS, email and WhatsApp steps of
 * an automation, and the order emails).
 */
export function ConfirmLinkTokenHint({ tokens, className = "" }: { tokens: readonly string[]; className?: string }) {
  const t = useT(STRINGS);
  if (!tokens.includes("confirm_link")) return null;
  return (
    <p className={`text-xs leading-5 text-ink-soft ${className}`.trimEnd()}>
      <bdi dir="ltr" className="font-mono text-ink">
        {"{{confirm_link}}"}
      </bdi>{" "}
      — {t.name}. {t.hint}.
    </p>
  );
}
