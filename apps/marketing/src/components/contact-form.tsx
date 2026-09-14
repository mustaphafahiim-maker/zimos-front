"use client";

import { useRef, useState, type FormEvent } from "react";
import type { ContactPageCopy, ContactTopic } from "@/i18n/pages/contact-page";
import { btnPrimary } from "./ui";

type Field = "name" | "email" | "phone" | "storeUrl" | "topic" | "message";
type Values = Record<Field, string>;
type Errors = Partial<Record<Field, string>>;

const EMPTY: Values = { name: "", email: "", phone: "", storeUrl: "", topic: "", message: "" };
const ORDER: Field[] = ["name", "email", "phone", "storeUrl", "topic", "message"];

function validate(v: Values, e: ContactPageCopy["errors"]): Errors {
  const errors: Errors = {};
  if (v.name.trim().length < 2) errors.name = e.name;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) errors.email = e.email;
  if (v.phone.trim() && !/^\+?[\d\s()-]{7,20}$/.test(v.phone.trim())) errors.phone = e.phone;
  if (v.storeUrl.trim()) {
    try {
      const raw = v.storeUrl.trim();
      const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      if (!url.hostname.includes(".")) errors.storeUrl = e.storeUrl;
    } catch {
      errors.storeUrl = e.storeUrl;
    }
  }
  if (!v.topic) errors.topic = e.topic;
  if (v.message.trim().length < 10) errors.message = e.message;
  return errors;
}

/**
 * No backend exists, so a valid submission opens a prefilled `mailto:` to the
 * support address from src/lib/company.ts. Validation is client-side only.
 */
export function ContactForm({
  copy,
  supportEmail,
  emailConfigured,
}: {
  copy: ContactPageCopy;
  supportEmail: string;
  emailConfigured: boolean;
}) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [opened, setOpened] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const f = copy.form;

  const update = (field: Field, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    if (submitted) setErrors(validate(next, copy.errors));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    const found = validate(values, copy.errors);
    setErrors(found);
    const first = ORDER.find((field) => found[field]);
    if (first) {
      setOpened(false);
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }

    const topic = f.topics[values.topic as ContactTopic];
    const lines = [
      `${f.name}: ${values.name.trim()}`,
      `${f.email}: ${values.email.trim()}`,
      values.phone.trim() ? `${f.phone}: ${values.phone.trim()}` : null,
      values.storeUrl.trim() ? `${f.storeUrl}: ${values.storeUrl.trim()}` : null,
      `${f.topic}: ${topic}`,
      "",
      values.message.trim(),
    ].filter((line): line is string => line !== null);

    const href = `mailto:${supportEmail}?subject=${encodeURIComponent(`${f.subjectPrefix} — ${topic}`)}&body=${encodeURIComponent(lines.join("\n"))}`;
    window.location.href = href;
    setOpened(true);
  };

  const hasErrors = submitted && Object.keys(errors).length > 0;
  const input =
    "mt-2 block w-full rounded-lg border bg-paper-raised px-3.5 py-2.5 text-base text-ink placeholder:text-ink-muted transition-colors focus:border-zimos-blue focus:outline-2 focus:outline-zimos-blue/30";
  const border = (field: Field) => (errors[field] ? "border-danger" : "border-line-strong");

  const label = (field: Field, text: string, optional = false) => (
    <label htmlFor={`contact-${field}`} className="block text-sm font-medium text-ink">
      {text}
      {optional ? <span className="font-normal text-ink-soft"> ({f.optional})</span> : null}
    </label>
  );
  const error = (field: Field) =>
    errors[field] ? (
      <p id={`contact-${field}-error`} className="mt-1.5 text-sm text-danger">
        {errors[field]}
      </p>
    ) : null;
  const aria = (field: Field) => ({
    id: `contact-${field}`,
    name: field,
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `contact-${field}-error` : undefined,
  });

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} aria-labelledby="contact-form-heading" className="space-y-5">
      <h2 id="contact-form-heading" className="text-2xl font-bold text-ink">
        {f.heading}
      </h2>
      <p className="text-sm text-ink-soft">{f.requiredHint}</p>

      <div role="alert" aria-live="assertive">
        {hasErrors ? (
          <p className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
            {copy.errors.summary}
          </p>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          {label("name", f.name)}
          <input {...aria("name")} type="text" autoComplete="name" required value={values.name} onChange={(e) => update("name", e.target.value)} className={`${input} ${border("name")}`} />
          {error("name")}
        </div>
        <div>
          {label("email", f.email)}
          <input {...aria("email")} type="email" dir="ltr" autoComplete="email" required value={values.email} onChange={(e) => update("email", e.target.value)} className={`${input} ${border("email")} text-start`} />
          {error("email")}
        </div>
        <div>
          {label("phone", f.phone, true)}
          <input {...aria("phone")} type="tel" dir="ltr" autoComplete="tel" value={values.phone} onChange={(e) => update("phone", e.target.value)} className={`${input} ${border("phone")} text-start`} />
          {error("phone")}
        </div>
        <div>
          {label("storeUrl", f.storeUrl, true)}
          <input {...aria("storeUrl")} type="url" dir="ltr" inputMode="url" autoComplete="url" placeholder="https://" value={values.storeUrl} onChange={(e) => update("storeUrl", e.target.value)} className={`${input} ${border("storeUrl")} text-start`} />
          {error("storeUrl")}
        </div>
      </div>

      <div>
        {label("topic", f.topic)}
        <select {...aria("topic")} required value={values.topic} onChange={(e) => update("topic", e.target.value)} className={`${input} ${border("topic")}`}>
          <option value="" disabled>
            {f.topicPlaceholder}
          </option>
          {(Object.keys(f.topics) as ContactTopic[]).map((key) => (
            <option key={key} value={key}>
              {f.topics[key]}
            </option>
          ))}
        </select>
        {error("topic")}
      </div>

      <div>
        {label("message", f.message)}
        <textarea {...aria("message")} required rows={6} value={values.message} onChange={(e) => update("message", e.target.value)} className={`${input} ${border("message")} resize-y`} />
        {error("message")}
      </div>

      <p className="rounded-lg bg-primary-soft px-4 py-3 text-sm leading-relaxed text-ink-soft">{f.mailtoNote}</p>
      {!emailConfigured ? (
        <p className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">{f.notConfigured}</p>
      ) : null}

      <button type="submit" className={`${btnPrimary} h-12 w-full cursor-pointer px-6 text-base sm:w-auto`}>
        {f.submit}
      </button>

      <div aria-live="polite">
        {opened ? <p className="text-sm text-ink-soft">{f.opened}</p> : null}
      </div>
    </form>
  );
}
