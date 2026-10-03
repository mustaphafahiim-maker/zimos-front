"use client";

import { useId, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { ApiError, storeSubmitForm } from "@store-builder/api-client";
import { btnPrimary, input } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";

export interface PageFormLabels {
  name: string;
  phone: string;
  email: string;
  message: string;
  send: string;
  sending: string;
  sent: string;
  error: string;
  invalidPhone: string;
  needContact: string;
  consent: string;
}

interface PageFormProps {
  workspaceId: string;
  elementId: string;
  title: string;
  submitLabel: string;
  successMessage: string;
  /** Shows the "send me offers" checkbox. */
  askConsent: boolean;
  /** The editor's preview: the form is drawn but does not send. */
  disabled?: boolean;
  labels: PageFormLabels;
}

/** The page path as the API knows it: without the `/store/<ref>` prefix. */
function pagePathOf(pathname: string, workspaceId: string): string {
  const prefix = `/store/${workspaceId}`;
  const path = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  return path || "/";
}

/**
 * A page `form` element. The submit goes to POST /store/:ws/forms; the server
 * reads the element's own tags from the published page, so nothing the
 * shopper's browser sends decides how they are tagged.
 */
export function PageForm({ workspaceId, elementId, title, submitLabel, successMessage, askConsent, disabled, labels }: PageFormProps) {
  const id = useId();
  const pathname = usePathname() ?? "/";
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "", consent: false, website: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (disabled || state === "sending") return;
    if (!form.phone.trim() && !form.email.trim()) {
      setError(labels.needContact);
      return;
    }
    setState("sending");
    setError(null);
    try {
      await storeSubmitForm(createStorefrontApiClient(), workspaceId, {
        elementId,
        pagePath: pagePathOf(pathname, workspaceId),
        formName: title || undefined,
        name: form.name.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        message: form.message.trim() || undefined,
        marketingConsent: form.consent,
        website: form.website || undefined,
      });
      setState("sent");
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      setError(code === "INVALID_PHONE" ? labels.invalidPhone : code === "CONTACT_REQUIRED" ? labels.needContact : labels.error);
      setState("idle");
    }
  }

  const label = "mb-1.5 block text-sm font-medium text-ink";

  return (
    <div className="zt-card rounded-2xl border border-line bg-paper-raised p-6">
      {title.trim() && <h3 className="mb-4 text-xl font-semibold text-ink">{title}</h3>}
      {state === "sent" ? (
        <p role="status" className="rounded-xl bg-primary-soft px-4 py-3 text-sm font-medium text-ink">
          {successMessage || labels.sent}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <label className={label} htmlFor={`${id}-name`}>
              {labels.name}
            </label>
            <input
              id={`${id}-name`}
              type="text"
              autoComplete="name"
              maxLength={200}
              className={input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className={label} htmlFor={`${id}-phone`}>
              {labels.phone}
            </label>
            <input
              id={`${id}-phone`}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              maxLength={32}
              className={input}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className={label} htmlFor={`${id}-email`}>
              {labels.email}
            </label>
            <input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              dir="ltr"
              maxLength={255}
              className={input}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className={label} htmlFor={`${id}-message`}>
              {labels.message}
            </label>
            <textarea
              id={`${id}-message`}
              rows={3}
              maxLength={4000}
              className={input}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </div>
          {/* Honeypot: hidden from people, filled by bots. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute -start-[9999px] size-px opacity-0"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
          />
          {askConsent && (
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
              {labels.consent}
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <button type="submit" disabled={state === "sending"} className={`${btnPrimary} w-full`}>
            {state === "sending" ? labels.sending : submitLabel}
          </button>
        </form>
      )}
    </div>
  );
}
