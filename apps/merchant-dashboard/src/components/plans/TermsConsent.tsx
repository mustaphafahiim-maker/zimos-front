import { useId } from "react";
import { IconExternal } from "@/components/icons";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { legalUrl } from "@/lib/legalLinks";

const STRINGS = {
  en: {
    before: "I agree to the",
    terms: "Terms of Service",
    comma: ",",
    refund: "Refund Policy",
    and: "and",
    privacy: "Privacy Policy",
    newTab: "(opens in a new tab)",
    required: "Agree to the terms to continue.",
  },
  ar: {
    before: "أوافق على",
    terms: "شروط الاستخدام",
    comma: "،",
    refund: "سياسة الاسترجاع",
    and: "و",
    privacy: "سياسة الخصوصية",
    newTab: "(تُفتح في علامة تبويب جديدة)",
    required: "وافق على الشروط للمتابعة.",
  },
} satisfies Messages;

/**
 * "I agree to the terms, the refund policy and the privacy policy" — each a
 * link to the marketing site, in a new tab. Required on the sign-up form.
 */
export function TermsConsent({
  checked,
  onChange,
  showError,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  showError?: boolean;
  disabled?: boolean;
}) {
  const t = useT(STRINGS);
  const id = useId();
  const errorId = `${id}-error`;
  const link = (href: string, label: string) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 font-medium text-primary underline underline-offset-2"
    >
      {label}
      <IconExternal className="size-3" aria-hidden />
      <span className="sr-only">{t.newTab}</span>
    </a>
  );
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          required
          aria-invalid={showError && !checked ? true : undefined}
          aria-describedby={showError && !checked ? errorId : undefined}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--color-primary)]"
        />
        <label htmlFor={id} className="text-sm leading-relaxed text-ink-soft">
          {t.before} {link(legalUrl("terms"), t.terms)}
          {t.comma} {link(legalUrl("refund-policy"), t.refund)} {t.and}
          {t.and.length > 1 ? " " : ""}
          {link(legalUrl("privacy"), t.privacy)}
        </label>
      </div>
      {showError && !checked && (
        <p id={errorId} className="mt-1 text-xs text-danger" role="alert">
          {t.required}
        </p>
      )}
    </div>
  );
}
