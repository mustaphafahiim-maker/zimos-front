import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, Label, cn } from "@store-builder/ui";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ZimosLogo } from "@/components/ZimosLogo";
import { useT, type Messages } from "@/i18n/LocaleContext";

/**
 * The one composition of the screens outside the console — the merchant
 * dashboard's own (its pages/AuthShell.tsx): the wallpaper, the ZIMOS mark at
 * the top, the language switch in the corner and ONE card in the middle with
 * what to do. The frame is `.auth-glass` of the shared theme: a solid card on
 * the page ground, and with the glass layer on, a pane over the aurora.
 *
 * The console keeps its light / dark switch beside the language (it was on
 * the sign-in page before). Nothing here knows about accounts: the page
 * keeps its own calls, redirects and tokens.
 */

const STRINGS = {
  en: { show: "Show password", hide: "Hide password" },
  ar: { show: "إظهار كلمة المرور", hide: "إخفاء كلمة المرور" },
} satisfies Messages;

export function AuthShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="auth-glass">
      <header className="absolute inset-x-0 top-0 z-10 flex h-16 items-center justify-center px-4">
        <ZimosLogo height={30} />
      </header>
      {/* The language can be chosen before signing in, not only from the account menu. */}
      <div data-slot="auth-corner" className="absolute end-3 top-2.5 z-10 flex items-center gap-2">
        <LanguageToggle className="h-11" />
        <ThemeToggle />
      </div>
      <main className="auth-glass-stage">
        <div data-slot="auth-card" className={cn("w-full max-w-[26rem] min-w-0", className)}>
          {children}
        </div>
      </main>
    </div>
  );
}

/** The top of the card: an optional quiet line over it, the title — the page's h1 — and one sentence. */
export function AuthHeading({ title, children, step }: { title: string; children?: ReactNode; step?: ReactNode }) {
  return (
    <div>
      {step && <p className="mb-2 text-xs font-medium text-ink-soft tabular-nums">{step}</p>}
      <h1 className="font-display text-2xl leading-8 font-semibold text-ink sm:text-[1.75rem] sm:leading-9">{title}</h1>
      {children && <p className="mt-2 text-sm leading-6 text-ink-soft">{children}</p>}
    </div>
  );
}

/** 16px at every width, so a phone never zooms into the field. The height comes from `.auth-glass` (46px). */
export const AUTH_INPUT = "text-base md:text-base";
/** The primary button of a card: full width, 48px under the thumb. */
export const AUTH_SUBMIT = "min-h-12 w-full text-base";

interface AuthFieldProps extends Omit<ComponentProps<typeof Input>, "id"> {
  label: string;
  /** A fixed id, when something outside looks the field up. */
  fieldId?: string;
  /** Inside the field, at its end (the eye of a password). */
  trailing?: ReactNode;
}

/** A field of the card: the label above, the input under it. */
export function AuthField({ label, fieldId, trailing, className, ...input }: AuthFieldProps) {
  const auto = useId();
  const id = fieldId ?? auto;
  return (
    <div className="space-y-1.5">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
      </div>
      <div className="relative">
        <Input id={id} {...input} className={cn(AUTH_INPUT, trailing ? "pe-12" : undefined, className)} />
        {trailing}
      </div>
    </div>
  );
}

/** A password: the same field with an eye at its end that shows what was typed. The eye is 44px wide. */
export function AuthPasswordField(props: Omit<AuthFieldProps, "type" | "trailing">) {
  const t = useT(STRINGS);
  const [shown, setShown] = useState(false);
  return (
    <AuthField
      {...props}
      type={shown ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setShown((was) => !was)}
          aria-label={shown ? t.hide : t.show}
          aria-pressed={shown}
          className="absolute inset-y-0 end-0 flex w-12 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none"
        >
          {shown ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      }
    />
  );
}

/** The last lines of a card, in quiet ink. */
export function AuthFooter({ children }: { children: ReactNode }) {
  return <div className="mt-6 text-center text-sm text-ink-soft">{children}</div>;
}
