import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { IconEdit } from "@/components/icons";
import { Button, Input, Spinner, cn } from "@store-builder/ui";
import {
  ApiError,
  apiFieldProblems,
  domainRegistrantGet,
  isApiErrorCode,
  type DomainOwnerContact,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { type ErrorOverrides } from "@/lib/errorMessages";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { useDomainErrorMessage } from "./domainRules";

/**
 * Store settings → Domains → "Buy a domain" → the buy dialog's «صاحب الدومين»
 * step (handoff item 326), and the sentences for what the registrar can answer
 * a purchase or a renewal with (items 325, 326).
 *
 * The step exists only where the registrar needs the owner's details
 * (`required` — false in the sandbox, where the dialog stays as it was). The
 * details saved by an earlier purchase come back as a summary with «تعديل»;
 * the first time the form starts from the account's own name, email and phone.
 */

const STRINGS = {
  en: {
    title: "Domain owner",
    fullName: "Full name",
    organization: "Company (optional)",
    email: "Email",
    phone: "Country code + phone",
    phoneHint: "The number without the leading 0.",
    address1: "Address",
    address2: "Address line 2 (optional)",
    city: "City",
    state: "Governorate / State",
    postalCode: "Postal code",
    country: "Country",
    note: "The domain is registered in your name and you own it. You'll get an email from the domain authority to confirm your address — confirm it within 15 days or the domain is suspended.",
    edit: "Edit",
    next: "Next",
    back: "Back",
    loading: "Loading…",
    required: "This field is needed",
    badEmail: "Enter a valid email",
    badPhone: "Enter the number in digits (4 to 14), without the country code or the leading 0",
    badPostal: "2 to 20 English letters or digits",
    tooLong: "Too long",
    checkField: "Check this field",
    DOMAIN_CONTACT_REQUIRED: "Add the domain owner's details",
    REGISTRAR_REFUSED: "The domain registrar refused — check the details and try again",
    REGISTRAR_UNAVAILABLE: "The domain registrar isn't answering — try again shortly",
    DOMAIN_PRICE_UNAVAILABLE: "This domain's price isn't available right now — try again in a bit",
  },
  ar: {
    title: "صاحب الدومين",
    fullName: "الاسم بالكامل",
    organization: "اسم الشركة (اختياري)",
    email: "الإيميل",
    phone: "كود الدولة + الموبايل",
    phoneHint: "الرقم من غير الصفر اللي في الأول.",
    address1: "العنوان",
    address2: "تكملة العنوان (اختياري)",
    city: "المدينة",
    state: "المحافظة",
    postalCode: "الرقم البريدي",
    country: "الدولة",
    note: "الدومين هيتسجل باسمك وانت صاحبه. هيوصلك إيميل من الجهة المسؤولة عن الدومينات لتأكيد الإيميل — لازم تأكده خلال 15 يوم وإلا الدومين يتوقف.",
    edit: "تعديل",
    next: "التالي",
    back: "رجوع",
    loading: "بيحمّل…",
    required: "الخانة دي مطلوبة",
    badEmail: "اكتب إيميل صحيح",
    badPhone: "اكتب الرقم أرقام بس (من 4 لـ 14)، من غير كود الدولة ولا الصفر اللي في الأول",
    badPostal: "من 2 لـ 20 حرف إنجليزي أو رقم",
    tooLong: "طويل زيادة",
    checkField: "راجع الخانة دي",
    DOMAIN_CONTACT_REQUIRED: "أضف بيانات صاحب الدومين",
    REGISTRAR_REFUSED: "شركة الدومينات رفضت الطلب — راجع البيانات وجرّب تاني",
    REGISTRAR_UNAVAILABLE: "شركة الدومينات مش بترد دلوقتي — جرّب كمان شوية",
    DOMAIN_PRICE_UNAVAILABLE: "سعر الدومين مش متاح دلوقتي — جرّب كمان شوية",
  },
} satisfies Messages;

type T = (typeof STRINGS)["en"];

/** The server's English, shown as it is beside our own sentence, kept left-to-right. */
const ARABIC_LETTER = /[؀-ۿ]/;

/**
 * The sentences of a purchase or a renewal: the domain codes of
 * domainRules.tsx, plus the registrar's and the price's (items 325, 326).
 * A refusal carries the registrar's own reason, which follows our sentence.
 */
export function useDomainPurchaseErrorMessage() {
  const t = useT(STRINGS);
  const errorMessage = useDomainErrorMessage();
  return useCallback(
    (err: unknown, overrides?: ErrorOverrides): string => {
      const text = errorMessage(err, {
        DOMAIN_CONTACT_REQUIRED: t.DOMAIN_CONTACT_REQUIRED,
        REGISTRAR_REFUSED: t.REGISTRAR_REFUSED,
        REGISTRAR_UNAVAILABLE: t.REGISTRAR_UNAVAILABLE,
        DOMAIN_PRICE_UNAVAILABLE: t.DOMAIN_PRICE_UNAVAILABLE,
        ...overrides,
      });
      if (isApiErrorCode(err, "REGISTRAR_REFUSED") && err instanceof ApiError && err.message && !ARABIC_LETTER.test(err.message)) {
        return `${text} (⁦${err.message}⁩)`;
      }
      return text;
    },
    [t, errorMessage]
  );
}

// Calling codes of the countries offered; the names come from the browser (Intl.DisplayNames).
const DIAL: Record<string, string> = {
  EG: "20", SA: "966", AE: "971", KW: "965", QA: "974", BH: "973", OM: "968", JO: "962", LB: "961", IQ: "964",
  SY: "963", PS: "970", YE: "967", LY: "218", TN: "216", DZ: "213", MA: "212", SD: "249", MR: "222", SO: "252",
  DJ: "253", KM: "269", TR: "90", US: "1", CA: "1", GB: "44", DE: "49", FR: "33", IT: "39", ES: "34",
  NL: "31", BE: "32", CH: "41", AT: "43", SE: "46", NO: "47", DK: "45", FI: "358", IE: "353", PT: "351",
  GR: "30", PL: "48", RO: "40", RU: "7", UA: "380", IN: "91", PK: "92", BD: "880", ID: "62", MY: "60",
  SG: "65", PH: "63", CN: "86", JP: "81", KR: "82", AU: "61", NZ: "64", ZA: "27", NG: "234", KE: "254",
  ET: "251", GH: "233", BR: "55", MX: "52", AR: "54",
};
// The Arab countries first, in the order above; the rest follow by name.
const ARAB_FIRST = 22;

type FormKey = "fullName" | "organization" | "email" | "phone" | "address1" | "address2" | "city" | "state" | "postalCode" | "country";
type Form = Record<FormKey, string>;
type Errors = Partial<Record<FormKey, string>>;

const EMPTY: Form = { fullName: "", organization: "", email: "", phone: "", address1: "", address2: "", city: "", state: "", postalCode: "", country: "EG" };

/** "+20 0100 123 4567" → "1001234567": digits only, without the country's code or the leading 0. */
function nationalNumber(raw: string, dial: string): string {
  let digits = raw.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/\D/g, "");
  if (raw.trim().startsWith("+") && digits.startsWith(dial)) digits = digits.slice(dial.length);
  else if (digits.startsWith("00" + dial)) digits = digits.slice(dial.length + 2);
  return digits.replace(/^0+/, "");
}

