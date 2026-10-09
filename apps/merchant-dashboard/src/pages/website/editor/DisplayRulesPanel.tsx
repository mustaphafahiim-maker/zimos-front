import { useMemo, useState } from "react";
import { IconClose, IconDesktop, IconFilter, IconPhoneDevice, IconTablet } from "@/components/icons";
import { Button, Input, cn } from "@store-builder/ui";
import {
  DISPLAY_DEVICES,
  DISPLAY_RULE_LIMITS,
  DISPLAY_UTM_KEYS,
  displayRulesOf,
  type DisplayDevice,
  type DisplayUtmKey,
  type ElementDisplayRules,
  type PageElement,
} from "@store-builder/api-client";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { TagListField } from "@/components/TagListField";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";

/**
 * The element panel's "Display" tab (handoff 191): when an element shows —
 * between two dates, on some devices, in some countries, or only for visitors
 * from some campaign sources. Stored as `element.settings.visibility` beside
 * the element's style and saved with the page or funnel step as today; the
 * contract (keys, limits, how it is checked) is in the api-client's
 * endpoints/displayRules.ts.
 *
 * The backend leaves elements outside their dates out of the public page;
 * the storefront applies the device, country and UTM rules for each visitor.
 * The builder's preview shows every element, with a «Rules» badge on the
 * ones that have any.
 */

const STRINGS = {
  en: {
    title: "Display rules",
    intro: "This element shows only when every rule below matches. Without rules it shows to everyone.",
    showBetween: "Show between",
    and: "and",
    clearDate: "Clear this date",
    timeHint: "On the store's clock ({zone}). Leave one empty for no start or no end.",
    untilBeforeFrom: "Must be after the start.",
    devices: "Devices",
    mobile: "Mobile",
    tablet: "Tablet",
    desktop: "Desktop",
    devicesHint: "Turn a device off to hide the element there. Phones are under 640 px wide, tablets under 1024 px.",
    lastDevice: "Keep at least one device on.",
    countries: "Countries",
    everywhere: "Everywhere",
    include: "Only in these countries",
    exclude: "Everywhere except",
    addCountry: "Add a country",
    arabCountries: "Arab countries",
    allCountries: "All countries",
    removeCountry: "Remove {name}",
    pickCountry: "Pick at least one country — until then this rule is off.",
    includeHint: "Visitors whose country can't be told don't see it.",
    utmSource: "Only for visitors from (UTM source)",
    utmMedium: "Traffic type (UTM medium)",
    utmCampaign: "Campaign (UTM campaign)",
    utmHint: "The value in your ad link, e.g. facebook for utm_source=facebook. Any one of them matches; capital letters don't matter.",
    clear: "Clear rules",
    previewNote: "The preview shows every element; the ones with rules carry a «Rules» badge.",
    rules: "Rules",
    chip: "Display rules: {summary}",
    chipInvalid: "Check the display rules",
    from: "from {date}",
    until: "until {date}",
    only: "only in {list}",
    except: "except {list}",
    more: "{list} +{n}",
    viaSource: "from {list}",
    viaMedium: "medium {list}",
    viaCampaign: "campaign {list}",
    joiner: ", ",
  },
  ar: {
    title: "شروط الظهور",
    intro: "العنصر ده بيظهر بس لما كل الشروط اللي تحت تتحقق. من غير شروط بيظهر للكل.",
    showBetween: "يظهر في الفترة من",
    and: "لحد",
    clearDate: "امسح التاريخ ده",
    timeHint: "بتوقيت المتجر ({zone}). سيب أي واحد فاضي لو مفيش بداية أو نهاية.",
    untilBeforeFrom: "لازم يكون بعد تاريخ البداية.",
    devices: "الأجهزة",
    mobile: "موبايل",
    tablet: "تابلت",
    desktop: "كمبيوتر",
    devicesHint: "اقفل جهاز عشان العنصر يستخبى عليه. الموبايل عرضه أقل من 640px، والتابلت أقل من 1024px.",
    lastDevice: "لازم يفضل جهاز واحد على الأقل.",
    countries: "البلاد",
    everywhere: "في كل مكان",
    include: "في البلاد دي بس",
    exclude: "في كل مكان ماعدا",
    addCountry: "ضيف بلد",
    arabCountries: "البلاد العربية",
    allCountries: "كل البلاد",
    removeCountry: "شيل {name}",
    pickCountry: "اختار بلد واحدة على الأقل — لحد ما تختار، الشرط ده مش شغّال.",
    includeHint: "الزوار اللي مش معروف هم من أنهي بلد مش هيشوفوه.",
    utmSource: "للزوار اللي جايين من (UTM source)",
    utmMedium: "نوع الزيارة (UTM medium)",
    utmCampaign: "الحملة (UTM campaign)",
    utmHint: "القيمة اللي في لينك إعلانك، مثلًا facebook لـ utm_source=facebook. أي قيمة منهم تكفي، والحروف الكبيرة زي الصغيرة.",
    clear: "امسح الشروط",
    previewNote: "المعاينة بتعرض كل العناصر؛ اللي عليها شروط عليها علامة «شروط».",
    rules: "شروط",
    chip: "شروط الظهور: {summary}",
    chipInvalid: "راجع شروط الظهور",
    from: "من {date}",
    until: "لحد {date}",
    only: "في {list} بس",
    except: "ماعدا {list}",
    more: "{list} +{n}",
    viaSource: "جايين من {list}",
    viaMedium: "نوع الزيارة {list}",
    viaCampaign: "حملة {list}",
    joiner: "، ",
  },
} satisfies Messages;

