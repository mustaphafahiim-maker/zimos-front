import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { Link } from "react-router-dom";
import { Button, Input, cn } from "@store-builder/ui";
import { IconClose, IconGlobe, IconInfo, IconText } from "@/components/icons";
import {
  COOKIE_CONSENT_LIMITS,
  COOKIE_CONSENT_LOCALES,
  apiFieldProblems,
  cookieConsentGet,
  cookieConsentOf,
  cookieConsentSave,
  isCookiePolicyUrl,
  resolveLegal,
  type CookieConsentLocale,
  type CookieConsentMode,
  type CookieConsentSettings,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { AccordionSection } from "@/components/Accordion";
import { DataState } from "@/components/DataState";
import { Field } from "@/components/Field";
import { SaveBar } from "@/components/SaveBar";
import { Segmented } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { SettingsGroup, SettingsRow } from "@/components/settings";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { GroupBlock, STACK, SettingsSkeleton, TOUCH_FIELDS } from "./sections/parts";

const STRINGS = {
  en: {
    title: "Cookie banner",
    description:
      "Tell shoppers your store uses cookies and, where the law asks for it, wait for their OK before your ad tracking runs.",
    modeLegend: "What shoppers see",
    off: "Off",
    offHint: "No banner. Your store works exactly as it does today.",
    notice: "Notice only",
    noticeHint: "A banner tells shoppers you use cookies, with one button. Your ad pixels run as usual.",
    opt_in: "Ask first",
    opt_inHint: "Your ad pixels, Tag\u00a0Manager and Clarity wait until the shopper taps Accept.",
    optInNote:
      "Shoppers who don't accept are not sent to your ad platforms — not from the browser and not from the server — so your ads will report fewer orders. Your store's own visits and funnel numbers keep counting.",
    countries: "Ask only visitors from",
    countriesHint: "Leave it empty to ask everyone. A visitor whose country we can't tell is asked too.",
    everyone: "Everyone is asked.",
    countriesCount: "{n} countries",
    wordingDefault: "The store's own wording",
    wordingCustom: "Your wording: {languages}",
    addCountry: "Add a country",
    addEurope: "Add European countries",
    removeAll: "Remove all",
    removeCountry: "Remove {name}",
    arabCountries: "Arab countries",
    allCountries: "All countries",
    policy: "Privacy policy link",
    policyHint: "A page of your store (starting with /) or a full link starting with https://. Shown beside the message.",
    policyInvalid: "Use a page of your store starting with / or a link starting with https://.",
    usePolicy: "Use your privacy policy",
    writePolicy: "Write your privacy policy",
    wording: "Banner wording",
    wordingHint: "Leave a box empty to use the wording shown greyed in it.",
    language: "Language",
    ar: "Arabic",
    en: "English",
    fr: "French",
    message: "Message",
    acceptButton: "Accept button",
    okButton: "Button",
    rejectButton: "Reject button",
    count: "{n} of {max} characters",
    preview: "How it looks in your store",
    previewHint: "Shown at the bottom of every page, in your store's colours.",
    save: "Save",
    saving: "Saving…",
    saved: "Cookie banner saved.",
    unsaved: "You have unsaved changes.",
  },
  ar: {
    title: "رسالة الكوكيز",
    description: "عرّف العميل إن متجرك بيستخدم الكوكيز، ولو القانون بيطلب كده استنى موافقته قبل ما تتبّع الإعلانات يشتغل.",
    modeLegend: "العميل يشوف إيه",
    off: "مقفول",
    offHint: "مفيش رسالة. متجرك شغّال زي ما هو بالظبط.",
    notice: "إشعار بس",
    noticeHint: "رسالة بتقول للعميل إنك بتستخدم الكوكيز، بزرار واحد. بيكسلات الإعلانات شغّالة عادي.",
    opt_in: "اسأل الأول",
    // Non-breaking space and spaced «و»: the Latin names never split or reorder across lines.
    opt_inHint: "بيكسلات الإعلانات و Tag\u00a0Manager و Clarity مستنيين لحد ما العميل يدوس «موافق».",
    optInNote:
      "العميل اللي مايوافقش مش بيتبعت لمنصات الإعلانات خالص — لا من المتصفح ولا من السيرفر — فإعلاناتك هتبيّن أوردرات أقل. زيارات متجرك وأرقام مسارات البيع بتتحسب عادي.",
    countries: "اسأل بس الزوار من",
    countriesHint: "سيبها فاضية عشان تسأل كل الزوار. الزائر اللي مش عارفين هو منين بيتسأل برضه.",
    everyone: "كل الزوار بيتسألوا.",
    countriesCount: "{n} بلد",
    wordingDefault: "الكلام الجاهز بتاع المتجر",
    wordingCustom: "كلامك انت: {languages}",
    addCountry: "ضيف بلد",
    addEurope: "ضيف دول أوروبا",
    removeAll: "شيل الكل",
    removeCountry: "شيل {name}",
    arabCountries: "البلاد العربية",
    allCountries: "كل البلاد",
    policy: "لينك سياسة الخصوصية",
    // LRMs keep "/" and "https://" in reading order inside the Arabic sentence.
    policyHint: "صفحة من متجرك بتبدأ بـ \u200e/\u200e أو لينك كامل بيبدأ بـ \u200ehttps://\u200e — بيظهر جنب الرسالة.",
    policyInvalid: "اكتب صفحة من متجرك بتبدأ بـ \u200e/\u200e أو لينك بيبدأ بـ \u200ehttps://\u200e.",
    usePolicy: "استخدم سياسة الخصوصية بتاعتك",
    writePolicy: "اكتب سياسة الخصوصية",
    wording: "كلام الرسالة",
    wordingHint: "سيب الخانة فاضية عشان يظهر الكلام اللي باين فيها بلون فاتح.",
    language: "اللغة",
    ar: "عربي",
    en: "إنجليزي",
    fr: "فرنساوي",
    message: "الرسالة",
    acceptButton: "زرار الموافقة",
    okButton: "الزرار",
    rejectButton: "زرار الرفض",
    count: "{n} من {max} حرف",
    preview: "شكلها في متجرك",
    previewHint: "بتظهر تحت في كل صفحة، بألوان متجرك.",
    save: "حفظ",
    saving: "بنحفظ…",
    saved: "اتحفظت رسالة الكوكيز.",
    unsaved: "عندك تغييرات لسه ما اتحفظتش.",
  },
} satisfies Messages;

/**
 * The storefront's default wording per language (apps/storefront lib/i18n.ts
 * `cookies`): shown greyed in the empty boxes and in the preview. Store
 * content in that language, whatever the dashboard's own language.
 */
const STORE_DEFAULTS: Record<CookieConsentLocale, { message: string; accept: string; reject: string; ok: string; policy: string }> = {
  ar: { message: "بنستخدم الكوكيز عشان نحسّن زيارتك ونقيس إعلاناتنا.", accept: "موافق", reject: "لا شكرًا", ok: "تمام", policy: "سياسة الخصوصية" },
  en: { message: "We use cookies to improve your visit and measure our ads.", accept: "Accept", reject: "Reject", ok: "OK", policy: "Privacy policy" },
  fr: {
    message: "Nous utilisons des cookies pour améliorer votre visite et mesurer nos publicités.",
    accept: "Accepter",
    reject: "Refuser",
    ok: "OK",
    policy: "Politique de confidentialité",
  },
};

const MODES: readonly CookieConsentMode[] = ["off", "notice", "opt_in"];
const PRIVACY_PAGE = "/policies/privacy-policy";

/** The Arab League countries first; then every ISO 3166-1 country (as in the website editor's display rules). */
const ARAB_COUNTRIES = ["EG", "SA", "AE", "KW", "QA", "BH", "OM", "JO", "IQ", "LY", "MA", "DZ", "TN", "LB", "PS", "SD", "YE", "SY", "MR", "SO", "DJ", "KM"];
const ALL_COUNTRIES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ " +
  "DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT " +
  "JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG " +
  "NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH " +
  "TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");
