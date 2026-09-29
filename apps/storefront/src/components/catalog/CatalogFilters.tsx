"use client";

import { useId, useState, type FormEvent } from "react";
import type { CatalogFilter, StorefrontCollection, StorefrontFacets } from "@store-builder/api-client";
import { StoreLink } from "@/components/StoreRoute";
import { btnSecondary, focusRing, input } from "@/components/ui";
import { useStore } from "@/lib/StoreContext";
import { catalogHref, toggle, toggleOption, type CatalogState } from "@/lib/catalogQuery";
import { useCatalogNavigate } from "./useCatalogNavigate";

/**
 * The listing's filters, in the order the merchant chose in the dashboard
 * (settings.storefront_catalog.filters): the collection tree, a price range,
 * tags and product options. Each change goes straight into the URL, so the
 * page, the counts and the back button all follow it.
 *
 * The same component is the desktop sidebar and the body of the phone's
 * filter sheet (FilterDrawer); `idPrefix` keeps their ids apart.
 */

const groupTitle = "text-sm font-semibold text-ink";
const countBadge = "ms-auto shrink-0 text-xs tabular-nums text-ink-soft";
const checkRow = `flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm text-ink hover:bg-primary-soft/50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary`;

interface Props {
  state: CatalogState;
  filters: CatalogFilter[];
  facets: StorefrontFacets | undefined;
  collections: StorefrontCollection[];
  idPrefix: string;
}

export function CatalogFilters({ state, filters, facets, collections, idPrefix }: Props) {
  const { go } = useCatalogNavigate();
  if (!facets) return null;

  // "options" shows every option not already placed on its own.
  const named = new Set(filters.flatMap((f) => (f.key === "option" ? [f.name] : [])));
  const groups = filters.flatMap((filter, index) => {
    const key = `${filter.key}-${index}`;
    switch (filter.key) {
      case "collections":
        return collections.length > 0 ? [<CollectionGroup key={key} state={state} facets={facets} collections={collections} />] : [];
      case "price":
        // Keyed on the applied range, so the inputs follow a change made elsewhere (clear all, back button).
        return facets.price.max !== null
          ? [<PriceGroup key={`${key}-${state.min}-${state.max}`} state={state} facets={facets} idPrefix={idPrefix} onApply={go} />]
          : [];
      case "tags":
        return facets.tags.length > 0 ? [<TagGroup key={key} state={state} facets={facets} onChange={go} />] : [];
      case "options":
        return facets.options
          .filter((o) => !named.has(o.name))
          .map((o) => <OptionGroup key={`${key}-${o.name}`} state={state} option={o} onChange={go} />);
      case "option": {
        const option = facets.options.find((o) => o.name === filter.name);
        return option ? [<OptionGroup key={key} state={state} option={option} onChange={go} />] : [];
      }
      default:
        return [];
    }
  });

  return (
    <div className="space-y-6">{groups}</div>
  );
}