type T = (typeof STRINGS)["en"];

const DEVICE_ICON: Record<DisplayDevice, typeof IconDesktop> = { mobile: IconPhoneDevice, tablet: IconTablet, desktop: IconDesktop };
const UTM_LABEL: Record<DisplayUtmKey, "utmSource" | "utmMedium" | "utmCampaign"> = {
  source: "utmSource",
  medium: "utmMedium",
  campaign: "utmCampaign",
};
const UTM_PLACEHOLDER: Record<DisplayUtmKey, string> = { source: "facebook", medium: "cpc", campaign: "black-friday" };

/** The Arab League countries first; then every ISO 3166-1 country. */
const ARAB_COUNTRIES = ["EG", "SA", "AE", "KW", "QA", "BH", "OM", "JO", "IQ", "LY", "MA", "DZ", "TN", "LB", "PS", "SD", "YE", "SY", "MR", "SO", "DJ", "KM"];
const ALL_COUNTRIES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ " +
  "DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT " +
  "JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG " +
  "NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH " +
  "TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Whether an element carries any display rule. */
export function hasDisplayRules(element: PageElement): boolean {
  return displayRulesOf(element) !== null;
}

/** "until" on or before "from": the server would refuse the page (422). */
function datesInvalid(rules: ElementDisplayRules): boolean {
  return !!rules.from && !!rules.until && Date.parse(rules.until) <= Date.parse(rules.from);
}

// --- the store's clock -------------------------------------------------------

function browserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** The store's time zone (Settings → account), or the browser's when unknown. */
function useStoreZone(): string {
  const { currentWorkspace } = useWorkspace();
  const zone = currentWorkspace?.timezone;
  return useMemo(() => {
    if (!zone) return browserZone();
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: zone });
      return zone;
    } catch {
      return browserZone();
    }
  }, [zone]);
}

/** How far `timeZone`'s wall clock is ahead of UTC at the instant `utcMs`. */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts: Record<string, number> = {};
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
  return wall - Math.floor(utcMs / 1000) * 1000;
}

/** A datetime-local value ("2026-11-20T09:30") read on the store's clock, as an ISO instant. */
function wallToIso(value: string, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  // Twice, so a date across a daylight-saving change lands on the right side of it.
  let utc = wall - zoneOffsetMs(wall, timeZone);
  utc = wall - zoneOffsetMs(utc, timeZone);
  return new Date(utc).toISOString();
}