/** The EU, the rest of the EEA, the UK and Switzerland: where a store usually asks first. */
const EUROPE = (
  "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO GB CH"
).split(" ");

type Wording = Record<CookieConsentLocale, { message: string; accept: string; reject: string }>;
interface Draft {
  mode: CookieConsentMode;
  countries: string[];
  policyUrl: string;
  texts: Wording;
}

function toDraft(s: CookieConsentSettings): Draft {
  const texts = {} as Wording;
  for (const l of COOKIE_CONSENT_LOCALES) {
    texts[l] = { message: s.texts[l]?.message ?? "", accept: s.texts[l]?.accept ?? "", reject: s.texts[l]?.reject ?? "" };
  }
  return { mode: s.mode, countries: s.countries ?? [], policyUrl: s.policyUrl ?? "", texts };
}

/** The PUT body: empty boxes and languages left out, so the store's default wording shows. */
function toBody(d: Draft): CookieConsentSettings {
  const texts: CookieConsentSettings["texts"] = {};
  for (const l of COOKIE_CONSENT_LOCALES) {
    const out: Record<string, string> = {};
    for (const key of ["message", "accept", "reject"] as const) {
      const v = d.texts[l][key].trim();
      if (v) out[key] = v;
    }
    if (Object.keys(out).length) texts[l] = out;
  }
  return { mode: d.mode, countries: d.countries.length ? d.countries : null, policyUrl: d.policyUrl.trim() || null, texts };
}