function CollectionGroup({
  state,
  facets,
  collections,
}: {
  state: CatalogState;
  facets: StorefrontFacets;
  collections: StorefrontCollection[];
}) {
  const { t } = useStore();
  const headingId = useId();
  const counts = new Map(facets.collections.map((c) => [c.id, c.count]));
  const children = new Map<string | null, StorefrontCollection[]>();
  for (const c of collections) {
    const parent = c.parentId ?? null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent)!.push(c);
  }
  const selected = state.collection;

  const link = (active: boolean) =>
    `flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm transition-colors ${focusRing} ${
      active ? "bg-primary-soft font-semibold text-primary" : "text-ink hover:bg-primary-soft/50 hover:text-primary"
    }`;

  const render = (parentId: string | null, depth: number) => {
    const list = (children.get(parentId) ?? []).filter(
      (c) => (counts.get(c.id) ?? 0) > 0 || c.slug === selected || c.id === selected
    );
    if (list.length === 0) return null;
    return (
      <ul className={depth > 0 ? "ms-3 border-s border-line ps-2" : "space-y-0.5"}>
        {list.map((c) => {
          const active = c.slug === selected || c.id === selected;
          return (
            <li key={c.id}>
              <StoreLink
                href={catalogHref(state, { collection: c.slug })}
                className={link(active)}
                aria-current={active ? "page" : undefined}
                scroll={false}
              >
                <span className="min-w-0 truncate">{c.name}</span>
                <span className={countBadge}>{counts.get(c.id) ?? 0}</span>
              </StoreLink>
              {depth < 2 && render(c.id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <nav aria-labelledby={headingId} className="space-y-2">
      <h2 id={headingId} className={groupTitle}>
        {t.catalog.collections}
      </h2>
      <StoreLink
        href={catalogHref(state, { collection: null })}
        className={link(!selected)}
        aria-current={!selected ? "page" : undefined}
        scroll={false}
      >
        {t.catalog.allCollections}
      </StoreLink>
      {render(null, 0)}
    </nav>
  );
}

function PriceGroup({
  state,
  facets,
  idPrefix,
  onApply,
}: {
  state: CatalogState;
  facets: StorefrontFacets;
  idPrefix: string;
  onApply: (href: string) => void;
}) {
  const { t } = useStore();
  const [min, setMin] = useState(state.min === null ? "" : String(state.min));
  const [max, setMax] = useState(state.max === null ? "" : String(state.max));
  const floor = facets.price.min !== null ? Math.floor(facets.price.min / 100) : undefined;
  const ceiling = facets.price.max !== null ? Math.ceil(facets.price.max / 100) : undefined;

  function submit(e: FormEvent) {
    e.preventDefault();
    const read = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Math.max(0, Number(v)));
    let low = read(min);
    let high = read(max);
    if (low !== null && high !== null && low > high) [low, high] = [high, low];
    onApply(catalogHref(state, { min: low, max: high }));
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <fieldset className="space-y-2">
        <legend className={groupTitle}>{t.catalog.price}</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-ink-soft" htmlFor={`${idPrefix}-min`}>
            {t.catalog.priceFrom}
            <input
              id={`${idPrefix}-min`}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              dir="ltr"
              value={min}
              placeholder={floor !== undefined ? String(floor) : undefined}
              onChange={(e) => setMin(e.target.value)}
              className={`${input} mt-1`}
            />
          </label>
          <label className="block text-xs text-ink-soft" htmlFor={`${idPrefix}-max`}>
            {t.catalog.priceTo}
            <input
              id={`${idPrefix}-max`}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              dir="ltr"
              value={max}
              placeholder={ceiling !== undefined ? String(ceiling) : undefined}
              onChange={(e) => setMax(e.target.value)}
              className={`${input} mt-1`}
            />
          </label>
        </div>
      </fieldset>
      <button type="submit" className={`${btnSecondary} w-full`}>
        {t.catalog.apply}
      </button>
    </form>
  );
}

function TagGroup({
  state,
  facets,
  onChange,
}: {
  state: CatalogState;
  facets: StorefrontFacets;
  onChange: (href: string) => void;
}) {
  const { t } = useStore();
  return (
    <fieldset className="space-y-1">
      <legend className={`${groupTitle} mb-1`}>{t.catalog.tags}</legend>
      {facets.tags.map((tag) => (
        <label key={tag.value} className={checkRow}>
          <input
            type="checkbox"
            className="size-4 shrink-0 accent-[var(--color-primary)]"
            checked={state.tags.includes(tag.value)}
            onChange={() => onChange(catalogHref(state, { tags: toggle(state.tags, tag.value) }))}
          />
          <span className="min-w-0 truncate">{tag.value}</span>
          <span className={countBadge}>{tag.count}</span>
        </label>
      ))}
    </fieldset>
  );
}

function OptionGroup({
  state,
  option,
  onChange,
}: {
  state: CatalogState;
  option: StorefrontFacets["options"][number];
  onChange: (href: string) => void;
}) {
  const chosen = state.options[option.name] ?? [];
  return (
    <fieldset className="space-y-1">
      <legend className={`${groupTitle} mb-1`}>{option.name}</legend>
      {option.values.map((v) => (
        <label key={v.value} className={checkRow}>
          <input
            type="checkbox"
            className="size-4 shrink-0 accent-[var(--color-primary)]"
            checked={chosen.includes(v.value)}
            onChange={() => onChange(catalogHref(state, { options: toggleOption(state.options, option.name, v.value) }))}
          />
          <span className="min-w-0 truncate">{v.value}</span>
          <span className={countBadge}>{v.count}</span>
        </label>
      ))}
    </fieldset>
  );
}