/** An ISO instant as a datetime-local value on the store's clock. */
function isoToWall(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return new Date(ms + zoneOffsetMs(ms, timeZone)).toISOString().slice(0, 16);
}

// --- words ---------------------------------------------------------------------

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

/** One line saying what the rules do: «موبايل، تابلت · في مصر بس · لحد ٣٠ نوفمبر». */
export function useDisplayRulesSummary(): (rules: ElementDisplayRules) => string {
  const t = useT(STRINGS);
  const { intlLocale } = useLocale();
  const zone = useStoreZone();
  const countryName = useCountryName();
  return useMemo(() => {
    const date = (iso: string) => {
      try {
        return new Intl.DateTimeFormat(intlLocale, { timeZone: zone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
      } catch {
        return iso.slice(0, 16).replace("T", " ");
      }
    };
    const list = (values: string[], max: number) =>
      values.length > max
        ? fmt(t.more, { list: values.slice(0, max).join(t.joiner), n: values.length - max })
        : values.join(t.joiner);
    return (rules: ElementDisplayRules) => {
      const parts: string[] = [];
      if (rules.devices && rules.devices.length < DISPLAY_DEVICES.length) parts.push(rules.devices.map((d) => t[d]).join(t.joiner));
      if (rules.countries) {
        const names = list(rules.countries.list.map(countryName), 2);
        parts.push(fmt(rules.countries.mode === "include" ? t.only : t.except, { list: names }));
      }
      if (rules.utm?.source) parts.push(fmt(t.viaSource, { list: list(rules.utm.source, 2) }));
      if (rules.utm?.medium) parts.push(fmt(t.viaMedium, { list: list(rules.utm.medium, 2) }));
      if (rules.utm?.campaign) parts.push(fmt(t.viaCampaign, { list: list(rules.utm.campaign, 2) }));
      if (rules.from) parts.push(fmt(t.from, { date: date(rules.from) }));
      if (rules.until) parts.push(fmt(t.until, { date: date(rules.until) }));
      return parts.join(" · ");
    };
  }, [t, intlLocale, zone, countryName]);
}

// --- chips -----------------------------------------------------------------------

/**
 * Under an element's name in the panel: what its rules do, in one line. A
 * button that opens the Display tab when `onOpen` is given.
 */
export function DisplayRulesChip({ element, onOpen }: { element: PageElement; onOpen?: () => void }) {
  const t = useT(STRINGS);
  const summarize = useDisplayRulesSummary();
  const rules = displayRulesOf(element);
  if (!rules) return null;
  const invalid = datesInvalid(rules);
  const text = invalid ? t.chipInvalid : fmt(t.chip, { summary: summarize(rules) });
  const className = cn(
    "flex w-full min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-start text-xs font-medium",
    invalid ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent-dark"
  );
  const body = (
    <>
      <IconFilter className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{text}</span>
    </>
  );
  return onOpen ? (
    <button type="button" onClick={onOpen} title={text} className={cn(className, "cursor-pointer hover:underline")}>
      {body}
    </button>
  ) : (
    <p title={text} className={className}>
      {body}
    </p>
  );
}

/** The short «شروط» mark beside an element in the section outline. */
export function DisplayRulesBadge({ element }: { element: PageElement }) {
  const t = useT(STRINGS);
  const summarize = useDisplayRulesSummary();
  const rules = displayRulesOf(element);
  if (!rules) return null;
  return (
    <span
      title={summarize(rules)}
      className="ms-2 inline-flex items-center gap-1 rounded-full bg-accent-soft px-1.5 py-px align-middle text-[11px] font-medium text-accent-dark"
    >
      <IconFilter className="size-3" aria-hidden />
      {t.rules}
    </span>
  );
}

// --- the tab ---------------------------------------------------------------------

export function DisplayRulesPanel({
  element,
  onSettingsChange,
}: {
  element: PageElement;
  onSettingsChange: (settings: Record<string, unknown> | undefined) => void;
}) {
  const t: T = useT(STRINGS);
  const zone = useStoreZone();
  const countryName = useCountryName();
  const rules = displayRulesOf(element) ?? {};
  // A mode picked before any country: kept here until a country makes it a rule.
  const [pendingMode, setPendingMode] = useState<"all" | "include" | "exclude">(() => displayRulesOf(element)?.countries?.mode ?? "all");
  const countryMode = rules.countries?.mode ?? pendingMode;
  const [lastDeviceNote, setLastDeviceNote] = useState(false);

  function write(next: ElementDisplayRules) {
    const clean: ElementDisplayRules = {};
    if (next.from) clean.from = next.from;
    if (next.until) clean.until = next.until;
    if (next.devices && next.devices.length > 0 && next.devices.length < DISPLAY_DEVICES.length) clean.devices = next.devices;
    if (next.countries && next.countries.list.length > 0) clean.countries = next.countries;
    if (next.utm) {
      const utm: ElementDisplayRules["utm"] = {};
      for (const key of DISPLAY_UTM_KEYS) if (next.utm[key]?.length) utm[key] = next.utm[key];
      if (Object.keys(utm).length > 0) clean.utm = utm;
    }
    const settings: Record<string, unknown> = isObject(element.settings) ? { ...element.settings } : {};
    if (Object.keys(clean).length > 0) settings.visibility = clean;
    else delete settings.visibility;
    onSettingsChange(Object.keys(settings).length > 0 ? settings : undefined);
  }

  const devices = rules.devices ?? [...DISPLAY_DEVICES];
  function toggleDevice(device: DisplayDevice) {
    const on = devices.includes(device);
    if (on && devices.length === 1) return setLastDeviceNote(true);
    setLastDeviceNote(false);
    const next = on ? devices.filter((d) => d !== device) : DISPLAY_DEVICES.filter((d) => d === device || devices.includes(d));
    write({ ...rules, devices: next });
  }

  function setDate(key: "from" | "until", value: string) {
    write({ ...rules, [key]: value ? wallToIso(value, zone) : null });
  }

  const countryList = rules.countries?.list ?? [];
  const sortedCountries = useMemo(() => {
    const arab = new Set(ARAB_COUNTRIES);
    const named = (codes: string[]) => codes.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));
    return { arab: named(ARAB_COUNTRIES), rest: named(ALL_COUNTRIES.filter((c) => !arab.has(c))) };
  }, [countryName]);

  function setCountries(mode: "include" | "exclude", list: string[]) {
    write({ ...rules, countries: { mode, list } });
  }

  const untilInvalid = datesInvalid(rules);
  const hasRules = displayRulesOf(element) !== null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-[13px] font-semibold text-ink">{t.title}</h3>
        <p className="text-xs leading-5 text-ink-soft">{t.intro}</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-medium text-ink">{t.showBetween}</legend>
        <DateRow
          label={t.showBetween}
          value={isoToWall(rules.from, zone)}
          clearLabel={t.clearDate}
          onChange={(v) => setDate("from", v)}
        />
        <p className="text-xs font-medium text-ink-soft">{t.and}</p>
        <DateRow
          label={t.and}
          value={isoToWall(rules.until, zone)}
          clearLabel={t.clearDate}
          min={isoToWall(rules.from, zone) || undefined}
          error={untilInvalid ? t.untilBeforeFrom : undefined}
          onChange={(v) => setDate("until", v)}
        />
        {!untilInvalid && <p className="text-xs text-ink-soft">{fmt(t.timeHint, { zone })}</p>}
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-sm font-medium text-ink">{t.devices}</legend>
        <div className="flex flex-wrap gap-1.5">
          {DISPLAY_DEVICES.map((device) => {
            const Icon = DEVICE_ICON[device];
            const on = devices.includes(device);
            return (
              <button
                key={device}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDevice(device)}
                className={cn(
                  "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium ring-1 ring-inset transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none pointer-coarse:min-h-11",
                  on ? "bg-primary-soft text-primary-dark ring-primary/40 dark:text-primary" : "text-ink-soft ring-line-strong hover:text-ink"
                )}
              >
                <Icon className="size-4" aria-hidden />
                {t[device]}
              </button>
            );
          })}
        </div>
        <p className={cn("text-xs", lastDeviceNote ? "font-medium text-danger" : "text-ink-soft")} role={lastDeviceNote ? "alert" : undefined}>
          {lastDeviceNote ? t.lastDevice : t.devicesHint}
        </p>
      </fieldset>

      <div className="space-y-2">
        <Field label={t.countries}>
          {({ id }) => (
            <Select
              id={id}
              value={countryMode}
              onChange={(e) => {
                const mode = e.target.value as "all" | "include" | "exclude";
                setPendingMode(mode);
                if (mode === "all") write({ ...rules, countries: undefined });
                else if (countryList.length > 0) setCountries(mode, countryList);
              }}
            >
              <option value="all">{t.everywhere}</option>
              <option value="include">{t.include}</option>
              <option value="exclude">{t.exclude}</option>
            </Select>
          )}
        </Field>
        {countryMode !== "all" && (
          <>
            {countryList.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {countryList.map((code) => (
                  <li
                    key={code}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft py-0.5 ps-2.5 pe-1 text-sm text-primary-dark dark:text-primary"
                  >
                    {countryName(code)}
                    <button
                      type="button"
                      onClick={() => {
                        // The last one out leaves the mode picked, ready for another country.
                        setPendingMode(countryMode);
                        setCountries(countryMode, countryList.filter((c) => c !== code));
                      }}
                      aria-label={fmt(t.removeCountry, { name: countryName(code) })}
                      className="relative inline-flex size-7 cursor-pointer items-center justify-center rounded-full before:absolute before:-inset-2 before:content-[''] hover:bg-paper-raised focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <IconClose className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Select
              aria-label={t.addCountry}
              value=""
              disabled={countryList.length >= DISPLAY_RULE_LIMITS.countries}
              onChange={(e) => {
                const code = e.target.value;
                if (code && !countryList.includes(code)) setCountries(countryMode, [...countryList, code]);
              }}
            >
              <option value="">{t.addCountry}</option>
              <optgroup label={t.arabCountries}>
                {sortedCountries.arab.map((c) => (
                  <option key={c.code} value={c.code} disabled={countryList.includes(c.code)}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t.allCountries}>
                {sortedCountries.rest.map((c) => (
                  <option key={c.code} value={c.code} disabled={countryList.includes(c.code)}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            </Select>
            <p className="text-xs text-ink-soft">{countryList.length === 0 ? t.pickCountry : countryMode === "include" ? t.includeHint : null}</p>
          </>
        )}
      </div>

      {DISPLAY_UTM_KEYS.map((key) => (
        <TagListField
          key={key}
          label={t[UTM_LABEL[key]]}
          values={rules.utm?.[key] ?? []}
          onChange={(values) => write({ ...rules, utm: { ...rules.utm, [key]: values } })}
          max={DISPLAY_RULE_LIMITS.utmValues}
          maxLength={DISPLAY_RULE_LIMITS.utmValueLength}
          placeholder={UTM_PLACEHOLDER[key]}
          hint={key === "source" ? t.utmHint : undefined}
          dir="ltr"
        />
      ))}

      <p className="text-xs text-ink-soft">{t.previewNote}</p>

      {hasRules && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setPendingMode("all");
            setLastDeviceNote(false);
            write({});
          }}
        >
          {t.clear}
        </Button>
      )}
    </div>
  );
}

function DateRow({
  label,
  value,
  min,
  error,
  clearLabel,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  error?: string;
  clearLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Input
          type="datetime-local"
          aria-label={label}
          aria-invalid={error ? true : undefined}
          dir="ltr"
          value={value}
          min={min}
          onChange={(e) => onChange(e.target.value)}
          className={cn("min-w-0 flex-1", error && "border-danger")}
        />
        {value && (
          <Button type="button" size="icon-sm" variant="ghost" aria-label={clearLabel} title={clearLabel} onClick={() => onChange("")}>
            <IconClose className="size-4" aria-hidden />
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