function formOf(contact: DomainOwnerContact): Form {
  return {
    fullName: contact.fullName ?? "",
    organization: contact.organization ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    address1: contact.address1 ?? "",
    address2: contact.address2 ?? "",
    city: contact.city ?? "",
    state: contact.state ?? "",
    postalCode: contact.postalCode ?? "",
    country: (contact.country ?? "EG").toUpperCase(),
  };
}

/** The server's own rules (domains/purchases.js CONTACT), checked here first for a sentence in the merchant's language. */
function validate(t: T, form: Form): { errors: Errors; contact: DomainOwnerContact | null } {
  const errors: Errors = {};
  const v = (key: FormKey) => form[key].trim();
  const need = (key: FormKey, max: number) => {
    if (v(key).length < 2) errors[key] = t.required;
    else if (v(key).length > max) errors[key] = t.tooLong;
  };
  need("fullName", 100);
  need("address1", 100);
  need("city", 60);
  need("state", 60);
  if (v("organization").length > 100) errors.organization = t.tooLong;
  if (v("address2").length > 100) errors.address2 = t.tooLong;
  if (!v("email")) errors.email = t.required;
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v("email")) || v("email").length > 150) errors.email = t.badEmail;
  const dial = DIAL[form.country] ?? "";
  const phone = nationalNumber(form.phone, dial);
  if (!form.phone.trim()) errors.phone = t.required;
  else if (!/^\d{4,14}$/.test(phone)) errors.phone = t.badPhone;
  if (!v("postalCode")) errors.postalCode = t.required;
  else if (!/^[A-Za-z0-9 -]{2,20}$/.test(v("postalCode"))) errors.postalCode = t.badPostal;
  if (!dial) errors.country = t.required;
  if (Object.keys(errors).length > 0) return { errors, contact: null };
  return {
    errors,
    contact: {
      fullName: v("fullName"),
      ...(v("organization") ? { organization: v("organization") } : {}),
      email: v("email"),
      phoneCountryCode: dial,
      phone,
      address1: v("address1"),
      ...(v("address2") ? { address2: v("address2") } : {}),
      city: v("city"),
      state: v("state"),
      postalCode: v("postalCode"),
      country: form.country,
    },
  };
}

