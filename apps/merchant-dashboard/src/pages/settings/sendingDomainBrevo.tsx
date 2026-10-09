import { useCallback } from "react";
import { IconInfo } from "@/components/icons";
import { Alert } from "@store-builder/ui";
import { sendingDomainProviderChanged, type ApiFieldProblem, type SendingDomain } from "@store-builder/api-client";
import { useErrorMessage, type ErrorOverrides } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";

/**
 * The sending domain on Brevo (handoff item 395), for SendingDomainSection.tsx:
 * the server without an email provider (`available: false`), the provider's
 * refusals, and a domain set up before the switch, which gets its new records
 * from Verify. The two new record purposes are named in that file's own strings.
 */

const STRINGS = {
  en: {
    unavailable: "Sending from your own domain isn't available yet",
    unreachable: "The email service did not answer — try again in a minute",
    providerChanged: "Press Verify to get the new records",
    providerRefused: "The email service can't use this domain — check it is a domain you own, like mystore.com",
  },
  ar: {
    unavailable: "الإرسال من الدومين بتاعك مش متاح حاليًا",
    unreachable: "خدمة الإيميل مردتش — جرّب بعد دقيقة",
    providerChanged: "اضغط تحقق علشان تاخد السجلات الجديدة",
    providerRefused: "خدمة الإيميل مش قادرة تستخدم الدومين ده — اتأكد إنه دومين بتاعك، زي mystore.com",
  },
} satisfies Messages;

/** The section's sentences for the email provider's two refusals; a caller's own overrides win. */
export function useSendingDomainErrorMessage() {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  return useCallback(
    (err: unknown, overrides?: ErrorOverrides): string =>
      errorMessage(err, { EMAIL_DOMAIN_UNAVAILABLE: t.unavailable, EMAIL_DOMAIN_PROVIDER_UNREACHABLE: t.unreachable, ...overrides }),
    [t, errorMessage]
  );
}

/** In place of the add form when the server has no email provider. */
export function SendingDomainUnavailable() {
  const t = useT(STRINGS);
  return (
    <p role="status" className="flex items-start gap-2 rounded-[var(--radius-card)] bg-paper-sunken px-4 py-3 text-sm font-medium text-ink">
      <IconInfo className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden />
      {t.unavailable}
    </p>
  );
}

/** A domain from before the switch to Brevo has no records to show until it is verified again. */
export function sendingDomainNeedsNewRecords(domain: SendingDomain): boolean {
  return sendingDomainProviderChanged(domain) && domain.records.length === 0;
}

export function SendingDomainProviderChangedNote({ domain }: { domain: SendingDomain }) {
  const t = useT(STRINGS);
  if (!sendingDomainNeedsNewRecords(domain)) return null;
  return <Alert>{t.providerChanged}</Alert>;
}

/**
 * What to write under the domain input after a 422 on `domain`. The form has
 * already checked the shape, so the server's own "Enter a domain…" gets our
 * sentence, and anything else — the email provider's reason — is shown as it is.
 */
export function useSendingDomainProblem(): (fields: ApiFieldProblem[], ownSentence: string) => string {
  const t = useT(STRINGS);
  return useCallback(
    (fields, ownSentence) => {
      const message = fields.find((f) => f.field === "domain")?.message?.trim();
      if (!message || /^enter a (valid )?domain/i.test(message)) return ownSentence;
      // The provider's one known refusal (brevoDomainProvider.js) has our own wording.
      return /email service can't use this domain/i.test(message) ? t.providerRefused : message;
    },
    [t]
  );
}
