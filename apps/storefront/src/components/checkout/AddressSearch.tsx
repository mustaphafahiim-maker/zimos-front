"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  storefrontAddressConfig,
  storefrontAddressDetails,
  storefrontAddressSuggest,
  type AddressLookupAddress,
  type AddressLookupConfig,
  type AddressSuggestion,
  type ApiClient,
  type CheckoutFormField,
  type StorefrontPlace,
} from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { arOrEn } from "@/lib/i18n";
import type { OrderFormField } from "@/lib/orderForm";
import type { Place } from "@/lib/places";
import { useStore } from "@/lib/StoreContext";
import { useShippingPlaces } from "@/lib/useShippingPlaces";
import type { StorePlacesState } from "@/lib/useStorePlaces";
import { SearchIcon } from "../Icons";
import { input, label as labelClass } from "../ui";

/**
 * "Search your address" (frontend-handoff 184): one field above the purchase
 * form's address, shown when the store has address suggestions on (GET
 * /store/:ws/address/config). The shopper types; after two characters and a
 * pause (DEBOUNCE_MS) the store's provider suggests up to eight places —
 * its own places list, or Google Maps with "Powered by Google" under them.
 *
 * A pick asks for its details and fills the form the shopper would otherwise
 * fill by hand: the store's region → city → area pickers (lib/useStorePlaces —
 * the names are the list's own, and the deepest picked place prices the
 * shipping, so the quote follows), or, without the store's own list, the
 * platform's governorate and a typed city; then the street when the provider
 * knows it, else the street field takes the focus. Nothing is locked: every
 * field stays editable, and a failed or empty search changes nothing.
 *
 * ARIA combobox (as components/SearchBox): the input owns a listbox; ↑/↓
 * move through the options (aria-activedescendant — focus never leaves the
 * input), Enter picks, Escape closes and then clears. Enter never submits the
 * order from here. One session id per visit groups the typing and the pick
 * (Google bills them as one).
 */

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;
const MAX_SUGGESTIONS = 8;

/** The purchase form keys the search goes before (the first of them on the form). */
const ADDRESS_KEYS: ReadonlySet<string> = new Set(["government", "city", "address"]);

/** Where the search goes in the form's field list: before its first address field; -1 when it has none. */
export function addressSearchSlot(list: readonly CheckoutFormField[]): number {
  return list.findIndex((f) => ADDRESS_KEYS.has(f.key));
}

// One config request per store for the page's life (the product page, the cart and the checkout share it).
const configs = new Map<string, Promise<AddressLookupConfig | null>>();

function loadConfig(client: ApiClient, workspaceId: string): Promise<AddressLookupConfig | null> {
  const known = configs.get(workspaceId);
  if (known) return known;
  const request = storefrontAddressConfig(client, workspaceId).catch(() => {
    // No suggestions this time (the form works without them); asked again on the next page.
    configs.delete(workspaceId);
    return null;
  });
  configs.set(workspaceId, request);
  return request;
}

/** 8–64 characters of [A-Za-z0-9_-], as the API asks. */
function newSessionId(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID().replace(/-/g, "");
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
}

