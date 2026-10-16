"use client";

import { ApiError, storeSubmitForm } from "@store-builder/api-client";
import { usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createStorefrontApiClient } from "@/lib/apiClient";

export interface XsContactCopy {
  sending: string;
  sent: string;
  error: string;
  needContact: string;
  invalidPhone: string;
}

/** The page path as the API knows it: without the `/store/<ref>` prefix. */
function pagePathOf(pathname: string, workspaceId: string): string {
  const prefix = `/store/${workspaceId}`;
  const path = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  return path || "/";
}

/**
 * The form of `xs_contact`: one line for an email address or a phone number
 * and a message. It is sent where every page form goes (POST /store/:ws/forms,
 * the store's Contacts inbox), under this element's id so the server can read
 * the form's name from the published page.
 */
export function XsContactForm({
  workspaceId,
  elementId,
  heading,
  contactPlaceholder,
  messagePlaceholder,
  buttonLabel,
  disabled,
  copy,
}: {
  workspaceId: string;
  elementId: string;
  heading: string;
  contactPlaceholder: string;
  messagePlaceholder: string;
  buttonLabel: string;
  disabled: boolean;
  copy: XsContactCopy;
}) {
  const pathname = usePathname() ?? "";
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  // The honeypot: a field no person sees or fills.
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (disabled || state === "sending") return;
    const value = contact.trim();
    if (!value) {
      setError(copy.needContact);
      return;
    }
    const isEmail = value.includes("@");
    setState("sending");
    setError(null);
    try {
      await storeSubmitForm(createStorefrontApiClient(), workspaceId, {
        elementId,
        pagePath: pagePathOf(pathname, workspaceId),
        formName: heading || undefined,
        ...(isEmail ? { email: value } : { phone: value }),
        message: message.trim().slice(0, 4000) || undefined,
        marketingConsent: false,
        website: website || undefined,
      });
      setState("sent");
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      setError(code === "INVALID_PHONE" ? copy.invalidPhone : code === "CONTACT_REQUIRED" ? copy.needContact : copy.error);
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div className="xs-contact__form" role="status">
        {heading ? <h4 className="xs-contact__heading">{heading}</h4> : null}
        <p className="xs-contact__done">{copy.sent}</p>
      </div>
    );
  }

  return (
    <form className="xs-contact__form" onSubmit={submit} noValidate>
      {heading ? <h4 className="xs-contact__heading">{heading}</h4> : null}
      <label className="xs-contact__field">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="1" />
          <path d="m3 7 9 6 9-6" />
        </svg>
        <input type="text" dir="auto" value={contact} onChange={(e) => setContact(e.target.value)} placeholder={contactPlaceholder} aria-label={contactPlaceholder} autoComplete="email" />
      </label>
      <textarea dir="auto" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={messagePlaceholder} aria-label={messagePlaceholder} className="xs-contact__message" />
      <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="xs-contact__trap" />
      {error ? (
        <p className="xs-contact__error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="xs-contact__submit" disabled={disabled || state === "sending"}>
        {state === "sending" ? copy.sending : buttonLabel}
      </button>
    </form>
  );
}