function useCountryName() {
  const { locale } = useLocale();
  return useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      names = null;
    }
    return (code: string) => {
      try {
        return names?.of(code) ?? code;
      } catch {
        return code;
      }
    };
  }, [locale]);
}

/**
 * Store settings → Privacy (frontend-handoff 196): the cookie banner — off
 * (the default, the store as it was), a notice, or "ask first", which holds
 * the ad pixels until the shopper accepts — who is asked, the privacy link
 * and the wording per language. Needs website.edit to read and save; without
 * it the GET answers 403 and DataState draws the no-permission card.
 */
export function PrivacyTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const countryName = useCountryName();
  const { currentWorkspace } = useWorkspace();
  const loaded = useAsync(() => cookieConsentGet(apiClient, workspaceId).then(cookieConsentOf), [workspaceId]);
  const [draft, setDraft] = useState<Draft>(() => toDraft(cookieConsentOf(null)));
  const [lang, setLang] = useState<CookieConsentLocale>("ar");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const ids = { mode: useId(), countries: useId(), countriesHint: useId(), lang: useId(), preview: useId() };

  useEffect(() => {
    if (loaded.data) setDraft(toDraft(loaded.data));
  }, [loaded.data]);

  const dirty = loaded.data ? JSON.stringify(toBody(draft)) !== JSON.stringify(toBody(toDraft(loaded.data))) : false;
  useReportDirty(dirty);
  const hasPrivacyPolicy = !!resolveLegal((currentWorkspace?.settings as Record<string, unknown> | undefined)?.legal).privacy_policy.trim();

  const sortedCountries = useMemo(() => {
    const named = (codes: string[]) => codes.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));
    return { arab: named(ARAB_COUNTRIES), rest: named(ALL_COUNTRIES.filter((c) => !ARAB_COUNTRIES.includes(c))) };
  }, [countryName]);

  const setCountries = (countries: string[]) => setDraft((prev) => ({ ...prev, countries: countries.slice(0, COOKIE_CONSENT_LIMITS.countries) }));
  const setText = (key: "message" | "accept" | "reject", value: string) =>
    setDraft((prev) => ({ ...prev, texts: { ...prev.texts, [lang]: { ...prev.texts[lang], [key]: value } } }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const policy = draft.policyUrl.trim();
    if (policy && !isCookiePolicyUrl(policy)) {
      setPolicyError(t.policyInvalid);
      document.getElementById("cookie-policy-url")?.focus();
      return;
    }
    setPolicyError(null);
    setBusy(true);
    try {
      const saved = cookieConsentOf(await cookieConsentSave(apiClient, workspaceId, toBody(draft)));
      loaded.setData(saved);
      toast.success(t.saved);
    } catch (err) {
      if (apiFieldProblems(err).some((p) => p.field === "policyUrl")) setPolicyError(t.policyInvalid);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const words = draft.texts[lang];
  const defaults = STORE_DEFAULTS[lang];
  const optIn = draft.mode === "opt_in";
  // The languages the merchant wrote something of their own in: the folded row names them.
  const customLanguages = COOKIE_CONSENT_LOCALES.filter((l) => Object.values(draft.texts[l]).some((text) => text.trim() !== ""));

  return (
    <DataState loading={loaded.loading && !loaded.data} error={loaded.error} onRetry={() => void loaded.refresh()} skeleton={<SettingsSkeleton />}>
      <form onSubmit={(e) => void save(e)} noValidate className={STACK}>
        <SettingsGroup title={t.modeLegend} description={t.description}>
          <GroupBlock>
            <fieldset disabled={busy}>
              <legend id={ids.mode} className="sr-only">
                {t.modeLegend}
              </legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {MODES.map((mode) => (
                  <label
                    key={mode}
                    className={cn(
                      "flex min-h-11 cursor-pointer gap-3 rounded-[1rem] border p-3 text-sm transition-colors motion-reduce:transition-none",
                      "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
                      draft.mode === mode ? "border-primary bg-primary-soft/60" : "border-line hover:border-line-strong"
                    )}
                  >
                    <input
                      type="radio"
                      name="cookie-consent-mode"
                      value={mode}
                      checked={draft.mode === mode}
                      onChange={() => setDraft((prev) => ({ ...prev, mode }))}
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">{t[mode]}</span>
                      <span className="mt-0.5 block text-[13px] leading-5 text-ink-soft">{t[`${mode}Hint`]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </GroupBlock>
          {optIn && (
            <GroupBlock>
              <p className="flex items-start gap-2 text-sm text-primary-dark dark:text-primary">
                <IconInfo className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t.optInNote}
              </p>
            </GroupBlock>
          )}

          {draft.mode !== "off" && (
            <SettingsRow
              label={t.policy}
              hint={t.policyHint}
              htmlFor="cookie-policy-url"
              error={policyError ?? undefined}
              stacked
              control={
                <>
                  <Input
                    id="cookie-policy-url"
                    dir="ltr"
                    inputMode="url"
                    autoComplete="off"
                    maxLength={2000}
                    placeholder={`${PRIVACY_PAGE}  ·  https://`}
                    value={draft.policyUrl}
                    aria-invalid={policyError ? true : undefined}
                    onChange={(e) => {
                      setPolicyError(null);
                      setDraft((prev) => ({ ...prev, policyUrl: e.target.value }));
                    }}
                    className={cn("min-h-11 text-start", policyError && "border-danger")}
                  />
                  {hasPrivacyPolicy ? (
                    draft.policyUrl.trim() !== PRIVACY_PAGE && (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 self-start rounded-full px-4"
                        onClick={() => {
                          setPolicyError(null);
                          setDraft((prev) => ({ ...prev, policyUrl: PRIVACY_PAGE }));
                        }}
                      >
                        {t.usePolicy}
                      </Button>
                    )
                  ) : (
                    <Link
                      to="/store-settings/policies"
                      className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {t.writePolicy}
                    </Link>
                  )}
                </>
              }
            />
          )}
        </SettingsGroup>

        {/* Who is asked: only matters for "ask first", and most stores leave it on everyone — folded. */}
        {optIn && (
          <AccordionSection
            title={t.countries}
            icon={IconGlobe}
            summary={draft.countries.length === 0 ? t.everyone : fmt(t.countriesCount, { n: draft.countries.length })}
            persistKey="store-settings:privacy:countries"
            keepMounted
          >
            <div role="group" aria-labelledby={ids.countries} aria-describedby={ids.countriesHint} className="space-y-3">
              <p id={ids.countries} className="sr-only">
                {t.countries}
              </p>
              {draft.countries.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {draft.countries.map((code) => (
                    <li
                      key={code}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft py-0.5 ps-3 pe-0.5 text-sm text-primary-dark dark:text-primary"
                    >
                      {countryName(code)}
                      <button
                        type="button"
                        onClick={() => setCountries(draft.countries.filter((c) => c !== code))}
                        aria-label={fmt(t.removeCountry, { name: countryName(code) })}
                        // 32px to the eye, 44px to the thumb.
                        className="relative inline-flex size-8 cursor-pointer items-center justify-center rounded-full before:absolute before:-inset-1.5 before:content-[''] hover:bg-paper-raised focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <IconClose className="size-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink">{t.everyone}</p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                  aria-label={t.addCountry}
                  value=""
                  className="min-h-11 text-base sm:max-w-xs sm:text-sm"
                  disabled={draft.countries.length >= COOKIE_CONSENT_LIMITS.countries}
                  onChange={(e) => {
                    const code = e.target.value;
                    if (code && !draft.countries.includes(code)) setCountries([...draft.countries, code]);
                  }}
                >
                  <option value="">{t.addCountry}</option>
                  <optgroup label={t.arabCountries}>
                    {sortedCountries.arab.map((c) => (
                      <option key={c.code} value={c.code} disabled={draft.countries.includes(c.code)}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={t.allCountries}>
                    {sortedCountries.rest.map((c) => (
                      <option key={c.code} value={c.code} disabled={draft.countries.includes(c.code)}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                </Select>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 rounded-full px-4"
                    disabled={EUROPE.every((c) => draft.countries.includes(c))}
                    onClick={() => setCountries([...draft.countries, ...EUROPE.filter((c) => !draft.countries.includes(c))])}
                  >
                    {t.addEurope}
                  </Button>
                  {draft.countries.length > 1 && (
                    <Button type="button" variant="ghost" className="min-h-11 rounded-full px-4" onClick={() => setCountries([])}>
                      {t.removeAll}
                    </Button>
                  )}
                </div>
              </div>
              <p id={ids.countriesHint} className="text-[13px] leading-5 text-ink-soft">
                {t.countriesHint}
              </p>
            </div>
          </AccordionSection>
        )}

        {/* The wording per language, with the banner as the shopper gets it. Kept mounted: a fold never drops what was typed. */}
        {draft.mode !== "off" && (
          <AccordionSection
            title={t.wording}
            icon={IconText}
            summary={customLanguages.length === 0 ? t.wordingDefault : fmt(t.wordingCustom, { languages: customLanguages.map((l) => t[l]).join(" · ") })}
            defaultOpen
            persistKey="store-settings:privacy:wording"
            keepMounted
          >
            <fieldset className={`space-y-3 ${TOUCH_FIELDS}`}>
              <legend className="sr-only">{t.wording}</legend>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 flex-1 basis-48 text-[13px] leading-5 text-ink-soft">{t.wordingHint}</p>
                <Segmented
                  label={t.language}
                  size="sm"
                  value={lang}
                  onChange={setLang}
                  options={COOKIE_CONSENT_LOCALES.map((l) => ({ value: l, label: t[l] }))}
                />
              </div>

              <Field label={t.message} hint={fmt(t.count, { n: words.message.length, max: COOKIE_CONSENT_LIMITS.message })}>
                {({ id }) => (
                  <Textarea
                    id={id}
                    lang={lang}
                    dir={lang === "ar" ? "rtl" : "ltr"}
                    rows={3}
                    maxLength={COOKIE_CONSENT_LIMITS.message}
                    placeholder={defaults.message}
                    value={words.message}
                    onChange={(e) => setText("message", e.target.value)}
                  />
                )}
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={optIn ? t.acceptButton : t.okButton}>
                  {({ id }) => (
                    <Input
                      id={id}
                      lang={lang}
                      dir={lang === "ar" ? "rtl" : "ltr"}
                      maxLength={COOKIE_CONSENT_LIMITS.button}
                      placeholder={optIn ? defaults.accept : defaults.ok}
                      value={words.accept}
                      onChange={(e) => setText("accept", e.target.value)}
                    />
                  )}
                </Field>
                {optIn && (
                  <Field label={t.rejectButton}>
                    {({ id }) => (
                      <Input
                        id={id}
                        lang={lang}
                        dir={lang === "ar" ? "rtl" : "ltr"}
                        maxLength={COOKIE_CONSENT_LIMITS.button}
                        placeholder={defaults.reject}
                        value={words.reject}
                        onChange={(e) => setText("reject", e.target.value)}
                      />
                    )}
                  </Field>
                )}
              </div>

              {/* The banner as the shopper gets it, in the language being edited. */}
              <figure aria-labelledby={ids.preview} className="space-y-1.5">
                <figcaption id={ids.preview} className="text-xs text-ink-soft">
                  {t.preview} · {t.previewHint}
                </figcaption>
                <div
                  lang={lang}
                  dir={lang === "ar" ? "rtl" : "ltr"}
                  className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line sm:flex-row sm:items-center"
                >
                  <p className="min-w-0 flex-1 text-sm text-ink">
                    {words.message.trim() || defaults.message}
                    {draft.policyUrl.trim() && (
                      <>
                        {" "}
                        <span className="font-medium text-primary underline underline-offset-2">{defaults.policy}</span>
                      </>
                    )}
                  </p>
                  <div className="flex shrink-0 gap-2" aria-hidden>
                    {optIn && (
                      <span className="inline-flex min-h-10 flex-1 items-center justify-center rounded-[var(--radius)] bg-primary px-4 text-sm font-semibold text-primary-foreground sm:flex-none">
                        {words.reject.trim() || defaults.reject}
                      </span>
                    )}
                    <span className="inline-flex min-h-10 flex-1 items-center justify-center rounded-[var(--radius)] bg-primary px-4 text-sm font-semibold text-primary-foreground sm:flex-none">
                      {words.accept.trim() || (optIn ? defaults.accept : defaults.ok)}
                    </span>
                  </div>
                </div>
              </figure>
            </fieldset>
          </AccordionSection>
        )}

        {/* No onSave: inside the form the bar's button submits it, through the link check above. */}
        <SaveBar
          dirty={dirty}
          saving={busy}
          onDiscard={() => {
            if (loaded.data) setDraft(toDraft(loaded.data));
            setPolicyError(null);
            setError(null);
          }}
          saveLabel={t.save}
          savingLabel={t.saving}
          message={
            error ? (
              <span role="alert" className="text-danger">
                {error}
              </span>
            ) : undefined
          }
        />
      </form>
    </DataState>
  );
}
