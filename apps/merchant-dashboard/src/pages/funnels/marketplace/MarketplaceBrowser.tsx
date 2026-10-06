import { useEffect, useId, useState } from "react";
import { Check, Eye, LayoutTemplate, Search, Upload, X } from "lucide-react";
import { Button, Input, cn } from "@store-builder/ui";
import {
  MARKETPLACE_CATEGORIES,
  marketplaceBrowse,
  type MarketplaceCategory,
  type MarketplaceLanguage,
  type MarketplaceTemplateCard,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs } from "@/components/FilterTabs";
import { LoadMore } from "@/components/LoadMore";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { LANGUAGES, MARKET_STRINGS, categoryLabel, countsLine, languageLabel, type MarketStrings } from "./marketplaceStrings";

const PAGE_SIZE = 24;

type Sort = "popular" | "new";

/**
 * The listed templates (handoff 192): search, kind chips, order and language,
 * then the cards. `mode="page"` is the marketplace page — each card has
 * Preview and Use; `mode="pick"` is the new-funnel wizard's gallery tab — a
 * card is a choice (radio) the wizard creates from, with Preview beside it.
 */
export function MarketplaceBrowser({
  mode,
  selectedId,
  onPick,
  onPreview,
  onUse,
  onShare,
}: {
  mode: "page" | "pick";
  selectedId?: string | null;
  onPick?: (template: MarketplaceTemplateCard) => void;
  onPreview: (template: MarketplaceTemplateCard) => void;
  onUse?: (template: MarketplaceTemplateCard) => void;
  /** Offered on the empty marketplace: be the first to share. */
  onShare?: () => void;
}) {
  const t = useT(MARKET_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const searchId = useId();
  const sortId = useId();
  const languageId = useId();

  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<"all" | MarketplaceCategory>("all");
  const [sort, setSort] = useState<Sort>("popular");
  const [language, setLanguage] = useState<"" | MarketplaceLanguage>("");
  // The search runs once typing pauses.
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(draft.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const filtered = q !== "" || category !== "all" || language !== "";
  const params = { q: q || undefined, category: category === "all" ? undefined : category, language: language || undefined, sort, limit: PAGE_SIZE };
  const first = useAsync(() => marketplaceBrowse(apiClient, workspaceId, { ...params, page: 1 }), [workspaceId, q, category, sort, language]);
  // Later pages, appended under the first one; a new filter starts over.
  const [more, setMore] = useState<{ items: MarketplaceTemplateCard[]; page: number; loading: boolean }>({ items: [], page: 1, loading: false });
  useEffect(() => setMore({ items: [], page: 1, loading: false }), [first.data]);

  const templates = [...(first.data?.templates ?? []), ...more.items];
  const total = first.data?.total ?? 0;

  async function loadMore() {
    setMore((m) => ({ ...m, loading: true }));
    try {
      const next = await marketplaceBrowse(apiClient, workspaceId, { ...params, page: more.page + 1 });
      setMore((m) => ({ items: [...m.items, ...next.templates], page: m.page + 1, loading: false }));
    } catch (err) {
      setMore((m) => ({ ...m, loading: false }));
      toast.error(errorMessage(err));
    }
  }

  function clearFilters() {
    setDraft("");
    setQ("");
    setCategory("all");
    setLanguage("");
  }

  return (
    <div className="space-y-3">
      <div className={cn("grid gap-2", mode === "page" ? "sm:grid-cols-[minmax(0,1fr)_11rem_11rem]" : "grid-cols-2")}>
        <div className={cn("relative", mode === "pick" && "col-span-2")}>
          <label htmlFor={searchId} className="sr-only">
            {t.search}
          </label>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
          <Input
            id={searchId}
            type="search"
            dir="auto"
            value={draft}
            maxLength={100}
            placeholder={t.searchPlaceholder}
            onChange={(e) => setDraft(e.target.value)}
            className="ps-9 pe-11 [&::-webkit-search-cancel-button]:hidden"
          />
          {draft && (
            <button
              type="button"
              onClick={() => setDraft("")}
              aria-label={t.clearSearch}
              className="absolute end-0 top-1/2 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-ink-soft hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
        <div>
          <label htmlFor={sortId} className="sr-only">
            {t.sort}
          </label>
          <Select id={sortId} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="popular">{t.sortPopular}</option>
            <option value="new">{t.sortNew}</option>
          </Select>
        </div>
        <div>
          <label htmlFor={languageId} className="sr-only">
            {t.language}
          </label>
          <Select id={languageId} value={language} onChange={(e) => setLanguage(e.target.value as "" | MarketplaceLanguage)}>
            <option value="">{t.anyLanguage}</option>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {languageLabel(t, l)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* One sideways-scrolling row of kinds on phones, wrapped from sm up. */}
      <FilterTabs
        label={t.category}
        value={category}
        onChange={setCategory}
        className="flex max-w-full flex-nowrap overflow-x-auto sm:inline-flex sm:flex-wrap"
        buttonClassName="shrink-0 whitespace-nowrap"
        tabs={[{ value: "all", label: t.all }, ...MARKETPLACE_CATEGORIES.map((c) => ({ value: c, label: categoryLabel(t, c) }))]}
      />

      <DataState loading={first.loading} error={first.error} onRetry={() => void first.refresh()}>
        {templates.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={<Search />}
              title={t.noneFitTitle}
              description={t.noneFitBody}
              action={
                <Button variant="outline" onClick={clearFilters}>
                  {t.clearFilters}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<LayoutTemplate />}
              title={t.emptyTitle}
              description={t.emptyBody}
              action={
                onShare ? (
                  <Button onClick={onShare}>
                    <Upload className="size-4" aria-hidden /> {t.share}
                  </Button>
                ) : undefined
              }
            />
          )
        ) : (
          <>
            <div className={cn("grid gap-3", mode === "page" ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")}>
              {templates.map((tpl) =>
                mode === "page" ? (
                  <TemplateCard key={tpl.id} t={t} template={tpl} onPreview={() => onPreview(tpl)} onUse={() => onUse?.(tpl)} />
                ) : (
                  <PickCard
                    key={tpl.id}
                    t={t}
                    template={tpl}
                    active={selectedId === tpl.id}
                    onPick={() => onPick?.(tpl)}
                    onPreview={() => onPreview(tpl)}
                  />
                )
              )}
            </div>
            <LoadMore hasMore={templates.length < total} loading={more.loading} onClick={() => void loadMore()} />
          </>
        )}
      </DataState>
    </div>
  );
}

/** The template's picture, or a calm tile with its kind when it has none. */
export function TemplatePicture({ t, template, className }: { t: MarketStrings; template: MarketplaceTemplateCard; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (template.thumbnailUrl && !broken) {
    return (
      <img
        src={template.thumbnailUrl}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className={cn("block w-full bg-paper-sunken object-cover", className)}
      />
    );
  }
  return (
    <div aria-hidden className={cn("flex w-full flex-col items-center justify-center gap-1.5 bg-primary-soft text-primary-dark", className)}>
      <LayoutTemplate className="size-6" />
      <span className="text-xs font-medium">{categoryLabel(t, template.category)}</span>
    </div>
  );
}

function CardMeta({ t, template }: { t: MarketStrings; template: MarketplaceTemplateCard }) {
  return (
    // Spans, not paragraphs: the wizard's card puts this inside its <label>.
    <>
      <span className="block text-xs text-ink-soft" dir="auto">
        {fmt(t.by, { author: template.authorName })}
      </span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
        <span className="rounded-full bg-paper-sunken px-2 py-0.5 text-ink">{categoryLabel(t, template.category)}</span>
        {template.language && <span>{languageLabel(t, template.language)}</span>}
        <span>{countsLine(t, template.stepCount, template.usesCount)}</span>
      </span>
    </>
  );
}

function TemplateCard({
  t,
  template,
  onPreview,
  onUse,
}: {
  t: MarketStrings;
  template: MarketplaceTemplateCard;
  onPreview: () => void;
  onUse: () => void;
}) {
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line">
      <button type="button" onClick={onPreview} aria-label={fmt(t.previewOf, { name: template.name })} className="block cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
        <TemplatePicture t={t} template={template} className="aspect-[16/9]" />
      </button>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="line-clamp-2 text-[15px] font-medium text-ink" dir="auto">
          {template.name}
        </h3>
        <CardMeta t={t} template={template} />
        {template.description && (
          <p className="line-clamp-2 text-sm text-ink-soft" dir="auto">
            {template.description}
          </p>
        )}
        <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
          <Button variant="outline" className="min-h-11 sm:min-h-0" onClick={onPreview} aria-label={fmt(t.previewOf, { name: template.name })}>
            <Eye className="size-4" aria-hidden /> {t.preview}
          </Button>
          <Button variant="outline" className="min-h-11 sm:min-h-0" onClick={onUse}>
            {t.use}
          </Button>
        </div>
      </div>
    </article>
  );
}

function PickCard({
  t,
  template,
  active,
  onPick,
  onPreview,
}: {
  t: MarketStrings;
  template: MarketplaceTemplateCard;
  active: boolean;
  onPick: () => void;
  onPreview: () => void;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-2xl border p-3 transition-colors",
        active ? "border-primary bg-primary-soft ring-1 ring-primary/30" : "border-line hover:border-primary/50"
      )}
    >
      <label className="flex cursor-pointer gap-3">
        <input type="radio" name="funnel-template" className="sr-only" checked={active} onChange={onPick} aria-label={fmt(t.choose, { name: template.name })} />
        <TemplatePicture t={t} template={template} className="size-14 shrink-0 rounded-xl [&>span]:hidden" />
        <span className="min-w-0 space-y-1">
          <span className={cn("line-clamp-2 text-sm font-semibold", active ? "text-primary-dark" : "text-ink")} dir="auto">
            {template.name}
          </span>
          <CardMeta t={t} template={template} />
        </span>
      </label>
      <div className="mt-1 flex items-center justify-between gap-2">
        <Button type="button" size="xs" variant="ghost" onClick={onPreview} aria-label={fmt(t.previewOf, { name: template.name })}>
          <Eye className="size-3" aria-hidden /> {t.preview}
        </Button>
        {active && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-dark">
            <Check className="size-3.5" aria-hidden /> {t.chosen}
          </span>
        )}
      </div>
    </div>
  );
}
