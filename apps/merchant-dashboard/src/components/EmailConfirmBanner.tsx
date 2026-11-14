import { MailWarning } from "lucide-react";
import { Button } from "@store-builder/ui";
import { useAuth } from "@/context/AuthContext";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { maskEmail, openEmailConfirm } from "@/lib/emailConfirm";

const STRINGS = {
  en: {
    text: "Confirm your email address ({email}) to start a free trial and publish your store.",
    enterCode: "Enter the code",
  },
  ar: {
    text: "أكّد بريدك الإلكتروني ({email}) لتتمكن من بدء الفترة التجريبية المجانية ونشر متجرك.",
    enterCode: "إدخال الرمز",
  },
} satisfies Messages;

/** An address inside a sentence, kept left to right in Arabic text. */
const ltr = (value: string) => `⁦${value}⁩`;

/**
 * "Confirm your email", above every dashboard page and editor while the
 * account's email (or phone) isn't confirmed. It opens the code dialog and
 * goes away by itself once the account is confirmed — here, in another tab
 * or on another device (AuthContext re-reads the account).
 */
export function EmailConfirmBanner() {
  const t = useT(STRINGS);
  const { user, status, confirmed } = useAuth();
  if (status !== "authenticated" || !user || confirmed) return null;

  return (
    <div
      role="status"
      data-testid="email-confirm-banner"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-primary/30 bg-primary-soft px-4 py-3 text-sm text-ink"
    >
      <MailWarning className="size-4 shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 flex-1">{fmt(t.text, { email: ltr(maskEmail(user.email)) })}</p>
      <Button size="sm" className="min-h-11 w-full sm:w-auto" onClick={openEmailConfirm}>
        {t.enterCode}
      </Button>
    </div>
  );
}