/** The API's own folding (places/autocomplete/fold.js): no diacritics, one alef, ya, ha; lower case. */
function fold(s: string | null | undefined): string {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/[ً-ٰـ̀-ͯ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** "محافظة القاهرة" / "Cairo Governorate" read as the platform's "القاهرة" / "Cairo". */
const bare = (s: string | null | undefined) => fold(s).replace(/^محافظه /, "").replace(/ governorate$/, "");

const sameName = (place: { ar: string; en: string }, name: string | null | undefined) =>
  Boolean(name) && (bare(place.ar) === bare(name) || (Boolean(place.en) && bare(place.en) === bare(name)));

interface PlacePath {
  regionId: string;
  cityId: string;
  areaId: string;
}

/** The store's own places the picked address names: by its place id, else by its names. */
function pathOf(regions: readonly StorefrontPlace[], address: AddressLookupAddress): PlacePath | null {
  const kids = (p: StorefrontPlace) => (p.children ?? []).filter((c) => c.id);
  if (address.placeId) {
    for (const region of regions) {
      if (region.id === address.placeId) return { regionId: region.id, cityId: "", areaId: "" };
      for (const city of kids(region)) {
        if (city.id === address.placeId) return { regionId: region.id as string, cityId: city.id, areaId: "" };
        const area = kids(city).find((a) => a.id === address.placeId);
        if (area) return { regionId: region.id as string, cityId: city.id as string, areaId: area.id as string };
      }
    }
  }
  const region =
    regions.find((r) => sameName(r, address.province)) ??
    (address.city ? regions.find((r) => kids(r).some((c) => sameName(c, address.city))) : undefined);
  if (!region?.id) return null;
  const city = kids(region).find((c) => sameName(c, address.city));
  const area = city ? kids(city).find((a) => sameName(a, address.area)) : undefined;
  return { regionId: region.id, cityId: city?.id ?? "", areaId: area?.id ?? "" };
}

/** The platform governorate an address names (its code), for a form without the store's own list. */
function governorateOf(places: readonly Place[], province: string | null): string | undefined {
  return province ? places.find((p) => sameName(p, province))?.code : undefined;
}

function PinIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

/** The pickers are filled one level per render: each level's options come from the one before it. */
interface Pending {
  path: PlacePath;
  step: "region" | "city" | "area";
  address: AddressLookupAddress;
}

export function AddressSearch({
  idPrefix,
  country: formCountry,
  onChange,
  storePlaces,
}: {
  idPrefix: string;
  /** The form's country ("" = Egypt). */
  country: string;
  /** The purchase form's own change handler. */
  onChange: (field: OrderFormField, value: string) => void;
  /** The store's own places when its pickers are on the form; null = the platform's governorates and a typed city. */
  storePlaces: StorePlacesState | null;
}) {
  const { t, locale, store } = useStore();
  const workspaceId = store?.id || store?.workspaceId || "";
  const client = useMemo(() => createStorefrontApiClient({ locale }), [locale]);
  const country = (formCountry || "EG").toUpperCase();
  const platformPlaces = useShippingPlaces(country);
  const [session] = useState(newSessionId);

  const [config, setConfig] = useState<AddressLookupConfig | null>(null);
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    loadConfig(client, workspaceId).then((c) => {
      if (!cancelled) setConfig(c);
    });
    return () => {
      cancelled = true;
    };
  }, [client, workspaceId]);
  // The places list has Arabic and English names only: French reads the English ones, as on the pickers.
  const lang = config?.provider === "google" ? locale : arOrEn(locale);
  // The store turned suggestions off since the page loaded.
  const [turnedOff, setTurnedOff] = useState(false);

  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ q: string; items: AddressSuggestion[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [picking, setPicking] = useState(false);
  const [pickFailed, setPickFailed] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);

  const timer = useRef<number | undefined>(undefined);
  const request = useRef<AbortController | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const inputId = `${idPrefix}-addr-search`;
  const listId = `${inputId}-list`;
  const errorId = `${inputId}-error`;
  const optionId = (i: number) => `${inputId}-opt-${i}`;

  function stop() {
    window.clearTimeout(timer.current);
    request.current?.abort();
    request.current = null;
  }
  useEffect(() => stop, []);

  // Another country: its places, so nothing typed or found for the last one stays.
  const [seenCountry, setSeenCountry] = useState(country);
  if (seenCountry !== country) {
    setSeenCountry(country);
    setQuery("");
    setResult(null);
    setOpen(false);
    setActive(-1);
  }

  const q = query.trim();
  const items = result?.items ?? [];
  const expanded = open && [...q].length >= MIN_CHARS && (result !== null || searching || failed);
  const activeItem = expanded && active >= 0 && active < items.length ? items[active] : undefined;

  function search(text: string) {
    const controller = new AbortController();
    request.current = controller;
    setSearching(true);
    storefrontAddressSuggest(client, workspaceId, { q: text, country, lang, session }, { signal: controller.signal })
      .then((answer) => {
        if (controller.signal.aborted) return;
        if (!answer.enabled) setTurnedOff(true);
        setResult({ q: text, items: answer.suggestions.slice(0, MAX_SUGGESTIONS) });
        setFailed(false);
        setActive(-1);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setResult(null);
        setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearching(false);
      });
  }

  function type(value: string) {
    stop();
    setQuery(value);
    setActive(-1);
    setPickFailed(false);
    setAnnounce("");
    const text = value.trim();
    if ([...text].length < MIN_CHARS) {
      setResult(null);
      setSearching(false);
      setFailed(false);
      setOpen(false);
      return;
    }
    setOpen(true);
    timer.current = window.setTimeout(() => search(text), DEBOUNCE_MS);
  }

  async function pick(item: AddressSuggestion) {
    stop();
    setOpen(false);
    setActive(-1);
    setResult(null);
    setSearching(false);
    setQuery([item.text, item.secondaryText].filter(Boolean).join(lang === "ar" ? "، " : ", "));
    setPicking(true);
    setPickFailed(false);
    try {
      const address = await storefrontAddressDetails(client, workspaceId, { id: item.id, country, lang, session });
      fill(address);
    } catch {
      setPickFailed(true);
    } finally {
      setPicking(false);
    }
  }

  function fill(address: AddressLookupAddress) {
    const path = storePlaces?.active ? pathOf(storePlaces.regions, address) : null;
    if (path) {
      setPending({ path, step: "region", address });
      return;
    }
    if (!storePlaces?.active) {
      const code = governorateOf(platformPlaces, address.province);
      if (code) onChange("governorate", code);
      if (address.city) onChange("city", address.city);
    }
    finish(address, null);
  }

  /** After the places: the street when the provider gave one, else the shopper types it next. */
  function finish(address: AddressLookupAddress, own: StorePlacesState | null) {
    // A region of the store's list without cities keeps a typed city.
    if (own && own.regionId && !own.hasCities && address.city) onChange("city", address.city);
    if (address.addressLine) onChange("address", address.addressLine);
    if (address.postalCode) onChange("postalCode", address.postalCode);
    setAnnounce(t.addressSearch.filled);
    if (!address.addressLine) document.getElementById(`${idPrefix}-address`)?.focus();
  }

  // Region, then (once its cities are on the picker) the city, then the area.
  useEffect(() => {
    if (!pending) return;
    const own = storePlaces?.active ? storePlaces : null;
    const { path, step, address } = pending;
    if (own && step === "region") {
      own.pickRegion(path.regionId);
      setPending({ ...pending, step: path.cityId ? "city" : "area" });
      return;
    }
    if (own && step === "city") {
      if (own.cities.some((c) => c.id === path.cityId)) own.pickCity(path.cityId);
      setPending({ ...pending, step: "area" });
      return;
    }
    if (own && path.areaId && own.areas.some((a) => a.id === path.areaId)) own.pickArea(path.areaId);
    setPending(null);
    finish(address, own);
    // `finish` reads this render's props; the effect runs again only when a step moved the pickers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, storePlaces]);

  // On a phone the keyboard can cover the list: bring the field up when the list opens below the fold.
  useEffect(() => {
    if (!expanded) return;
    const list = listRef.current;
    const viewport = window.visualViewport?.height ?? window.innerHeight;
    if (list && list.getBoundingClientRect().bottom > viewport) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      wrapRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    }
  }, [expanded]);

  useEffect(() => {
    if (active >= 0) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!expanded) {
        if ([...q].length >= MIN_CHARS) {
          setOpen(true);
          if (!result && !searching) type(query);
        }
        return;
      }
      if (items.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current === -1 ? (step === 1 ? 0 : items.length - 1) : (current + step + items.length) % items.length));
    } else if (e.key === "Enter") {
      // A search field: Enter picks, it never sends the order.
      e.preventDefault();
      if (activeItem) void pick(activeItem);
    } else if (e.key === "Escape") {
      if (expanded) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      } else if (query) {
        e.preventDefault();
        type("");
      }
    } else if ((e.key === "Home" || e.key === "End") && activeItem) {
      e.preventDefault();
      setActive(e.key === "Home" ? 0 : items.length - 1);
    }
  }

  if (!workspaceId || !config?.enabled || turnedOff) return null;

  const google = config.attribution === "google";
  const busy = searching || picking;
  // A Latin address ("12 Abbas El Akkad, Nasr City") reads left to right even on an Arabic page; the padding is even for the icon.
  const latin = /^[^\p{L}]*[A-Za-z\u00C0-\u024F]/u.test(query);
  let status = "";
  if (expanded && result && !searching) status = items.length ? t.catalog.suggestionsCount(items.length) : t.addressSearch.noResults;
  else if (expanded && failed) status = t.addressSearch.unavailable;
  else if (!expanded) status = announce;

  return (
    <div ref={wrapRef} className="relative scroll-mt-24 sm:col-span-2">
      <label htmlFor={inputId} className={labelClass}>
        {t.addressSearch.label}
      </label>
      <div className="relative">
        <SearchIcon size={18} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden />
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={activeItem ? optionId(active) : undefined}
          aria-describedby={pickFailed ? errorId : undefined}
          aria-busy={busy || undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          dir={latin ? "ltr" : undefined}
          maxLength={120}
          value={query}
          placeholder={google ? t.addressSearch.placeholderStreet : t.addressSearch.placeholder}
          onChange={(e) => type(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className={`${input} ps-10 pe-10 ${latin ? "rtl:text-end" : ""}`}
        />
        {busy && (
          <span
            aria-hidden
            className="absolute end-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-line border-t-primary motion-reduce:animate-none"
          />
        )}
      </div>

      <p aria-live="polite" className="sr-only">
        {status}
      </p>

      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={t.addressSearch.suggestions}
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-80 overflow-y-auto rounded-2xl border border-line bg-paper-raised p-1.5 shadow-xl"
      >
        {items.map((item, i) => (
          <li
            key={item.id}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            // mousedown, not click: the input keeps the focus until the pick.
            onMouseDown={(e) => {
              e.preventDefault();
              void pick(item);
            }}
            onMouseMove={() => setActive(i)}
            className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 ${i === active ? "bg-primary-soft" : ""}`}
          >
            <span className={`shrink-0 ${i === active ? "text-primary" : "text-ink-soft"}`}>
              <PinIcon />
            </span>
            <span className="min-w-0 flex-1">
              {/* bdi: a Latin street ("12 Abbas El Akkad") keeps its own order on an Arabic page. */}
              <span className="block truncate text-sm font-semibold text-ink">
                <bdi>{item.text}</bdi>
              </span>
              {item.secondaryText && (
                <span className="block truncate text-xs text-ink-soft">
                  <bdi>{item.secondaryText}</bdi>
                </span>
              )}
            </span>
          </li>
        ))}
        {items.length === 0 && (
          <li role="presentation" className="px-2.5 py-2.5 text-sm text-ink-soft">
            {failed ? t.addressSearch.unavailable : searching || !result ? t.addressSearch.searching : t.addressSearch.noResults}
          </li>
        )}
        {google && items.length > 0 && (
          // Google's attribution, as Google words it (not translated).
          <li role="presentation" lang="en" dir="ltr" className="mt-1 border-t border-line px-2.5 pb-1 pt-2 text-end text-[11px] text-ink-soft">
            Powered by Google
          </li>
        )}
      </ul>

      {pickFailed && (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-danger">
          {t.addressSearch.pickFailed}
        </p>
      )}
    </div>
  );
}