export interface DomainOwnerStep {
  /** The registrar needs the owner's details: the dialog gets a second step. */
  required: boolean;
  /** Still asking the server whether it does. */
  loading: boolean;
  /** The dialog shows the step now. */
  onStep: boolean;
  begin: () => void;
  back: () => void;
  /**
   * What to send with the purchase: the typed details, or nothing (the saved
   * ones are used, or none are needed). `ok: false` = the form has mistakes,
   * now shown under their fields.
   */
  contact: () => { ok: true; contact?: DomainOwnerContact } | { ok: false };
  /** A failed purchase: true when it was about the owner's details — the step opens on its form with the reason. */
  refused: (err: unknown) => boolean;
  labels: { next: string; back: string };
  node: ReactNode;
}

export function useDomainOwnerStep({ busy }: { busy: boolean }): DomainOwnerStep {
  const t = useT(STRINGS);
  const { intlLocale } = useLocale();
  const workspaceId = useWorkspaceId();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  // A failed read is not a reason to stop a purchase: the server still says DOMAIN_CONTACT_REQUIRED when it needs them.
  const registrant = useAsync(() => domainRegistrantGet(apiClient, workspaceId).catch(() => null), [workspaceId]);
  const saved = registrant.data?.contact ?? null;
  const [forced, setForced] = useState(false);
  const [onStep, setOnStep] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const required = forced || registrant.data?.required === true;

  // Once the saved details (or their absence) are known: the summary, or a form started from the account.
  useEffect(() => {
    if (registrant.loading) return;
    if (saved) {
      setForm(formOf(saved));
      setEditing(false);
    } else {
      const dial = DIAL.EG;
      setForm({
        ...EMPTY,
        fullName: user?.fullName ?? "",
        organization: currentWorkspace?.name ?? "",
        email: user?.email ?? "",
        phone: user?.phone ? nationalNumber(user.phone, dial) : "",
      });
      setEditing(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filled once, when the read settles
  }, [registrant.loading, saved]);

  const countries = useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([intlLocale], { type: "region" });
    } catch {
      /* an old browser: the codes stand in */
    }
    const all = Object.keys(DIAL).map((code) => ({ code, dial: DIAL[code], name: names?.of(code) ?? code }));
    const rest = all.slice(ARAB_FIRST).sort((a, b) => a.name.localeCompare(b.name, intlLocale));
    return [...all.slice(0, ARAB_FIRST), ...rest];
  }, [intlLocale]);

  const set = (key: FormKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const contact: DomainOwnerStep["contact"] = () => {
    if (!required) return { ok: true };
    if (saved && !editing) return { ok: true };
    const result = validate(t, form);
    setErrors(result.errors);
    setFormError(null);
    if (!result.contact) {
      setOnStep(true);
      return { ok: false };
    }
    return { ok: true, contact: result.contact };
  };

  const refused: DomainOwnerStep["refused"] = (err) => {
    const fields = apiFieldProblems(err).filter((p) => p.field === "contact" || p.field.startsWith("contact."));
    const missing = isApiErrorCode(err, "DOMAIN_CONTACT_REQUIRED");
    if (!missing && fields.length === 0) return false;
    const next: Errors = {};
    for (const problem of fields) {
      const key = problem.field.slice("contact.".length);
      if (key === "phoneCountryCode") next.country = t.checkField;
      else if (key in EMPTY) next[key as FormKey] = key === "phone" ? t.badPhone : key === "email" ? t.badEmail : key === "postalCode" ? t.badPostal : t.checkField;
    }
    setErrors(next);
    setFormError(Object.keys(next).length === 0 ? t.DOMAIN_CONTACT_REQUIRED : null);
    setForced(true);
    setEditing(true);
    setOnStep(true);
    return true;
  };

  const dial = DIAL[form.country] ?? "";
  const text = (key: Exclude<FormKey, "phone" | "country">, extra: { dir?: "ltr"; autoComplete?: string; type?: string; inputMode?: "email" | "text"; maxLength: number; required?: boolean }) => (
    <TextField
      label={t[key]}
      error={errors[key]}
      value={form[key]}
      disabled={busy}
      onChange={(e) => set(key, e.target.value)}
      {...extra}
    />
  );

  const node = registrant.loading ? (
    <p role="status" className="flex items-center gap-2 text-sm text-ink-soft">
      <Spinner className="size-4" aria-hidden />
      {t.loading}
    </p>
  ) : (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
      {saved && !editing ? (
        <div className="flex items-start justify-between gap-3 rounded-[var(--radius-card)] bg-paper-sunken px-4 py-3">
          <div className="min-w-0 space-y-0.5 text-sm text-ink">
            <p className="font-medium">
              {saved.fullName}
              {saved.organization && <span className="font-normal text-ink-soft"> · {saved.organization}</span>}
            </p>
            <p>
              <bdi dir="ltr">{saved.email}</bdi>
            </p>
            <p>
              <bdi dir="ltr">
                +{saved.phoneCountryCode} {saved.phone}
              </bdi>
            </p>
            <p className="text-ink-soft">
              {[saved.address1, saved.address2, saved.city, saved.state, saved.postalCode, countries.find((c) => c.code === saved.country)?.name ?? saved.country]
                .filter(Boolean)
                .join("، ")}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="min-h-11 shrink-0 sm:min-h-8" disabled={busy} onClick={() => setEditing(true)}>
            <IconEdit className="size-4" aria-hidden />
            {t.edit}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {text("fullName", { autoComplete: "name", maxLength: 100, required: true })}
          {text("organization", { autoComplete: "organization", maxLength: 100 })}
          {text("email", { dir: "ltr", type: "email", inputMode: "email", autoComplete: "email", maxLength: 150, required: true })}
          <Field label={t.country} error={errors.country} required>
            {({ id }) => (
              <Select id={id} value={form.country} disabled={busy} autoComplete="country" onChange={(e) => set("country", e.target.value)} className="min-h-11 sm:min-h-10">
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} (+{c.dial})
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t.phone} error={errors.phone} hint={t.phoneHint} required className="sm:col-span-2">
            {({ id, ...aria }) => (
              <div dir="ltr" className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 rounded-[var(--radius)] bg-paper-sunken px-3 py-2 text-sm tabular-nums text-ink">+{dial}</span>
                <Input
                  id={id}
                  {...aria}
                  dir="ltr"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  maxLength={20}
                  placeholder="1001234567"
                  value={form.phone}
                  disabled={busy}
                  onChange={(e) => set("phone", e.target.value)}
                  className={cn("min-w-0", errors.phone && "border-danger focus-visible:ring-danger/30")}
                />
              </div>
            )}
          </Field>
          <div className="sm:col-span-2">{text("address1", { autoComplete: "address-line1", maxLength: 100, required: true })}</div>
          <div className="sm:col-span-2">{text("address2", { autoComplete: "address-line2", maxLength: 100 })}</div>
          {text("city", { autoComplete: "address-level2", maxLength: 60, required: true })}
          {text("state", { autoComplete: "address-level1", maxLength: 60, required: true })}
          {text("postalCode", { dir: "ltr", autoComplete: "postal-code", maxLength: 20, required: true })}
        </div>
      )}
      {formError && <p className="text-sm font-medium text-danger">{formError}</p>}
      <p className="text-xs leading-5 text-ink-soft">{t.note}</p>
    </div>
  );

  return {
    required,
    loading: registrant.loading,
    onStep: required && onStep,
    begin: () => setOnStep(true),
    back: () => setOnStep(false),
    contact,
    refused,
    labels: { next: t.next, back: t.back },
    node,
  };
}
