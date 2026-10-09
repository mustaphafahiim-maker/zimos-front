"use client";

import type { ReactNode } from "react";
import type { StorefrontPlace } from "@store-builder/api-client";
import { arOrEn } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import type { StorePlacesState } from "@/lib/useStorePlaces";
import { input, label as labelClass } from "../ui";

/**
 * Region → City → Area, from the store's own place list (frontend-handoff
 * 163), standing in for the purchase form's governorate and city fields
 * (OrderFormFields). Each picker opens on the one before it; the area picker
 * only shows when the chosen city has areas, and is optional. A region with
 * no cities keeps a typed city, as before. The ids are the form's own
 * (`<prefix>-governorate`, `<prefix>-city`), so "focus the first error" and
 * the server's field errors land on them unchanged. A refused place (hidden
 * since the page loaded) is said once, under all the pickers: it may be the
 * area or the city, not the region the focus goes back to.
 *
 * Grid children of the form's two-column grid: region and city side by side
 * on wide screens, the area under them.
 */

export interface PlaceFieldSpec {
  label: string;
  required: boolean;
  hint?: string;
  error?: string;
}

function Chevron() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-soft"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Slot({
  id,
  spec,
  optionalLabel,
  className,
  children,
}: {
  id: string;
  spec: PlaceFieldSpec;
  optionalLabel: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {spec.label}
        {spec.required ? (
          <span className="text-danger" aria-hidden>
            {" "}*
          </span>
        ) : (
          <span className="ms-1 text-xs font-normal text-ink-soft">({optionalLabel})</span>
        )}
      </label>
      {children}
      {spec.hint && !spec.error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-soft">
          {spec.hint}
        </p>
      )}
      {spec.error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-danger">
          {spec.error}
        </p>
      )}
    </div>
  );
}

const a11y = (id: string, spec: PlaceFieldSpec) =>
  ({
    id,
    "aria-invalid": spec.error ? true : undefined,
    "aria-describedby": spec.error ? `${id}-error` : spec.hint ? `${id}-hint` : undefined,
  }) as const;

export function StorePlaceFields({
  idPrefix,
  places,
  region,
  city,
  cityText,
  onCityText,
  onCityBlur,
  refusal,
}: {
  idPrefix: string;
  places: StorePlacesState;
  region: PlaceFieldSpec;
  /** null when the purchase form does not ask for a city: the region alone is picked. */
  city: PlaceFieldSpec | null;
  /** The typed city, for a region of the list that has no cities. */
  cityText: string;
  onCityText: (value: string) => void;
  /** Optional: the typed city was left (a form that hands typing over on leaving the field). */
  onCityBlur?: () => void;
  /** The server refused the picked place: said under the pickers. */
  refusal?: string;
}) {
  const { t, locale } = useStore();
  const name = (p: StorefrontPlace) => p[arOrEn(locale)] || p.ar;
  const regionId = `${idPrefix}-governorate`;
  const cityId = `${idPrefix}-city`;
  const areaId = `${idPrefix}-area`;
  const refusalId = `${idPrefix}-place-error`;
  // A picked region without cities: the city is typed, as on a form without the store's list.
  const typedCity = Boolean(places.regionId) && !places.hasCities;

  return (
    <>
      <Slot id={regionId} spec={region} optionalLabel={t.common.optional} className={city ? "" : "sm:col-span-2"}>
        <div className="relative">
          <select
            {...a11y(regionId, region)}
            // Read out on focus; not marked invalid — the refused place may be the city or the area.
            {...(refusal ? { "aria-describedby": refusalId } : {})}
            name="governorate"
            required={region.required}
            autoComplete="address-level1"
            value={places.regionId}
            onChange={(e) => places.pickRegion(e.target.value)}
            className={`${input} cursor-pointer appearance-none pe-10`}
          >
            <option value="">{t.form.chooseGovernorate}</option>
            {places.regions.map((p) => (
              <option key={p.id} value={p.id ?? ""}>
                {name(p)}
              </option>
            ))}
          </select>
          <Chevron />
        </div>
      </Slot>

      {city && (
        <Slot id={cityId} spec={city} optionalLabel={t.common.optional} className="">
          {typedCity ? (
            <input
              {...a11y(cityId, city)}
              name="city"
              type="text"
              autoComplete="address-level2"
              enterKeyHint="next"
              required={city.required}
              maxLength={100}
              value={cityText}
              onChange={(e) => onCityText(e.target.value)}
              onBlur={onCityBlur}
              className={input}
            />
          ) : (
            <div className="relative">
              <select
                {...a11y(cityId, city)}
                name="city"
                required={city.required}
                disabled={!places.regionId}
                autoComplete="address-level2"
                value={places.cityId}
                onChange={(e) => places.pickCity(e.target.value)}
                className={`${input} cursor-pointer appearance-none pe-10 disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <option value="">{places.regionId ? t.places.chooseCity : t.places.chooseRegionFirst}</option>
                {places.cities.map((p) => (
                  <option key={p.id} value={p.id ?? ""}>
                    {name(p)}
                  </option>
                ))}
              </select>
              <Chevron />
            </div>
          )}
        </Slot>
      )}

      {city && places.areas.length > 0 && (
        <Slot
          id={areaId}
          spec={{ label: t.places.area, required: false }}
          optionalLabel={t.common.optional}
          className="sm:col-span-2"
        >
          <div className="relative">
            <select
              id={areaId}
              name="area"
              autoComplete="address-level3"
              value={places.areaId}
              onChange={(e) => places.pickArea(e.target.value)}
              className={`${input} cursor-pointer appearance-none pe-10`}
            >
              <option value="">{t.places.chooseArea}</option>
              {places.areas.map((p) => (
                <option key={p.id} value={p.id ?? ""}>
                  {name(p)}
                </option>
              ))}
            </select>
            <Chevron />
          </div>
        </Slot>
      )}

      {refusal && (
        <p id={refusalId} className="-mt-2 text-sm font-medium text-danger sm:col-span-2">
          {refusal}
        </p>
      )}
    </>
  );
}
