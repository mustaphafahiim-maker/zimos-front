import { useMemo, useState } from "react";
import { IconSearch } from "@/components/icons";
import { Input } from "@store-builder/ui";
import type { CarrierInfo } from "@store-builder/api-client";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";

const STRINGS = {
  en: {
    search: "Search shipping companies",
    country: "Country",
    allCountries: "All countries",
    none: "No shipping company matches this search.",
  },
  ar: {
    search: "ابحث في شركات الشحن",
    country: "الدولة",
    allCountries: "كل الدول",
    none: "مفيش شركة شحن تطابق البحث.",
  },
} satisfies Messages;

/** A server older than `countries` on the listing only offered Egyptian couriers. */
const countriesOf = (carrier: CarrierInfo) => (carrier as CarrierInfo & { countries?: string[] }).countries ?? ["EG"];

function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * Search and country filter for the shipping companies list (SPEC §12.3).
 * The country select appears only once the list spans more than one country.
 */
export function useCarrierFilter(carriers: CarrierInfo[]) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");

  const countries = useMemo(() => [...new Set(carriers.flatMap(countriesOf))].sort(), [carriers]);
  const needle = query.trim().toLowerCase();
  const filtered = carriers.filter(
    (c) => (!needle || c.name.toLowerCase().includes(needle) || c.code.includes(needle)) && (!country || countriesOf(c).includes(country))
  );

  const bar =
    carriers.length > 1 ? (
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <IconSearch className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
          <Input type="search" aria-label={t.search} placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} className="min-h-11 ps-9" />
        </div>
        {countries.length > 1 && (
          <Select aria-label={t.country} value={country} onChange={(e) => setCountry(e.target.value)} className="min-h-11 w-auto">
            <option value="">{t.allCountries}</option>
            {countries.map((code) => (
              <option key={code} value={code}>
                {countryName(code, locale)}
              </option>
            ))}
          </Select>
        )}
      </div>
    ) : null;

  const empty = filtered.length === 0 && carriers.length > 0 ? <p className="text-sm text-ink-soft">{t.none}</p> : null;
  return { filtered, bar, empty };
}
