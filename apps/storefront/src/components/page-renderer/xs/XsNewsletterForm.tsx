"use client";

import { ApiError, storeSubmitForm } from "@store-builder/api-client";
import { usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createStorefrontApiClient } from "@/lib/apiClient";

export interface XsNewsletterCopy {
  sending: string;
  sent: string;
  error: string;
  needEmail: string;
}

/** The page path as the API knows it: without the `/store/<ref>` prefix. */
function pagePathOf(pathname: string, workspaceId: string): string {
  const prefix = `/store/${workspaceId}`;
  const path = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  return path || "/";
}

/**
 * The one-line sign-up of `xs_newsletter`. The address is filed where every
 * page form goes (POST /store/:ws/forms — the store's Contacts), under this
 * element's id and with the shopper's consent to hear from the store, which
 * is what typing an address into a newsletter box and pressing the button is.
 */
export function XsNewsletterForm({
  workspaceId,
  elementId,
  formName,
  placeholder,
  buttonLabel,
  disabled,
  copy,
}: {
  workspaceId: string;
  elementId: string;
  formName: string;
  placeholder: string;
  buttonLabel: string;
  disabled: boolean;
  copy: XsNewsletterCopy;
}) {
  const pathname = usePathname() ?? "";
  const [email, setEmail] = useState("");
  // The honeypot: a field no person sees or fills.
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (disabled || state === "sending") return;
    const value = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setError(copy.needEmail);
      return;
    }
    setState("sending");
    setError(null);
    try {
      await storeSubmitForm(createStorefrontApiClient(), workspaceId, {
        elementId,
        pagePath: pagePathOf(pathname, workspaceId),
        formName: formName || undefined,
        email: value,
        marketingConsent: true,
        website: website || undefined,
      });
      setState("sent");
    } catch (err) {
      setError(err instanceof ApiError && err.code === "CONTACT_REQUIRED" ? copy.needEmail : copy.error);
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <p className="xs-newsletter__done" role="status">
        {copy.sent}
      </p>
    );
  }

  return (
    <form className="xs-newsletter__form" onSubmit={submit} noValidate>
      <input type="email" dir="auto" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={placeholder} aria-label={placeholder} autoComplete="email" />
      <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="xs-contact__trap" />
      <button type="submit" disabled={disabled || state === "sending"}>
        {state === "sending" ? copy.sending : buttonLabel}
      </button>
      {error ? (
        <p className="xs-newsletter__error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
