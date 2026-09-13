import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Input, ZimosLogo, cn } from "@store-builder/ui";
import { useLocale, useT } from "@/i18n/LocaleContext";
import { BrandPanel } from "@/components/BrandPanel";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import type { PasswordRule } from "@/lib/passwordRules";

const STRINGS = {
  en: {
    show: "Show password",
    hide: "Hide password",
    backToSignIn: "Back to sign in",
    or: "or",
    google: "Continue with Google",
  },
  ar: {
    show: "إظهار كلمة المرور",
    hide: "إخفاء كلمة المرور",
    backToSignIn: "العودة إلى تسجيل الدخول",
    or: "أو",
    google: "المتابعة باستخدام Google",
  },
};

/** Two-column auth layout: navy brand panel + form column with a language switch. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-paper">
      <BrandPanel />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 px-6 pt-5 lg:justify-end">
          <span className="lg:hidden">
            <ZimosLogo height={28} />
          </span>
          <LanguageSwitch />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function AuthTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h2>
      {subtitle && <p className="mt-2 text-sm text-ink-soft">{subtitle}</p>}
    </div>
  );
}

export function AuthBackLink({ to = "/login", label }: { to?: string; label?: string }) {
  const t = useT(STRINGS);
  return (
    <Link to={to} className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
      <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
      {label ?? t.backToSignIn}
    </Link>
  );
}

/** Brand-coloured Google "G" — an inline SVG so we don't pull in an icon set. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" className="shrink-0" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/** "Continue with Google" button followed by an "or" divider. */
export function GoogleSignIn({ onClick }: { onClick: () => void }) {
  const t = useT(STRINGS);
  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={onClick}
        className="flex h-10 w-full cursor-pointer items-center justify-center gap-2.5 rounded-[10px] border border-line-strong bg-paper-raised px-4 text-sm font-medium text-ink transition-colors hover:border-primary/40 hover:bg-primary-soft/40"
      >
        <GoogleIcon />
        {t.google}
      </button>
      <div className="my-5 flex items-center gap-3 text-xs text-ink-muted">
        <span className="h-px flex-1 bg-line" />
        {t.or}
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder?: string;
  minLength?: number;
  describedBy?: string;
}

/** Password field with a show/hide toggle at the end edge. */
export function PasswordInput({ id, value, onChange, autoComplete, placeholder = "••••••••", minLength, describedBy }: PasswordInputProps) {
  const t = useT(STRINGS);
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pe-10"
        aria-describedby={describedBy}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t.hide : t.show}
        aria-pressed={visible}
        className="absolute inset-y-0 end-0 flex cursor-pointer items-center px-3 text-ink-muted transition-colors hover:text-ink"
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

const RULE_LABELS: Record<"en" | "ar", Record<string, string>> = {
  en: {
    length: "At least 8 characters",
    lower: "One lowercase letter (a–z)",
    upper: "One uppercase letter (A–Z)",
    special: "One special character (!@#$%…)",
  },
  ar: {
    length: "8 أحرف على الأقل",
    lower: "حرف صغير واحد على الأقل (a–z)",
    upper: "حرف كبير واحد على الأقل (A–Z)",
    special: "رمز خاص واحد على الأقل (!@#$%…)",
  },
};

/** Unmet password requirements, labelled in the active language. */
export function PasswordRuleList({ id, rules, className }: { id: string; rules: PasswordRule[]; className?: string }) {
  const { locale } = useLocale();
  return (
    <ul id={id} className={cn("mt-1 space-y-1 text-xs text-ink-soft", className)}>
      {rules.map((rule) => (
        <li key={rule.id} className="flex items-center gap-1.5">
          <span aria-hidden className="size-1 rounded-full bg-ink-muted" />
          {RULE_LABELS[locale][rule.id] ?? rule.label}
        </li>
      ))}
    </ul>
  );
}
